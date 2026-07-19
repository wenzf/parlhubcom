#!/bin/sh
# One-time bootstrap: upload the local data.duckdb to the deployment bucket
# and point db/latest at it. Later updates are done by the scheduled UpdateDb
# task; this is only needed before the very first deploy goes healthy.
#
# Usage: sh deploy/upload-db.sh <bucket-name> [aws-profile]
#   bucket-name — printed as `bucket` in the `sst deploy` outputs
set -eu

BUCKET="${1:?usage: sh deploy/upload-db.sh <bucket-name> [aws-profile]}"
PROFILE="${2:-parlhubcom}"
DB_FILE="${DB_FILE:-data.duckdb}"

[ -f "$DB_FILE" ] || { echo "error: $DB_FILE not found (run from repo root)"; exit 1; }
[ -f "$DB_FILE.wal" ] && { echo "error: $DB_FILE.wal exists — stop the writer / checkpoint first"; exit 1; }

KEY="db/data-$(date -u +%Y-%m-%dT%H-%M-%S)-local.duckdb"
echo "uploading $DB_FILE -> s3://$BUCKET/$KEY (this can take a while)"
aws s3 cp "$DB_FILE" "s3://$BUCKET/$KEY" --profile "$PROFILE"
printf '%s' "$KEY" | aws s3 cp - "s3://$BUCKET/db/latest" --profile "$PROFILE" --content-type text/plain
echo "done: db/latest -> $KEY"
