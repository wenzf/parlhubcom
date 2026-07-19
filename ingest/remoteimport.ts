// ingest/remoteimport.ts
//
// Remote counterpart to import.ts. Instead of reading *.ndjson.gz off the local
// /openparldata directory, this fetches them over HTTP from the openparldata
// export bucket. Per shard: download to a temp file, gunzip → validate → append
// into DuckDB, then delete the file — so RAM stays flat AND at most one shard
// sits on disk at a time (votes is ~2 GB, docs ~5 GB compressed).
//
// Wired up by ingest/run-remote.ts (`npm run import:remote`).
//
// Three properties the caller asked for:
//
//   • Directory discovery — docs / speeches / texts / news have no fixed
//     filenames; the server publishes an index.json listing every shard. We read
//     that, never guessing filenames.
//
//   • Resumable / robust — the download of each shard resumes across a dropped
//     connection via HTTP Range (continues from the bytes already on disk), so a
//     blip never re-fetches a shard from zero and never re-fetches shards already
//     imported. Across process restarts the import_meta table is the resume
//     ledger: an entity whose stored source size + row_count still match
//     index.json is treated as done and skipped, so re-running continues where it
//     left off and never re-downloads the big unchanged payloads (incremental
//     sync). A partial shard file left by a killed run is resumed too.
//
//   • Skip accounting — every row that fails JSON parse or schema validation is
//     counted per entity and written to remote-import-log.txt, with a final
//     summary of how many entries of each category did NOT fit the schema.
//
// URLs are always derived from BASE_URL (the host we fetched index.json from),
// NOT from the `url`/`base_url` fields inside index.json — those point at the
// test bucket (test-files.openparldata.ch) even on the prod listing.

import path from "path";
import fs from "node:fs";
import fs_p from "node:fs/promises";
import zlib from "node:zlib";
import readline from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
    type DuckDBConnection,
    DuckDBDateValue,
} from "@duckdb/node-api";
import type { DuckDBSqlType } from "../types/opd_db";
import {
    buildCreateTableSql,
    buildAppendPlan,
    appendRow,
    sortTable,
    createIndexes,
} from "./import";
import type { Dataset } from "./datasets";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Prod export bucket. Override with OPD_EXPORTS_URL for staging/test. */
export const BASE_URL = (
    process.env.OPD_EXPORTS_URL ?? "https://files.openparldata.ch/exports"
).replace(/\/+$/, "");

const INDEX_URL = `${BASE_URL}/index.json`;

/** Entities never taken from the bucket, even when the index publishes them:
 *  they ship with the repo (ingest/stopwords/) and are imported by the
 *  local-file fallback in run-remote. */
const LOCAL_ONLY_ENTITIES = new Set(["stopwords"]);

/** Whole-entity import attempts before giving up on that entity. */
const ENTITY_ATTEMPTS = 4;
/** Per-shard download attempts (each resumes from bytes already on disk). */
const DOWNLOAD_ATTEMPTS = 6;
/** Rows between appender.flushSync() calls. */
const FLUSH_EVERY = 5000;

const logDirectory = path.resolve("ingest/openparldata");
const logFilePath = path.join(logDirectory, "remote-import-log.txt");

/**
 * Scratch dir for the one shard currently being downloaded. Each shard is
 * fetched here (resumable via HTTP Range), imported, then deleted immediately —
 * so at most one shard sits on disk at a time (≤ the biggest single file, votes
 * ~2 GB). Lives next to the output DB. Override with OPD_TMP_DIR.
 */
const TMP_DIR = process.env.OPD_TMP_DIR ?? "ingest/build/.remote_tmp";

// ---------------------------------------------------------------------------
// index.json shape (only the fields we consume)
// ---------------------------------------------------------------------------

interface IndexSubFile {
    filename: string;
    size: number;
    row_count: number;
    created: string;
}

interface IndexEntry {
    entity: string;
    type: "single" | "split";
    // single
    filename?: string;
    size?: number;
    row_count?: number;
    created?: string;
    // split
    directory?: string;
    total_size?: number;
    total_row_count?: number;
    files?: IndexSubFile[];
}

interface ExportIndex {
    generated_at: string;
    environment: string;
    base_url: string;
    files: IndexEntry[];
}

/** One downloadable file, host-corrected, with its expected compressed size. */
export interface RemoteShard {
    url: string;
    /** Compressed byte size from index.json — used to verify/resume the download. */
    size: number;
}

