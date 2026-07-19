#!/bin/sh
# Container entrypoint: fetch the read-only DuckDB from S3 before starting the
# server. Skipped when DB_S3_BUCKET is unset (local `docker run` with the DB
# mounted at $DB_PATH instead).
#
# The `db/latest` object holds the key of an immutable snapshot
# (db/data-<timestamp>.duckdb) — objects are never overwritten, so a parallel
# ranged download can't stitch two versions together.
set -eu

if [ -n "${DB_S3_BUCKET:-}" ]; then
  DB_PATH="${DB_PATH:-/data/data.duckdb}"
  export DB_PATH
  mkdir -p "$(dirname "$DB_PATH")" "${DUCKDB_TMP:-/data/.duckdb_tmp}"

  KEY="$(s5cmd cat "s3://${DB_S3_BUCKET}/db/latest" | tr -d '[:space:]')"
  echo "entrypoint: downloading s3://${DB_S3_BUCKET}/${KEY} -> ${DB_PATH}"
  s5cmd cp --concurrency 16 --part-size 64 "s3://${DB_S3_BUCKET}/${KEY}" "${DB_PATH}"
  echo "entrypoint: database ready ($(du -h "${DB_PATH}" | cut -f1))"
fi

exec "$@"
