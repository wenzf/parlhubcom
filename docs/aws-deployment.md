# Deploying parlhub to AWS (SSR app + large read-only DuckDB)

How to deploy parlhub to AWS with **SST v3**. parlhub is a React Router v8 SSR app
that queries a single **read-only DuckDB file** (tens of GB, growing) **in-process** —
the Node server opens `data.duckdb` directly via `@duckdb/node-api`
([`app/server/db/core/db.ts`](../app/server/db/core/db.ts)). Some pages run heavy
analytical SQL (a few seconds uncached, with multi-GB temp spill) and there is no query
cache.

**The one fact that decides the architecture:** because queries run in-process, the DB
file must be readable from wherever the SSR code runs. That rules Lambda in or out based
on **storage**, not compute — Lambda's 10 GB ephemeral disk can't hold the file, and heavy
scans over EFS/`httpfs` are far too slow. So the app runs as a **Fargate container with the
DB on local disk**, downloaded from S3 at boot.

> This is a generic guide — substitute your own AWS account, region, profile, bucket and
> domain wherever a `<placeholder>` appears. Concrete resource names, account IDs and the
> live status are intentionally omitted.

## Architecture (all SST v3)

```
Browser ──> (optional CloudFront) ──> ALB ──> Fargate Service (Spot, ~4vCPU/16GB, 100GB disk)
                                                          │  boot: download data.duckdb from S3 → local disk → start server
                                                          ▼
   sst.aws.CronV2 (weekly) ──> sst.aws.Task (Fargate, 100GB disk)
      download previous DB from S3 → run import:remote (incremental) → CHECKPOINT
      → verify-open read-only → upload to S3 (immutable key) → ECS UpdateService(forceNewDeployment)
```

SST components: `sst.aws.Vpc` (no NAT — containers in public subnets, S3 traffic free),
`sst.aws.Cluster`, `sst.aws.Service`, `sst.aws.Bucket`, `sst.aws.Task`, `sst.aws.CronV2`
(targets the Task directly, no Lambda), optional `sst.aws.Router` (CloudFront) for the
domain + free egress.

### Why this shape (scenario comparison)

| Scenario | How it works | Perf | Est. cost/mo | Verdict |
|---|---|---|---|---|
| **Fargate container + DB on local disk** ✅ | Container downloads DB from S3 at boot to its own disk, serves from local disk | Full speed, predictable | ~$105–122 (Spot 4vCPU/16GB) | **Chosen** |
| Lambda + EFS network drive | Lambda mounts EFS holding the DB | Heavy scans over NFS 2–5× slower; multi-GB spill doesn't fit Lambda's 10GB /tmp | ~$15 base **+ $0.03/GB read** — heavy pages scan GBs → unpredictable | Rejected |
| Lambda + DuckDB `httpfs` over S3 | Queries fetch DB byte-ranges from S3 on demand | Slowest for analytics (many round trips); needs code changes | ~$5–20 | Rejected (latency) |
| EC2 + EBS | Classic server, persistent disk | Full speed, no boot download | ~$50–65 (t4g.large) | Escape hatch — but no first-class SST component, hand-rolled deploys |
| MotherDuck (managed DuckDB) | App connects to hosted DuckDB | Good | ~$25+ + egress | Rejected (non-AWS, code changes) |

Lambda can't hold the file locally (10 GB ephemeral max). ECS-managed EBS-from-snapshot per
task was evaluated — not better today (lazy block loading = slow first scans, awkward SST
plumbing); revisit when the DB nears ~100 GB.

### Critical config gotchas (verified against SST source)

- `transform: { service: { healthCheckGracePeriodSeconds: 900 } }` — **mandatory**. SST
  doesn't set it and hardcodes the deployment circuit-breaker with rollback; without a grace
  period the ALB kills tasks mid-download and deploys never converge.
- Service: `architecture` (`"x86_64"` or `"arm64"` — see below), `capacity: "spot"`,
  `storage: "100 GB"`. Only valid Fargate cpu/mem combos.
- Rolling deploys are safe by default (100%/200% — the old task serves until the new one is
  healthy). A DB swap = force new deployment, zero downtime.
- Spot tradeoff (accepted): rare reclaims → ~5–10 min outage while a replacement boots. Flip
  `capacity` to on-demand anytime.
- **Service `domain` has no `redirects` option** (only Router has it) — `aliases` alone would
  serve duplicate content on `www`. A `www`→apex 301 is a hand-made `aws.lb.ListenerRule` on
  the 443 listener (host-header condition).