/** Everything the importer needs about one remote entity, host-corrected. */
export interface RemoteSource {
    entity: string;
    /** Shards on BASE_URL, in deterministic order. Length 1 for singles. */
    shards: RemoteShard[];
    /** Compressed byte total reported by the server (the change key). */
    sourceSize: number;
    /** Row total reported by the server. */
    sourceRowCount: number;
    /** Latest export `created` timestamp across shards = "last created". */
    sourceCreated: string;
}

// ---------------------------------------------------------------------------
// Buffered skip logger (mirrors import.ts SkipLog)
// ---------------------------------------------------------------------------

const LOG_FLUSH_EVERY = 1000;

class SkipLog {
    private buf: string[] = [];

    add(message: string): void {
        this.buf.push(`[${new Date().toISOString()}] ${message}\n`);
        if (this.buf.length >= LOG_FLUSH_EVERY) void this.flush();
    }

    async flush(): Promise<void> {
        if (this.buf.length === 0) return;
        const chunk = this.buf.join("");
        this.buf = [];
        try {
            await fs_p.mkdir(logDirectory, { recursive: true });
            await fs_p.appendFile(logFilePath, chunk, "utf8");
        } catch (error) {
            console.error("Failed to write to log file:", error);
        }
    }
}

/** Append an arbitrary line to the remote-import log (summaries, headers). */
export async function appendLog(line: string): Promise<void> {
    try {
        await fs_p.mkdir(logDirectory, { recursive: true });
        await fs_p.appendFile(logFilePath, `${line}\n`, "utf8");
    } catch (error) {
        console.error("Failed to write to log file:", error);
    }
}

// ---------------------------------------------------------------------------
// index.json fetch + normalization
// ---------------------------------------------------------------------------

/**
 * Fetches index.json from BASE_URL and returns a per-entity RemoteSource map,
 * with all download URLs rebuilt against BASE_URL (ignoring the test-bucket
 * URLs embedded in the JSON). Also returns the top-level generated_at.
 */
export async function fetchRemoteIndex(): Promise<{
    generatedAt: string;
    sources: Map<string, RemoteSource>;
}> {
    const res = await fetch(INDEX_URL, { cache: "no-store" });
    if (!res.ok) {
        throw new Error(`Failed to fetch ${INDEX_URL}: ${res.status} ${res.statusText}`);
    }
    const index = (await res.json()) as ExportIndex;

    const sources = new Map<string, RemoteSource>();
    for (const entry of index.files) {
        // Local-only entity (stopwords): never sourced from the bucket — dropping
        // it here routes it to run-remote's local-file fallback.
        if (LOCAL_ONLY_ENTITIES.has(entry.entity)) continue;
        if (entry.type === "single") {
            if (!entry.filename) continue;
            sources.set(entry.entity, {
                entity: entry.entity,
                shards: [{ url: `${BASE_URL}/${entry.filename}`, size: entry.size ?? 0 }],
                sourceSize: entry.size ?? 0,
                sourceRowCount: entry.row_count ?? 0,
                sourceCreated: entry.created ?? index.generated_at,
            });
        } else {
            const dir = (entry.directory ?? "").replace(/^\/+|\/+$/g, "");
            const shards = [...(entry.files ?? [])].sort((a, b) =>
                a.filename.localeCompare(b.filename),
            );
            const latestCreated = shards.reduce(
                (max, s) => (s.created > max ? s.created : max),
                "",
            );
            sources.set(entry.entity, {
                entity: entry.entity,
                shards: shards.map((s) => ({
                    url: `${BASE_URL}/${dir}/${s.filename}`,
                    size: s.size ?? 0,
                })),
                sourceSize: entry.total_size ?? 0,
                sourceRowCount: entry.total_row_count ?? 0,
                sourceCreated: latestCreated || index.generated_at,
            });
        }
    }

    return { generatedAt: index.generated_at, sources };
}

// ---------------------------------------------------------------------------
// import_meta — resume ledger + the caller's requested stats table
// ---------------------------------------------------------------------------

export interface MetaRow {
    sourceSize: number;
    sourceRowCount: number;
}

