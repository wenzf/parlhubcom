# Data import

Building `data.duckdb` is decoupled from the app (the app only opens it
READ-ONLY). The dataset registry — table ↔ source ↔ sort/index strategy — lives
in [`ingest/datasets.ts`](../ingest/datasets.ts).

- **Local** — `npm run import` ([`ingest/run.ts`](../ingest/run.ts)) reads
  `*.ndjson(.gz)` from `./ingest/openparldata/` into the repo-root `data.duckdb`.
- **Remote** — `npm run import:remote` ([`ingest/run-remote.ts`](../ingest/run-remote.ts))
  streams the `.ndjson.gz` shards over HTTP from the OpenParlData export bucket
  ([`ingest/remoteimport.ts`](../ingest/remoteimport.ts)). Fetch → gunzip →
  validate → append, nothing buffered (flat RAM). Writes to
  `ingest/build/data.duckdb`, NOT the root file — so `npm run dev` and the import
  run in parallel as independent processes. Swap when ready:
  `mv ingest/build/data.duckdb data.duckdb` + restart the server.

Remote specifics:

- **Discovery** — the shard list (docs/speeches/texts have no fixed filenames)
  comes from the bucket's `index.json`; URLs are rebuilt on the host we fetched
  from, never the test URLs inside the JSON.
- **Incremental sync** — an entity whose `index.json` size + row_count still
  match the `import_meta` ledger is skipped; a crashed run resumes the same way.
  Imports are entity-atomic and retried on connection drops.
- **`import_meta`** — one row per entity: `row_count`, `synced_at` (last updated),
  `source_created` (data last created). Typed in
  [`types/opd_db.ts`](../types/opd_db.ts); the CREATE TABLE in `remoteimport.ts`
  is the source of truth.
- **Local-only entities** — `stopwords` ships with the repo
  (`ingest/stopwords/*.ndjson`) and is never taken from the bucket
  (`LOCAL_ONLY_ENTITIES` in `remoteimport.ts` drops it from the index; the
  local-file fallback in `run-remote.ts` imports it).
- Rows failing JSON/schema are counted and logged to
  `ingest/openparldata/remote-import-log.txt`.
