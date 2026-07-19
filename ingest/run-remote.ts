// ingest/run-remote.ts
//
// Remote data-import entry point. Run from the repo root:
//
//     npm run import:remote
//
// Unlike `npm run import` (which reads *.ndjson.gz off the local /openparldata
// directory), this fetches the export bucket's index.json, then streams each
// entity's shards straight from HTTP into DuckDB — fetch → gunzip → validate →
// append, nothing buffered. See ingest/remoteimport.ts for the mechanics.
//
// Re-runnable as an incremental sync: an entity whose server-side size +
// row_count still match import_meta is skipped, so only changed entities are
// re-downloaded. A crashed run resumes the same way — completed entities are
// already recorded, so it picks up where it left off. Override the source host
// with OPD_EXPORTS_URL (defaults to https://files.openparldata.ch/exports).
//
// Finishes with a CHECKPOINT so no WAL is left behind.
//
// OUTPUT LOCATION — this writes to ingest/build/data.duckdb, NOT the repo-root
// data.duckdb the app serves. That keeps the import fully decoupled from a
// running dev server: the two are separate OS processes touching separate files,
// so you can `npm run dev` and `npm run import:remote` at the same time. When the
// build looks good, swap it in (stop the server, then move the file to the root):
//
//     mv ingest/build/data.duckdb data.duckdb
//
// Override the output path with OPD_DB_OUT (default ingest/build/data.duckdb).

import path from "node:path";
import fs_p from "node:fs/promises";
import { DuckDBInstance } from "@duckdb/node-api";
import { datasets } from "./datasets";
import { importValidatedNdjson } from "./import";
import {
    BASE_URL,
    fetchRemoteIndex,
    loadImportMeta,
    importRemoteEntity,
    recordEntityMeta,
    appendLog,
} from "./remoteimport";

const DB_PATH = process.env.OPD_DB_OUT ?? "ingest/build/data.duckdb";

interface EntitySummary {
    entity: string;
    status: "imported" | "skipped" | "local" | "failed";
    imported: number;
    skipped: number;
}

async function main(): Promise<void> {
    const t0 = Date.now();
    const runStamp = new Date().toISOString();
    console.log(`\nRemote import from ${BASE_URL}`);

    const { generatedAt, sources } = await fetchRemoteIndex();
    console.log(`index.json generated_at: ${generatedAt}, ${sources.size} remote entities.`);
    console.log(`Writing to ${DB_PATH} (repo-root data.duckdb is untouched).\n`);
    await appendLog(`\n===== Remote import ${runStamp} (source generated_at ${generatedAt}) =====`);

    // Output lives in a folder inside ingest/ so a running dev server (which opens
    // the root data.duckdb READ-ONLY) is never disturbed. Ensure it exists.
    await fs_p.mkdir(path.dirname(DB_PATH), { recursive: true });

    const instance = await DuckDBInstance.create(DB_PATH);
    const db = await instance.connect();

    // Same import-time tuning as run.ts: cap memory, allow generous on-disk spill
    // for the big sorts, skip insertion-order bookkeeping (we cluster via sortBy).
    await db.run(`
    SET memory_limit = '3GB';
    SET temp_directory = 'ingest/openparldata/.duckdb_tmp';
    SET max_temp_directory_size = '15GB';
    SET preserve_insertion_order = false;
  `);

    const meta = await loadImportMeta(db);
    const summaries: EntitySummary[] = [];

    // Remote entities that have no local dataset (schema) — e.g. `news`. We can't
    // import what we can't validate, so note them and move on.
    const datasetTables = new Set(datasets.map((d) => d.table));
    for (const entity of sources.keys()) {
        if (!datasetTables.has(entity)) {
            console.log(`  (no schema for remote entity '${entity}' — skipping)`);
            await appendLog(`SKIPPED entity '${entity}': present remotely but no dataset/schema.`);
        }
    }

    try {
        for (const dataset of datasets) {
            const source = sources.get(dataset.table);

            // Local-only dataset (e.g. stopwords): not published remotely. Fall back
            // to the local file importer so a remote-built DB is still complete.
            if (!source) {
                console.log(`Importing '${dataset.table}' from local file (not published remotely)...`);
                await importValidatedNdjson(db, dataset);
                const cnt = await db.runAndReadAll(`SELECT count(*) AS n FROM "${dataset.table}";`);
                const n = Number(cnt.getRowObjects()[0]?.n ?? 0);
                summaries.push({ entity: dataset.table, status: "local", imported: n, skipped: 0 });
                continue;
            }

            // Incremental sync: unchanged size + row_count → nothing to do.
            const prev = meta.get(dataset.table);
            if (
                prev &&
                prev.sourceSize === source.sourceSize &&
                prev.sourceRowCount === source.sourceRowCount
            ) {
                console.log(`Skipping '${dataset.table}' — unchanged (${source.sourceRowCount} rows).`);
                summaries.push({ entity: dataset.table, status: "skipped", imported: 0, skipped: 0 });
                continue;
            }

            console.log(
                `Importing '${dataset.table}' (${source.shards.length} file(s), ~${source.sourceRowCount} rows)...`,
            );
            const { imported, skipped } = await importRemoteEntity(db, dataset, source);
            await recordEntityMeta(db, {
                entity: dataset.table,
                imported,
                skipped,
                source,
                generatedAt,
                syncedAt: new Date().toISOString(),
            });
            // Persist per entity so a later crash resumes from here.
            await db.run("CHECKPOINT;");
            console.log(`  ${imported} rows imported, ${skipped} skipped.`);
            summaries.push({ entity: dataset.table, status: "imported", imported, skipped });
        }

        console.log("\nCheckpointing...");
        await db.run("CHECKPOINT;");
    } finally {
        db.closeSync();
        instance.closeSync();
    }

    // ── Summary: how many entries of each category did / didn't fit the schema ──
    const totalImported = summaries.reduce((s, r) => s + r.imported, 0);
    const totalSkipped = summaries.reduce((s, r) => s + r.skipped, 0);
    const lines = [
        `----- Summary ${runStamp} -----`,
        ...summaries.map(
            (r) =>
                `${r.entity.padEnd(20)} ${r.status.padEnd(9)} imported=${r.imported} skipped(schema/json)=${r.skipped}`,
        ),
        `TOTAL imported=${totalImported} skipped=${totalSkipped}`,
    ];
    await appendLog(lines.join("\n"));

    console.log("\nSummary (imported = fit schema, skipped = did NOT fit / bad JSON):");
    for (const r of summaries) {
        console.log(
            `  ${r.entity.padEnd(20)} ${r.status.padEnd(9)} imported=${r.imported}  skipped=${r.skipped}`,
        );
    }
    console.log(`  TOTAL imported=${totalImported}  skipped=${totalSkipped}`);

    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\nDone in ${secs}s. Built ${DB_PATH}.`);
    console.log(`Skip details: ingest/openparldata/remote-import-log.txt`);
    console.log(`To serve it: stop the dev server, then \`mv ${DB_PATH} data.duckdb\`.\n`);
}

main().catch((err) => {
    console.error("\nRemote import failed:", err);
    process.exit(1);
});