/** Creates import_meta if absent and returns the currently-recorded rows. */
export async function loadImportMeta(
    db: DuckDBConnection,
): Promise<Map<string, MetaRow>> {
    await db.run(`
    CREATE TABLE IF NOT EXISTS import_meta (
      entity              VARCHAR PRIMARY KEY,
      row_count           BIGINT,   -- rows actually stored in the table
      skipped_count       BIGINT,   -- rows dropped (bad JSON / schema mismatch)
      source_size         BIGINT,   -- compressed byte total per index.json
      source_row_count    BIGINT,   -- row total per index.json
      source_created      VARCHAR,  -- export "created" = data last created
      source_generated_at VARCHAR,  -- index.json generated_at at sync time
      synced_at           VARCHAR   -- when WE wrote it to DuckDB = last updated
    );
  `);

    const reader = await db.runAndReadAll(
        `SELECT entity, source_size, source_row_count FROM import_meta;`,
    );
    const map = new Map<string, MetaRow>();
    for (const row of reader.getRowObjects()) {
        map.set(String(row.entity), {
            sourceSize: Number(row.source_size),
            sourceRowCount: Number(row.source_row_count),
        });
    }
    return map;
}

function sqlStr(v: string): string {
    return `'${v.replace(/'/g, "''")}'`;
}

async function upsertImportMeta(
    db: DuckDBConnection,
    row: {
        entity: string;
        rowCount: number;
        skippedCount: number;
        sourceSize: number;
        sourceRowCount: number;
        sourceCreated: string;
        sourceGeneratedAt: string;
        syncedAt: string;
    },
): Promise<void> {
    await db.run(`
    INSERT OR REPLACE INTO import_meta
      (entity, row_count, skipped_count, source_size, source_row_count,
       source_created, source_generated_at, synced_at)
    VALUES (
      ${sqlStr(row.entity)}, ${row.rowCount}, ${row.skippedCount},
      ${row.sourceSize}, ${row.sourceRowCount},
      ${sqlStr(row.sourceCreated)}, ${sqlStr(row.sourceGeneratedAt)},
      ${sqlStr(row.syncedAt)}
    );
  `);
}

// ---------------------------------------------------------------------------
// Streaming one URL into an appender
// ---------------------------------------------------------------------------

interface StreamCounters {
    imported: number;
    skipped: number;
}

// ---------------------------------------------------------------------------
// Live progress line
//
// One in-place (\r) line per entity so a long stream (votes = 42M rows, ~2 GB)
// shows visible movement instead of sitting silent for minutes. Renders are
// throttled to ~150 ms. On a non-TTY (piped/CI) we fall back to a plain line
// every few seconds so logs stay readable. `finish()` terminates the line.
// ---------------------------------------------------------------------------

function formatBytes(n: number): string {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
    return `${n} B`;
}

class ProgressReporter {
    private bytes = 0;
    private lastRender = 0;
    private started = Date.now();
    private readonly isTty = Boolean(process.stdout.isTTY);

    constructor(
        private readonly label: string,
        private readonly counters: StreamCounters,
        private readonly totalBytes: number,
        private readonly totalRows: number,
        private readonly shardCount: number,
    ) { }

    private shard = 0;
    nextShard(): void {
        this.shard++;
    }

    addBytes(n: number): void {
        this.bytes += n;
        this.maybeRender();
    }

    maybeRender(): void {
        const now = Date.now();
        const interval = this.isTty ? 150 : 4000;
        if (now - this.lastRender < interval) return;
        this.lastRender = now;
        this.render();
    }

    private render(): void {
        const { imported, skipped } = this.counters;
        const pct =
            this.totalBytes > 0
                ? `${Math.min(100, (this.bytes / this.totalBytes) * 100).toFixed(0)}%`
                : "";
        const bytesPart = this.totalBytes
            ? `${formatBytes(this.bytes)}/${formatBytes(this.totalBytes)}`
            : formatBytes(this.bytes);
        const rowsPart = this.totalRows
            ? `${imported.toLocaleString()}/${this.totalRows.toLocaleString()} rows`
            : `${imported.toLocaleString()} rows`;
        const secs = ((Date.now() - this.started) / 1000).toFixed(0);
        const shardPart = this.shardCount > 1 ? `[${this.shard}/${this.shardCount}] ` : "";
        const skipPart = skipped ? ` · ${skipped} skipped` : "";
        const line = `  ⟳ ${this.label} ${shardPart}${pct} · ${bytesPart} · ${rowsPart}${skipPart} · ${secs}s`;
        if (this.isTty) {
            process.stdout.write(`\r${line}\x1b[K`);
        } else {
            process.stdout.write(`${line}\n`);
        }
    }