- **The server's `keepAliveTimeout` must exceed the ALB's `idle_timeout` (60s)** — this is why
  [`server.js`](../server.js) exists instead of `react-router-serve`, which ends in
  `app.listen()` and never exposes the server object. Node's default is 5s, so the ALB would
  keep pooling a connection for 60s that Node closes at 5s; a request dispatched into that gap
  meets a FIN/RST and the ALB answers **502**. Diagnosing it is nasty: sporadic, no app-side
  log line (the request never reaches the process), and visible only as ALB
  `TargetConnectionErrorCount`. It also fails health checks, so ECS kills a task that is
  serving fine in 4ms — and the replacement re-downloads the DB. Verify with
  `Keep-Alive: timeout=65` on any response.
- **[`server.cjs`](../server.cjs) is the entry point, not `server.js`** — React's CJS entry
  picks dev-vs-prod at import time, and ESM static imports are hoisted above any assignment in
  the module body, so `NODE_ENV` has to be set by a CJS shim *before* the ESM graph loads.
  Getting this wrong 500s every page with `dispatcher.getOwner is not a function` while
  `/health` still returns 200. `@react-router/serve`'s own `bin.cjs` does the identical dance.
- **Health check targets `/health`** (`loadBalancer.health`), served straight from Express so
  it can't touch DuckDB. SST's default is `/` — the full homepage — which lets a slow query
  fail the check. Thresholds are asymmetric on purpose (`unhealthyThreshold: 4`,
  `healthyThreshold: 2`): a false kill costs ~6 min, a real crash exits the container anyway.

## Prerequisites

- An AWS account with a profile configured locally (`aws configure --profile <aws-profile>`).
- A Route53 **hosted zone** for `<your-domain>` in that account.
- Docker running on the build machine.
- `sst`, `@aws-sdk/client-ecs`, `@aws-sdk/client-s3` installed (devDeps); `npm run deploy`
  wired to `sst deploy --stage production`.
- Edit `sst.config.ts` for your environment: the `providers.aws` block (profile/region), the
  domain in the `loadBalancer`/service config, and the cron schedule.

## How to deploy

```sh
npm run deploy                        # = sst deploy --stage production

sh deploy/upload-db.sh <db-bucket>    # one-time: upload your local data.duckdb
                                      #   (<db-bucket> is printed in the deploy outputs)

# The service crash-loops until a DB exists in the bucket, then self-heals on its next
# boot (~5–10 min). To force it:
#   aws ecs update-service --force-new-deployment --profile <aws-profile> \
#     --cluster <cluster> --service <service>
```

**First deploy is chicken-and-egg by design:** the service stays unhealthy (502s) until
`deploy/upload-db.sh` puts a DB in the bucket; it then self-heals. Don't debug the 502s
before the upload finishes.

`npx sst dev` runs the app locally with linked AWS resources; plain `npm run dev` keeps
working unchanged (env fallbacks). Cron/Task do **not** fire in `sst dev` — test them on a
deployed stage.

### Repo deploy components (reference)

| File | Role |
|---|---|
| [`sst.config.ts`](../sst.config.ts) | Vpc (no NAT) + Cluster + Bucket + Service (Spot) + Task + Cron; domain on the production stage only |
| [`Dockerfile`](../Dockerfile) | Server image; fetches the s5cmd static binary from GitHub releases (arch-aware via `TARGETARCH`) |
| [`deploy/precompress.mjs`](../deploy/precompress.mjs) | npm `postbuild`: writes `.br`/`.gz` siblings for `build/client/assets/*` so `express-static-gzip` serves them (see *App / build* below) |
| [`deploy/entrypoint.sh`](../deploy/entrypoint.sh) | Boot download of `db/latest` → `/data/data.duckdb`, then `exec` into `npm run start`. Skips the download when `DB_S3_BUCKET` is unset (local `docker run`) |
| [`deploy/upload-db.sh`](../deploy/upload-db.sh) | One-time bootstrap upload of the local DB |
| [`deploy/update-db.ts`](../deploy/update-db.ts) + `deploy/update.Dockerfile` | The scheduled rebuild wrapper (uses `OPD_DB_OUT`/`OPD_TMP_DIR`; no `ingest/*` changes) |
| [`.dockerignore`](../.dockerignore) | Excludes `*.duckdb`, `ingest/build`, `ingest/openparldata`, `.env`, `.git`, `.sst` (the DB was otherwise part of every build context) |

## Update pipeline (scheduled DB rebuild)

`import:remote` already supports everything needed via existing env vars (`OPD_DB_OUT`,
`OPD_TMP_DIR`) — **no `ingest/*` changes**. A wrapper script (`deploy/update-db.ts`) run by
the `sst.aws.Task`:

