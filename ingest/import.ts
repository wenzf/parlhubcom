import path from "path";
import fs_p from "node:fs/promises";
import fs from "node:fs";
import zlib from "node:zlib";
import readline from "node:readline";
import { fileURLToPath } from "url";
import {
    type DuckDBConnection,
    DuckDBDateValue,
} from "@duckdb/node-api";
import type { DuckDBSqlType } from "../types/opd_db";

// ---------------------------------------------------------------------------
// Logging
//
// Skip events are buffered and written in batches instead of awaiting a file
// append per bad row. The previous per-row `await appendFile` serialized the
// whole ndjson stream behind disk I/O whenever rows were skipped; on a dirty
// file that turned import into a write-per-line crawl. Buffering keeps the hot
// loop CPU-bound and touches the disk a handful of times instead.
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDirectory = path.resolve("ingest/openparldata");
const logFilePath = path.join(logDirectory, "import-log.txt");

const LOG_FLUSH_EVERY = 1000;

class SkipLog {
    private buf: string[] = [];

    add(message: string): void {
        this.buf.push(`[${new Date().toISOString()}] ${message}\n`);
        if (this.buf.length >= LOG_FLUSH_EVERY) {
            // Fire-and-forget within the batch; the awaited flush() at the end
            // guarantees everything is on disk before the function returns.
            void this.flush();
        }
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

// ---------------------------------------------------------------------------
// Stream helpers
// ---------------------------------------------------------------------------

const isGzip = (filePath: string) => filePath.toLowerCase().endsWith(".gz");

function openNdjsonLines(filePath: string): readline.Interface {
    const fileStream = fs.createReadStream(filePath);
    const input = isGzip(filePath) ? fileStream.pipe(zlib.createGunzip()) : fileStream;
    return readline.createInterface({ input, crlfDelay: Infinity });
}

const isNdjson = (name: string) => {
    const n = name.toLowerCase();
    return n.endsWith(".ndjson") || n.endsWith(".ndjson.gz");
};

/**
 * Resolves a dataset's `file` entry to the concrete list of ndjson files to
 * import, in deterministic (sorted) order.
 *
 *   • a single file  → [that file]
 *   • a directory    → every *.ndjson / *.ndjson.gz directly inside it
 *
 * Sub-directories are not descended into; the dataset folders are flat. Throws
 * if the path does not exist.
 */
async function resolveImportFiles(fileOrDir: string): Promise<string[]> {
    const stat = await fs_p.stat(fileOrDir); // throws ENOENT with a clear path if missing
    if (stat.isFile()) return [fileOrDir];

    const entries = await fs_p.readdir(fileOrDir, { withFileTypes: true });
    return entries
        .filter((e) => e.isFile() && isNdjson(e.name))
        .map((e) => path.join(fileOrDir, e.name))
        .sort();
}

// ---------------------------------------------------------------------------
// Table creation
// ---------------------------------------------------------------------------

export function buildCreateTableSql(table: string, columns: Record<string, DuckDBSqlType>): string {
    const cols = Object.entries(columns)
        .map(([key, type]) => `"${key}" ${type}`)
        .join(", ");
    return `CREATE TABLE IF NOT EXISTS "${table}" (${cols});`;
}

// ---------------------------------------------------------------------------
// Append plan
//
// The column list is fixed for the whole file, so we resolve each column's
// type to a writer closure exactly once instead of re-running
// `Object.entries(columns)` + a `switch` on every single row. For a file with
// N rows and C columns this turns N×C switch dispatches into C closure builds
// plus N×C plain calls.
//
// Semantics are unchanged from the original appendRow:
//   DATE   columns: ISO date string  → days since epoch.
//   DOUBLE columns: ISO timestamp string → epoch millis as a JS number.
// ---------------------------------------------------------------------------

export interface DuckDBAppender {
    appendNull(): void;
    appendInteger(v: number): void;
    appendDouble(v: number): void;
    appendVarchar(v: string): void;
    appendBoolean(v: boolean): void;
    appendDate(v: DuckDBDateValue): void;
    endRow(): void;
    flushSync(): void;
}

export interface ColumnWriter {
    key: string;
    write(appender: DuckDBAppender, value: unknown): void;
}

export function buildAppendPlan(columns: Record<string, DuckDBSqlType>): ColumnWriter[] {
    return Object.entries(columns).map(([key, type]): ColumnWriter => {
        switch (type) {
            case "INTEGER":
                return { key, write: (a, v) => a.appendInteger(v as number) };
            case "VARCHAR":
                return { key, write: (a, v) => a.appendVarchar(v as string) };
            case "BOOLEAN":
                return { key, write: (a, v) => a.appendBoolean(v as boolean) };
            case "DATE":
                return {
                    key,
                    write: (a, v) =>
                        a.appendDate(
                            new DuckDBDateValue(
                                Math.floor(new Date(v as string).getTime() / 86_400_000),
                            ),
                        ),
                };
            case "DOUBLE":
                return { key, write: (a, v) => a.appendDouble(new Date(v as string).getTime()) };
            default:
                throw new Error(`buildAppendPlan: unhandled column type '${type}' for column '${key}'`);
        }
    });
}

export function appendRow(
    appender: DuckDBAppender,
    plan: ColumnWriter[],
    row: Record<string, unknown>,
): void {
    for (let i = 0; i < plan.length; i++) {
        const col = plan[i];
        const value = row[col.key];
        if (value === null || value === undefined) {
            appender.appendNull();
        } else {
            col.write(appender, value);
        }
    }
    appender.endRow();
}

// ---------------------------------------------------------------------------
// Post-import helpers
// ---------------------------------------------------------------------------

/**
 * Recreates the table in sorted order via a temp rename, so the physical
 * row layout matches the ORDER BY used in queries (better zone-map pruning).
 */
export async function sortTable(
    db: DuckDBConnection,
    table: string,
    sortBy: string[],
): Promise<void> {
    const tmp = `_build_tmp_${table}`;
    console.log(`  Sorting ${table} by ${sortBy.join(", ")}...`);
    await db.run(`ALTER TABLE "${table}" RENAME TO "${tmp}"`);
    await db.run(`CREATE TABLE "${table}" AS SELECT * FROM "${tmp}" ORDER BY ${sortBy.join(", ")}`);
    await db.run(`DROP TABLE "${tmp}"`);
}

/**
 * Creates ART indexes after the table is in its final sorted state.
 */
export async function createIndexes(
    db: DuckDBConnection,
    table: string,
    indexes: string[],
): Promise<void> {
    for (const col of indexes) {
        const idxName = `idx_${table}_${col}`;
        console.log(`  Creating index ${idxName}...`);
        await db.run(`CREATE INDEX IF NOT EXISTS ${idxName} ON "${table}"("${col}");`);
    }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Imports ndjson (or .ndjson.gz) data into DuckDB, validating each row before
 * inserting it. Invalid rows are logged and skipped — they never reach the
 * database. Skips the entire import if the table already exists.
 *
 * `file` may be either a single ndjson(.gz) file or a folder containing many of
 * them; a folder is expanded to all its *.ndjson / *.ndjson.gz files and they
 * are imported into the one table (single appender, single sort/index pass).
 *
 * Flow per row:
 *   1. Parse JSON
 *   2. Run assertFn — skip + log if it throws
 *   3. Append to DuckDB via Appender (using the precomputed plan)
 *
 * After all rows (across all files):
 *   4. Sort table if sortBy is provided (physical clustering)
 *   5. Create ART indexes if indexes is provided
 */
export async function importValidatedNdjson(
    db: DuckDBConnection,
    options: {
        table: string;
        /** A single ndjson(.gz) file, or a folder of them. */
        file: string;
        assertFn: (input: unknown) => unknown;
        columns: Record<string, DuckDBSqlType>;
        sortBy?: string[];
        indexes?: string[];
    },
): Promise<void> {
    const { table, file, assertFn, columns, sortBy = [], indexes = [] } = options;

    const checkReader = await db.runAndReadAll(`
    SELECT table_name FROM information_schema.tables WHERE table_name = '${table}';
  `);
    if (checkReader.getRowObjects().length > 0) return;

    // `file` may be a single ndjson(.gz) file or a folder of them.
    const files = await resolveImportFiles(path.resolve(file));
    if (files.length === 0) {
        console.warn(`  No .ndjson/.ndjson.gz files found in ${file} — creating empty '${table}'.`);
    }

    console.log(
        `Importing ${files.length} file(s) from ${file} into '${table}'...`,
    );
    await db.run(buildCreateTableSql(table, columns));

    // Resolve the column → writer mapping once for the whole table.
    const plan = buildAppendPlan(columns);
    const skipLog = new SkipLog();
    const appender = await db.createAppender(table);

    let imported = 0;
    let skipped = 0;

    try {
        // One appender for the whole table; files are streamed in sequence and the
        // 5000-row flush cadence carries across file boundaries.
        for (const filePath of files) {
            const shortName = path.basename(filePath);
            let lineCount = 0;
            const rl = openNdjsonLines(filePath);

            for await (const line of rl) {
                lineCount++;
                const trimmed = line.trim();
                if (!trimmed) continue;

                let parsed: unknown;
                try {
                    parsed = JSON.parse(trimmed);
                } catch (err) {
                    skipped++;
                    skipLog.add(`${shortName}:${lineCount} — invalid JSON: ${(err as Error).message}`);
                    continue;
                }

                try {
                    assertFn(parsed);
                } catch (err) {
                    skipped++;
                    skipLog.add(`${shortName}:${lineCount} — schema mismatch: ${(err as Error).message}`);
                    continue;
                }

                appendRow(appender, plan, parsed as Record<string, unknown>);
                imported++;

                if (imported % 5000 === 0) {
                    appender.flushSync();
                }
            }
        }
    } finally {
        appender.closeSync();
        await skipLog.flush();
    }

    console.log(`  ${imported} rows imported, ${skipped} skipped.`);

    if (sortBy.length > 0) {
        await sortTable(db, table, sortBy);
    }

    if (indexes.length > 0) {
        await createIndexes(db, table, indexes);
    }

    console.log(`Finished importing ${table}.`);
}