    /** Terminate the live line so the next console.log starts clean. */
    finish(): void {
        this.render();
        if (this.isTty) process.stdout.write("\n");
    }
}

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Downloads one shard to `dest`, RESUMABLE across a dropped connection.
 *
 * Each attempt continues from the bytes already on disk via an HTTP `Range`
 * request (the bucket answers `206`); on abort we keep the partial file and
 * retry from where it stopped rather than from zero. A partial file left by a
 * previous *process* is picked up the same way, so a killed run resumes its
 * download too. Verifies the final size against index.json before returning.
 *
 * The bytes only ever touch disk here; the caller imports the completed file and
 * deletes it immediately, so at most one shard occupies disk at a time.
 */
async function downloadShard(
    shard: RemoteShard,
    dest: string,
    reporter: ProgressReporter,
): Promise<void> {
    const { url, size: expected } = shard;
    let seeded = false;

    for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
        let have = 0;
        try {
            have = (await fs_p.stat(dest)).size;
        } catch {
            /* no partial yet */
        }
        if (expected > 0 && have > expected) {
            // Corrupt/overlong partial — start this shard over.
            await fs_p.rm(dest, { force: true });
            have = 0;
        }
        // Count bytes carried over from a previous process once, so the % is honest.
        if (!seeded && have > 0) reporter.addBytes(have);
        seeded = true;
        // Already complete on disk (resumed to the end) — nothing left to fetch.
        if (expected > 0 && have === expected) return;

        try {
            const init: RequestInit = { cache: "no-store" };
            if (have > 0) init.headers = { Range: `bytes=${have}-` };
            const res = await fetch(url, init);
            if (!res.ok || !res.body) {
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }
            // If we asked to resume but the server ignored Range (200, not 206), it
            // sends the whole file — overwrite instead of appending.
            const append = have > 0 && res.status === 206;

            const nodeStream = Readable.fromWeb(
                res.body as Parameters<typeof Readable.fromWeb>[0],
            );
            nodeStream.on("data", (chunk: Buffer) => reporter.addBytes(chunk.length));
            const out = fs.createWriteStream(dest, { flags: append ? "a" : "w" });
            await pipeline(nodeStream, out);

            if (expected > 0) {
                const got = (await fs_p.stat(dest)).size;
                if (got !== expected) throw new Error(`incomplete: ${got}/${expected} bytes`);
            }
            return;
        } catch (err) {
            // Keep the partial on disk — the next attempt resumes from it.
            const msg = (err as Error).message;
            if (attempt >= DOWNLOAD_ATTEMPTS) {
                throw new Error(`Download ${url} failed after ${attempt} attempts: ${msg}`);
            }
            const backoff = 1000 * 2 ** (attempt - 1);
            console.warn(`\n  download ${url.slice(url.lastIndexOf("/") + 1)}: attempt ${attempt} failed (${msg}); resuming in ${backoff}ms...`);
            await sleep(backoff);
        }
    }
}

/**
 * Imports one already-downloaded shard file into the appender: gunzip → parse →
 * validate → append. Reads local disk only, so it can't be interrupted by the
 * network — a dropped connection is entirely the download step's concern.
 */
async function importLocalShard(
    filePath: string,
    shortName: string,
    appender: Parameters<typeof appendRow>[0],
    plan: ReturnType<typeof buildAppendPlan>,
    assertFn: (input: unknown) => unknown,
    counters: StreamCounters,
    skipLog: SkipLog,
    reporter: ProgressReporter,
): Promise<void> {
    const input = fs.createReadStream(filePath).pipe(zlib.createGunzip());
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    let lineCount = 0;
    for await (const line of rl) {
        lineCount++;
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parsed: unknown;
        try {
            parsed = JSON.parse(trimmed);
        } catch (err) {
            counters.skipped++;
            skipLog.add(`${shortName}:${lineCount} — invalid JSON: ${(err as Error).message}`);
            continue;
        }

        try {
            assertFn(parsed);
        } catch (err) {
            counters.skipped++;
            skipLog.add(`${shortName}:${lineCount} — schema mismatch: ${(err as Error).message}`);
            continue;
        }

        appendRow(appender, plan, parsed as Record<string, unknown>);
        counters.imported++;
        if (counters.imported % FLUSH_EVERY === 0) {
            appender.flushSync();
            reporter.maybeRender();
        }
    }
}

