"server-only";
// app/server/db/core/db.ts
//
// The runtime DuckDB connection — nothing more. The app opens the already-built
// data.duckdb READ-ONLY and never imports data at boot; building the database is
// a separate root-level process (`npm run import`, see ingest/). This module is
// therefore pure runtime plumbing: no dataset registry, no import loop.
//
// A missing/locked/un-checkpointed data.duckdb makes this throw on startup — that
// is intentional (fail loudly): run `npm run import` to build it first.
//
// In dev the instance is cached on globalThis so HMR reloads reuse one open
// handle instead of leaking a new read-only connection per reload.

import { DuckDBInstance } from "@duckdb/node-api";

// Env-overridable for containerized deploys: the DB is downloaded to a data
// volume at boot and temp spill must point at the same writable disk.
const DB_PATH = process.env.DB_PATH ?? "data.duckdb";
const DB_TEMP_DIR =
    process.env.DUCKDB_TMP ?? "ingest/openparldata/.duckdb_tmp";
const DB_MEMORY_LIMIT = process.env.DUCKDB_MEMORY_LIMIT ?? "3GB";
const READ_ONLY = { access_mode: "READ_ONLY" } as const;

let instance: DuckDBInstance;

declare global {
    var __dbInstance: DuckDBInstance | undefined;
}

// The tuning below is instance-level (temp_directory can't be re-SET once temp
// files were spilled), so in dev it must run ONLY when this evaluation actually
// created the instance — an HMR reload reusing the cached instance would
// otherwise throw "Cannot switch temporary directory" and 500 every route.
let tune = true;

if (process.env.NODE_ENV === "production") {
    instance = await DuckDBInstance.create(DB_PATH, READ_ONLY);
} else {
    if (!global.__dbInstance) {
        global.__dbInstance = await DuckDBInstance.create(DB_PATH, READ_ONLY);
    } else {
        tune = false;
    }
    instance = global.__dbInstance;
}

export const db = await instance.connect();

// Runtime query tuning (valid on a read-only connection): cap memory and allow
// on-disk spill for large sorts/aggregations.
if (tune) {
    await db.run(`
    SET memory_limit = '${DB_MEMORY_LIMIT}';
    SET temp_directory = '${DB_TEMP_DIR}';
    SET max_temp_directory_size = '15GB';
    SET preserve_insertion_order = false;
  `);
}
