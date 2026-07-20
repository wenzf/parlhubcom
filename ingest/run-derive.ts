// ingest/run-derive.ts
//
// Standalone derive-only entry point: (re)computes the derived columns (see
// ingest/derive.ts) on an EXISTING DuckDB file without importing anything —
// no contact with the OpenParlData bucket. Used by deploy/update-db.ts's
// migrate-only mode (DB_MIGRATE_ONLY=1) and runnable by hand:
//
//     OPD_DB_OUT=path/to/data.duckdb npx tsx ingest/run-derive.ts
//
// Defaults to ingest/build/data.duckdb (same contract as run-remote.ts).
// Finishes with a CHECKPOINT so no WAL is left behind.

import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";
import { deriveSpeechSearch, speechSearchDeriveNeeded } from "./derive";

const DB_PATH = process.env.OPD_DB_OUT ?? "ingest/build/data.duckdb";

async function main(): Promise<void> {
    const t0 = Date.now();
    console.log(`\nDerive-only run on ${DB_PATH}`);

    // Derive-only NEVER builds from scratch: a missing file means the download
    // step failed — fail fast instead of letting DuckDB create an empty DB.
    if (!existsSync(DB_PATH)) {
        throw new Error(`derive-only: ${DB_PATH} does not exist — nothing to derive on`);
    }

    const instance = await DuckDBInstance.create(DB_PATH);
    const db = await instance.connect();

    // Like run-remote.ts's tuning, but with more memory (this is a dedicated
    // process — on the 8 GB UpdateDb task nothing else is running) and the temp
    // spill next to the DB file (the only disk guaranteed to have room for it).
    const tmpDir = path.join(path.dirname(DB_PATH), ".duckdb_tmp");
    mkdirSync(tmpDir, { recursive: true });
    await db.run(`
    SET memory_limit = '6GB';
    SET temp_directory = '${tmpDir.replace(/'/g, "''")}';
    SET max_temp_directory_size = '50GB';
    SET preserve_insertion_order = false;
  `);

    try {
        if (await speechSearchDeriveNeeded(db)) {
            console.log("Deriving speeches search columns...");
            await deriveSpeechSearch(db);
        } else {
            console.log("Speeches search columns up to date — nothing to do.");
        }
        console.log("Checkpointing...");
        await db.run("CHECKPOINT;");
    } finally {
        db.closeSync();
        instance.closeSync();
    }

    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`Done in ${secs}s.\n`);
}

main().catch((err) => {
    console.error("\nDerive run failed:", err);
    process.exit(1);
});