// ---------------------------------------------------------------------------
// Entity import (atomic, retried)
// ---------------------------------------------------------------------------

/**
 * Imports one entity end to end. Per shard: download to a temp file (resumable
 * across a dropped connection, see downloadShard), import that local file into
 * the appender, then DELETE the file immediately — so only one shard occupies
 * disk at a time. After all shards: sort + index.
 *
 * A connection abort is handled inside downloadShard (it resumes the current
 * shard from the bytes on disk), so it never reaches here and never re-fetches
 * shards already imported. The outer ENTITY_ATTEMPTS loop is the last-resort net
 * for non-network failures (e.g. a DuckDB error): it drops the partial table and
 * rebuilds from scratch. Returns the final imported / skipped counts.
 */
export async function importRemoteEntity(
    db: DuckDBConnection,
    dataset: Dataset,
    source: RemoteSource,
): Promise<StreamCounters> {
    const { table, assertFn, columns, sortBy, indexes } = dataset;
    const { shards } = source;
    const plan = buildAppendPlan(columns as Record<string, DuckDBSqlType>);
    const skipLog = new SkipLog();
    await fs_p.mkdir(TMP_DIR, { recursive: true });

    for (let attempt = 1; attempt <= ENTITY_ATTEMPTS; attempt++) {
        // Clean slate — drop any partial table (and its indexes) from a prior try.
        await db.run(`DROP TABLE IF EXISTS "${table}";`);
        await db.run(buildCreateTableSql(table, columns as Record<string, DuckDBSqlType>));

        const counters: StreamCounters = { imported: 0, skipped: 0 };
        const reporter = new ProgressReporter(
            table,
            counters,
            source.sourceSize,
            source.sourceRowCount,
            shards.length,
        );
        const appender = await db.createAppender(table);
        try {
            for (const shard of shards) {
                reporter.nextShard();
                const shortName = shard.url.slice(shard.url.lastIndexOf("/") + 1);
                const dest = path.join(TMP_DIR, shortName);
                await downloadShard(shard, dest, reporter);
                try {
                    await importLocalShard(dest, shortName, appender, plan, assertFn, counters, skipLog, reporter);
                } finally {
                    // Delete the shard the moment it is imported, to keep disk use flat.
                    await fs_p.rm(dest, { force: true });
                }
            }
            appender.closeSync();
            reporter.finish();
        } catch (err) {
            // Discard the partially-filled appender + table and retry the entity.
            reporter.finish();
            try {
                appender.closeSync();
            } catch {
                /* appender may already be broken; ignore */
            }
            await db.run(`DROP TABLE IF EXISTS "${table}";`);
            await skipLog.flush();
            const msg = (err as Error).message;
            if (attempt >= ENTITY_ATTEMPTS) {
                throw new Error(`Entity '${table}' failed after ${attempt} attempts: ${msg}`);
            }
            const backoff = 1000 * 2 ** (attempt - 1);
            console.warn(`  ${table}: attempt ${attempt} failed (${msg}); retrying in ${backoff}ms...`);
            await sleep(backoff);
            continue;
        }

        // Success — cluster + index (matches the local importer's post-steps).
        if (sortBy.length > 0) await sortTable(db, table, sortBy);
        if (indexes.length > 0) await createIndexes(db, table, indexes);
        await skipLog.flush();
        return counters;
    }

    // Unreachable — the loop either returns or throws.
    throw new Error(`Entity '${dataset.table}' exhausted retries.`);
}

// ---------------------------------------------------------------------------
// Meta writer for callers (run-remote.ts) after a successful entity import
// ---------------------------------------------------------------------------

export async function recordEntityMeta(
    db: DuckDBConnection,
    args: {
        entity: string;
        imported: number;
        skipped: number;
        source: RemoteSource;
        generatedAt: string;
        syncedAt: string;
    },
): Promise<void> {
    await upsertImportMeta(db, {
        entity: args.entity,
        rowCount: args.imported,
        skippedCount: args.skipped,
        sourceSize: args.source.sourceSize,
        sourceRowCount: args.source.sourceRowCount,
        sourceCreated: args.source.sourceCreated,
        sourceGeneratedAt: args.generatedAt,
        syncedAt: args.syncedAt,
    });
}
