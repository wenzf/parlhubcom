// ingest/run.ts
//
// The data-import entry point. Run from the repo root:
//
//     npm run import
//
// Opens data.duckdb READ-WRITE, applies the import-time PRAGMAs, then loads every
// dataset (validating each row) via importValidatedNdjson. Each table is skipped
// if it already exists, so re-running is safe/idempotent — delete data.duckdb
// (and its .wal) first for a clean rebuild. Finishes with a CHECKPOINT so no WAL
// is left behind; the app then opens the file READ-ONLY (see app/server/db/core/db.ts).
//
// This process is completely decoupled from the running app: the app never
// imports anything under ingest/, and importing is no longer done at app boot.

import { DuckDBInstance } from "@duckdb/node-api";
import { importValidatedNdjson } from "./import";
import { datasets } from "./datasets";
import { deriveSpeechSearch, speechSearchDeriveNeeded } from "./derive";

const DB_PATH = "data.duckdb";

async function main(): Promise<void> {
    const t0 = Date.now();
    console.log(`\nBuilding ${DB_PATH} from ${datasets.length} datasets...\n`);

    const instance = await DuckDBInstance.create(DB_PATH);
    const db = await instance.connect();

    // Import-time tuning: cap memory, allow generous on-disk spill for the big
    // sorts/index builds, and skip insertion-order bookkeeping (we cluster
    // explicitly via sortBy).
    await db.run(`
    SET memory_limit = '3GB';
    SET temp_directory = 'ingest/openparldata/.duckdb_tmp';
    SET max_temp_directory_size = '15GB';
    SET preserve_insertion_order = false;
  `);

    try {
        for (const dataset of datasets) {
            await importValidatedNdjson(db, dataset);
        }

        // Derived columns (speeches search). Local builds carry no import_meta
        // ledger, so freshness is unprovable and this re-derives every run —
        // fine at local data sizes.
        if (await speechSearchDeriveNeeded(db)) {
            console.log("\nDeriving speeches search columns...");
            await deriveSpeechSearch(db);
        }

        // Fold the WAL into the main file so a subsequent READ-ONLY open succeeds.
        console.log("\nCheckpointing...");
        await db.run("CHECKPOINT;");
    } finally {
        db.closeSync();
        instance.closeSync();
    }

    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\nDone. ${DB_PATH} built in ${secs}s.\n`);
}

main().catch((err) => {
    console.error("\nImport failed:", err);
    process.exit(1);
});
