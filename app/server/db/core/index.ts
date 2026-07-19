"server-only";
// core/index.ts                   → ~/server/db/core
//
// Public entry point for the generic DB engine. Route loaders and query modules
// import from "~/server/db/core"; the engine files (db / runner) are internals
// reached only through this barrel.
//
//   • the query runners + their param/binder helpers (runner.ts)
//   • the live READ-ONLY connection singleton `db` (db.ts).
//
// Data import is NOT part of the app: building data.duckdb lives at the repo root
// (`npm run import`, see ingest/). The domain query modules live in
// ~/server/db/analytics/*; the raw SQL in ~/server/db/sql/*.

export * from "./runner";
export { db } from "./db";