1. Download the current `data.duckdb` from S3 → local disk (preserves the `import_meta`
   ledger → incremental sync works, unchanged entities skipped).
2. Run `import:remote` with `OPD_DB_OUT`/`OPD_TMP_DIR` on local disk. No runtime limit
   (Fargate task, not Lambda).
3. After a clean finish: assert no `.wal` sidecar, open READ_ONLY + run a sanity query.
4. Upload to S3 under an **immutable key** (`db/data-<runid>.duckdb`) + update a `latest`
   pointer. (Immutable keys prevent a parallel ranged download stitching two object versions
   → corrupt DB.) Keep 2–3 old versions for rollback.
5. Last step: `ecs.UpdateService({ forceNewDeployment: true })` from inside the task. On any
   failure before this, the app keeps serving the old DB.

Schedule = one cron expression (`sst.aws.CronV2`). Add an EventBridge alarm on failed task
exits (nothing retries automatically).

## Estimated costs (eu-central-1, monthly)

Reference sizing: **Spot, 4 vCPU / 16 GB** — 2 vCPU/8 GB made heavy analytics ~4× slower and
blew a 30 s stream timeout; 16 GB lets the DuckDB buffer pool keep hot tables cached.

| Item | Cost |
|---|---|
| App container: Fargate Spot 4vCPU/16GB | ~$59 |
| Extra ephemeral disk (+80 GB) | ~$7 |
| ALB + LCUs | ~$21–23 |
| Public IPv4 ×3 (2 ALB + 1 task) | ~$11 |
| Weekly update task (2vCPU/8GB × 2–6 h) | ~$2–6 |
| S3 (35 GB + 2–3 retained versions) | ~$2–3 |
| ECR, Route53, logs, misc | ~$3–5 |
| Egress (no CloudFront) | ~$0–5 |
| **Total** | **~$105–122** |

Spot prices float ±15%. A 2vCPU/8GB box is ~$75–92. Cost levers: **arm64** (−20% compute
≈ −$12), a 1-yr Compute Savings Plan if on-demand (−20%), and an app-level query cache (would
allow dropping to 2 vCPU ≈ −$30). On-demand at the reference size costs ~$195 (+$135). Boot
download is ~$0.002 in S3 requests (same-region transfer free). DB growth: bump `storage`
(up to 200 GB).

## Query concurrency — two-lane connections (optional, code-only)

Today the app serves **all** queries over one shared DuckDB connection
([`app/server/db/core/db.ts`](../app/server/db/core/db.ts)), and a connection runs one query
at a time — so a multi-second analytics query blocks every other DB-backed request behind it.
Fix (pure code, $0 infra — and it delays ever needing a second container):

- Keep one `DuckDBInstance`, open **2–3 connections**: a "light" lane for lookups/lists and a
  dedicated "heavy" lane for analytics routes (alignment, loyalty, discussion, vocabulary,
  wordfish).
- Queries on different connections run in parallel → light pages never queue behind heavy
  ones. They share the vCPUs and the instance memory limit, so a heavy query slows light ones
  somewhat but no longer blocks them.
- Cap the heavy lane at 1 concurrent query (queue further heavy requests) so two simultaneous
  analytics visitors can't starve the box.
- The same read-only file supports many readers — no DB duplication. If CPU starvation shows
  up, escalate to two `DuckDBInstance`s on the same file with per-instance thread/memory caps.

## Gotchas & lessons learned

### App / build

- **`typia` must be a prod dependency.** unplugin-typia leaves runtime-helper imports in the
  generated validators, so the server bundle imports `typia` at runtime. In devDependencies,
  `npm ci --omit=dev` excludes it and the container crash-loops (`Cannot find package
  'typia'`) — invisible locally where dev deps are always installed. Check after adding
  build-time-only libs: grep `build/server/index.js` for bare imports not in `dependencies`.
- **The repo `.npmrc` (`legacy-peer-deps=true`) must be `COPY`'d into every Docker stage that
  runs `npm ci`** — stages that copy only `package.json` + `package-lock.json` don't see it,
  and `npm ci` fails on the typia peer conflict.
