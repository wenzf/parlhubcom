// Scheduled DB rebuild — runs as a Fargate task (sst.aws.Task "UpdateDb").
//
// Wraps the untouched ingest/run-remote.ts via its existing env contract
// (OPD_DB_OUT, OPD_TMP_DIR). Steps:
//
//   1. download the current DB from S3 (keeps the import_meta ledger, so the
//      import is incremental — unchanged entities are skipped)
//   2. run `tsx ingest/run-remote.ts` against local disk
//   3. verify: no .wal sidecar, file opens READ_ONLY, sanity query
//   4. upload as an immutable key db/data-<timestamp>.duckdb + point db/latest
//      at it (immutable keys: a parallel ranged download can never stitch two
//      versions), prune all but the newest KEEP_SNAPSHOTS snapshots
//   5. force a rolling redeploy of the app service (zero downtime)
//
// Any failure before step 5 leaves the app serving the previous DB.
//
// Env: DB_S3_BUCKET (required), ECS_CLUSTER + ECS_SERVICE (optional — skip
// redeploy when unset), WORK_DIR (default /data).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";
import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";
import {
    DeleteObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

const BUCKET = process.env.DB_S3_BUCKET;
if (!BUCKET) throw new Error("DB_S3_BUCKET is required");

const WORK_DIR = process.env.WORK_DIR ?? "/data";
const DB_OUT = path.join(WORK_DIR, "build", "data.duckdb");
const SNAPSHOT_PREFIX = "db/data-";
const POINTER_KEY = "db/latest";
const KEEP_SNAPSHOTS = 3;

const s3 = new S3Client({});

const s5cmd = (args: string[]) => {
    const res = spawnSync("s5cmd", args, { stdio: ["ignore", "pipe", "inherit"] });
    return { status: res.status, stdout: res.stdout?.toString() ?? "" };
};

const run = async () => {
    await mkdir(path.dirname(DB_OUT), { recursive: true });

    // 1. previous DB → local disk (a missing pointer means first-ever build)
    const pointer = s5cmd(["cat", `s3://${BUCKET}/${POINTER_KEY}`]);
    if (pointer.status === 0 && pointer.stdout.trim()) {
        const prevKey = pointer.stdout.trim();
        console.log(`update-db: downloading previous s3://${BUCKET}/${prevKey}`);
        const dl = s5cmd(["cp", "--concurrency", "16", "--part-size", "64", `s3://${BUCKET}/${prevKey}`, DB_OUT]);
        if (dl.status !== 0) throw new Error(`download of ${prevKey} failed`);
    } else {
        console.log("update-db: no db/latest pointer — building from scratch");
    }

    // 2. incremental import (long-running; streams shards, flat RAM) — or, with
    // DB_MIGRATE_ONLY=1, only the derive step (ingest/run-derive.ts): recompute
    // derived columns on the downloaded DB without contacting the source bucket.
    const migrateOnly = process.env.DB_MIGRATE_ONLY === "1";
    const script = migrateOnly ? "ingest/run-derive.ts" : "ingest/run-remote.ts";
    console.log(`update-db: running ${script} …`);
    const imp = spawnSync("npx", ["tsx", script], {
        stdio: "inherit",
        env: {
            ...process.env,
            OPD_DB_OUT: DB_OUT,
            OPD_TMP_DIR: path.join(WORK_DIR, ".remote_tmp"),
        },
    });
    if (imp.status !== 0) throw new Error(`${script} exited with ${imp.status}`);

    // 3. verify: clean checkpoint (no WAL) + file opens read-only + sanity query
    if (existsSync(`${DB_OUT}.wal`)) throw new Error("WAL sidecar present — import did not checkpoint cleanly");
    const instance = await DuckDBInstance.create(DB_OUT, { access_mode: "READ_ONLY" });
    const conn = await instance.connect();
    const reader = await conn.runAndReadAll("SELECT count(*) AS n FROM import_meta");
    const rows = reader.getRowObjects();
    console.log(`update-db: verified — ${rows[0]?.n} entities in import_meta`);
    conn.closeSync();
    instance.closeSync();

    // 4. upload immutable snapshot, flip the pointer, prune old snapshots
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `${SNAPSHOT_PREFIX}${stamp}.duckdb`;
    const size = (await stat(DB_OUT)).size;
    console.log(`update-db: uploading ${(size / 1e9).toFixed(1)} GB → s3://${BUCKET}/${key}`);
    const up = s5cmd(["cp", "--concurrency", "16", "--part-size", "64", DB_OUT, `s3://${BUCKET}/${key}`]);
    if (up.status !== 0) throw new Error("upload failed");

    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: POINTER_KEY, Body: key, ContentType: "text/plain" }));
    console.log(`update-db: ${POINTER_KEY} → ${key}`);

    const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: SNAPSHOT_PREFIX }));
    const snapshots = (listed.Contents ?? [])
        .map((o) => o.Key!)
        .sort()
        .reverse(); // timestamped keys: lexicographic == chronological
    for (const old of snapshots.slice(KEEP_SNAPSHOTS)) {
        console.log(`update-db: pruning ${old}`);
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: old }));
    }

    // 5. rolling redeploy — new tasks boot with the new DB, old task keeps
    // serving until they are healthy
    const clusterArn = process.env.ECS_CLUSTER;
    const serviceName = process.env.ECS_SERVICE;
    if (clusterArn && serviceName) {
        const ecs = new ECSClient({});
        await ecs.send(new UpdateServiceCommand({ cluster: clusterArn, service: serviceName, forceNewDeployment: true }));
        console.log(`update-db: forced new deployment of ${serviceName}`);
    } else {
        console.log("update-db: ECS_CLUSTER/ECS_SERVICE unset — skipping redeploy");
    }
};

run().catch((err) => {
    console.error("update-db: FAILED —", err);
    process.exit(1);
});