- **Hashed assets are precompressed at build time, served by `express-static-gzip`.**
  [`deploy/precompress.mjs`](../deploy/precompress.mjs) runs as npm `postbuild`, so it rides
  inside the `build-env` stage's `npm run build` (no Dockerfile change) and writes `.br`
  (Brotli q11) + `.gz` siblings next to `build/client/assets/*`. [`server.js`](../server.js)
  serves the best variant the client accepts — Brotli **from disk** vs the `compression()`
  middleware's on-the-fly **q4** — and falls back to the raw file + on-the-fly gzip when no
  sibling exists (sub-1KB assets) or no `Accept-Encoding` is sent; serving a `.br`/`.gz` sets
  `Content-Encoding`, which `compression()` detects and skips (no double-encoding). Only the
  immutable `/assets` dir is precompressed — mutable `public/` + locales keep on-the-fly
  compression. `express-static-gzip` is a **prod dependency** (same `--omit=dev` trap as
  typia above); the `.br`/`.gz` files reach the runtime image via the existing
  `COPY --from=build-env /app/build`.
- **Locales are read from the filesystem, not self-HTTP.**
  [`get_static_data.server.ts`](../app/server/static/get_static_data.server.ts) reads
  `public/locales` in dev and `build/client/locales` in prod (react-router build copies
  `/public` there). Fetching the site's own public URL in a loader deadlocks the first boot
  (health check → loader → fetch of a not-yet-healthy domain).
- **`.dockerignore` matters at tens of GB:** keep `*.duckdb`, `ingest/build`,
  `ingest/openparldata`, `.env`, `.git`, `.sst` excluded, or the DB joins every build context.
- **`tsconfig.json` must exclude `.sst` and `sst.config.ts`** — SST's platform sources don't
  conform to this repo's strict flags (`verbatimModuleSyntax`, `exactOptionalPropertyTypes`)
  and can even cause phantom type errors elsewhere via global type pollution. Validate the SST
  config standalone: `npx tsc --noEmit --skipLibCheck --target es2022 --module es2022
  --moduleResolution bundler --strict sst.config.ts`.

### SST / AWS

- **`sst.aws.Cron` is deprecated → `sst.aws.CronV2`** (same args: `task`, `schedule`;
  EventBridge Scheduler under the hood).
- **Data-source invokes race fresh deploys:** `aws.lb.getListenerOutput` can fire at deploy
  start, before the listener exists → `no matching ELBv2 Listener found`. Fix: pass
  `{ dependsOn: [web] }` (InvokeOutputOptions, Pulumi ≥3.132).
- **s5cmd's Docker Hub image (`peak/s5cmd`) no longer exists** — fetch the static binary from
  GitHub releases in the Dockerfile (arch-aware via `TARGETARCH`).
- **Domain transfer between AWS accounts ≠ DNS transfer.** Moving a Route53 *registration* to
  another account leaves the hosted zone behind — create a new zone in the deployment account
  and repoint the NS records. (A broken `output=<region>` in `~/.aws/config` can also make the
  CLI crash *after* the transfer API call succeeds, swallowing the one-time transfer password;
  cancel + re-initiate to get a new one.)

### Build machine

- **Disk pressure breaks everything indirectly:** a near-full root partition makes SST's
  BuildKit builder time out (`booting builder: context deadline exceeded`) and fills `/tmp`.
  Remedy: `docker builder prune -af`, remove stale buildx builders, pre-pull
  `moby/buildkit:buildx-stable-1`.
- **arm64 vs x86_64:** without arm64 binfmt, images build as `x86_64` (~+$6–8/mo vs ARM Spot).
  To build arm64: `docker run --privileged --rm tonistiigi/binfmt --install arm64`, then set
  `architecture: "arm64"` in `sst.config.ts`.

### Operations

- **Timings to expect:** a tens-of-GB DB download at container boot ≈ 4 min; a code deploy
  end-to-end ≈ 8–12 min (image build ~2–4 min + boot ~6 min), zero downtime — the old task
  serves until the new one passes health checks. A deploy also picks up the newest DB snapshot
  as a side effect.
- **URL scheme gotchas for smoke tests:** English is the default language at the *root* (no
  `/en/` prefix — `/en/...` 404s are expected); bodies live under `/parliaments`. A good
  heavy-page check is a body alignment page (e.g. `/parliaments/<id>/alignment`), which should
  return in ~local-disk time (a couple of seconds).

## Verification

- Build the image locally and run it with a downloaded DB: `curl localhost:5555`, then hit a
  heavy page (a body alignment page) and confirm it completes.
- `sst deploy --stage staging`: the task boots, downloads within the grace period, ALB goes
  healthy.
- Trigger the update Task manually once; confirm the zero-downtime rollover.
- Kill the task to simulate a Spot reclaim: it self-heals in ~5–10 min.

## Future levers (not now)

- **App-level query cache** for heavy analytics — the biggest cost/perf lever, would allow
  1 vCPU.
- A Compute Savings Plan (−20%) if switching to on-demand.
- EBS-from-snapshot per task when the DB approaches ~100 GB.
