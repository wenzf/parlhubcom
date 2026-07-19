# Traffic statistics

Public request statistics for the site itself, at
[`/project/traffic-stats`](../app/routes/pages/project/traffic_stats/traffic_stats.tsx).
No cookies, no tracking, no IP addresses — the numbers come from the server's own
request log, and they count **requests, not people**.

## Pipeline

```
server.js (morgan + :user-agent)
   → CloudWatch log group           30-day retention, then gone forever
   → Analytics task, daily 02:10 UTC (deploy/analytics.ts)
       → analytics/daily/<date>.json    FACTS — immutable, raw user-agent
       → analytics/summary.json         VIEW  — derived, classified, public
   → the page fetches summary.json (1h TTL, ~/server/analytics/summary.server.ts)
```

(The log group is nominally the pinned `/parlhub/web`, really the SST-generated
`/sst/cluster/…/Web` — see the `LOG_GROUP` note under *Running it locally*.)

## The page

The whole view state lives in the URL, so a copied link reproduces the exact
chart/table: `?group=` (route/lang/visitor/device), `?audience=` (human/bot/both,
default human — bots outnumber humans enough to bury them in a combined view),
`?health=1` (include ALB health checks), `?sort=` (table order, `-` prefix =
descending, default `-reqs`). Defaults are never written, so the bare URL stays
canonical. The split into humans/bots happens client-side off the visitor labels
(`visitorGroup`/`scopeCube` in `~/lib/analytics/cube`) — no schema involvement.
The table sorts via the APG pattern: a real `<button>` per header, `aria-sort` on
the `<th>`, 44px targets.

## The four things that matter

- **The daily task is the archive.** CloudWatch deletes the raw logs after 30 days,
  so a day that is never aggregated is lost permanently. The task backfills any
  missing day inside `LOOKBACK_DAYS`, so one failed run repairs itself.

- **Facts vs view.** Daily files store the **raw user-agent** and no interpretation.
  Classification (`~/lib/analytics/agents`) happens only when `summary.json` is
  rebuilt — so a new crawler can be named later and the whole history re-derives.
  Had the dailies stored `bot:other`, that bot would be anonymous forever.

- **Measures must be additive**, because the page pivots client-side
  (`~/lib/analytics/cube`). Store `sum_ms` (avg is `sum_ms / reqs`) and histogram
  buckets (p95 is read off them). An average of averages, or a stored p95, is wrong
  the moment anyone filters.

- **No data → say so.** When `summary.json` is absent or unreachable the page
  renders "no figures yet". It never substitutes sample numbers: this is a public
  statistics page, and a disclaimer does not make invented figures acceptable.

## Gotchas

- **`isbot` detects, it does not name.** Its list is 205 heuristics — `CensysInspect`
  and `libredtail-http` match the same pattern, and `isbotMatch()` returns fragments
  like `"Bot"`. Use it for bot-or-not; names come from `BOT_NAME` in `agents.ts`.
- **One S3 key is public**: `analytics/summary.json`, pinned via `paths` in
  `sst.config.ts`. Never use SST's `access: "public"` — it grants `s3:GetObject` on
  `${bucket.arn}/*`, i.e. the DB snapshots and the raw-user-agent dailies too.
- **`Intl` needs an explicit locale.** The server runs `de-DE`, so
  `NumberFormat(undefined)` renders German separators on the English page and
  mismatches on hydration (React #418 — see [edge-cases.md](edge-cases.md)). The
  page threads `lang_code` through from the loader.
- **`ARCHIVE_START`** floors the backfill at the day the user-agent entered the log
  format. Earlier days parse to zero rows, and an immutable "no traffic" file for a
  busy day is a permanent lie. Never move it backwards.
- **Unknown routes fold into `(other)`.** The route dimension is the URL's first path
  segment, so random top-level paths — a scanner probing `/wp-login.php`, a mistyped
  URL, a 404 sweep — would each be a distinct route and grow `summary.json` without
  bound. `rebuildSummary` keeps a known-route set (DERIVED from `PAGE_CONFIG` first
  segments + the root resource routes / `/health`) and folds everything else into a
  single `(other)` bucket, so junk paths cost one row no matter how many are tried.
  Folded in the VIEW only — the daily facts keep the raw route, so the set can change
  and the archive re-derives. The label is explained on the page (`route_other_note`).
  `(other)` rows also get language `na` (the device dimension's not-applicable value):
  the query's prefix fallback parses junk paths as "en", which would silently inflate
  English in the language view.
  The query's language-prefix stripping is derived from `SITE_LANGS` for the same
  reason: a `/pt/…` request must reduce to its real route, not fall into `(other)`.

## Running it locally

The page and the aggregator are **separate paths, and only the aggregator touches AWS
credentials** — so an empty `/project/traffic-stats` in dev is almost never an
access-rights problem.

- **The page never authenticates.** `loadSummary`
  ([summary.server.ts](../app/server/analytics/summary.server.ts)) is a plain
  `fetch()` of the one public S3 key — no AWS SDK. It returns `null` the moment
  `ANALYTICS_SUMMARY_URL` is unset, which is the default under `npm run dev` (the var
  is set only on the deployed Web service, `sst.config.ts`). So the dev page renders
  "no figures yet" **before any network call** — expected, not a failure.

- **To view the real cube in dev**, point the var at the public object (data appears
  only if `summary.json` already exists and is non-empty):

  ```bash
  ANALYTICS_SUMMARY_URL="https://<DbBucket>.s3.eu-central-1.amazonaws.com/analytics/summary.json" npm run dev
  ```

  The bucket name is the `bucket` output of `npx sst deploy` (SST appends a random
  suffix), or read it from the S3 console.

- **To generate the archive from your machine** (what the daily Fargate task does),
  run the aggregator directly. It uses the default AWS credential chain, so with SSO
  the profile + region must reach the SDK — `new S3Client({})` /
  `CloudWatchLogsClient({})` carry neither:

  ```bash
  aws sso login --profile <profile>          # refresh temporary creds first
  AWS_PROFILE=parlhubcom AWS_REGION=eu-central-1 \
  DB_S3_BUCKET=<DbBucket> LOG_GROUP="<group>[,<group>]" \
  npx tsx deploy/analytics.ts
  ```

  `LOG_GROUP` is a comma-separated list; names that don't exist are skipped with a
  warning, and one Insights query runs over the rest. NOTE the pinned `/parlhub/web`
  is aspirational: the deployed SST version ignores `logging.name` on a Service, so
  the web app really logs to the generated `/sst/cluster/<cluster>/<service>/Web`
  group (`aws logs describe-log-groups` lists it; sst.config.ts carries it as
  `WEB_LOG_GROUP_LEGACY`). Passing both, as the task env does, always works.

  Failure modes: no `AWS_PROFILE` → `CredentialsProviderError`; no `AWS_REGION` →
  `Region is missing`; an expired session → re-run `aws sso login`.

- **IAM the run needs** — mirror the Analytics task role (`sst.config.ts`); a
  read-only SSO permission set will `AccessDenied`:
  - `logs:StartQuery` on the log-group ARNs (`…:log-group:<group>:*`, both names)
  - `logs:GetQueryResults`, `logs:StopQuery`, `logs:DescribeLogGroups` on `*`
    (a query id is not an ARN; DescribeLogGroups is the startup existence check)
  - `s3:ListBucket` on the DbBucket + `s3:GetObject`/`s3:PutObject` on its
    `analytics/*` keys (the deployed task gets this from `link: [dbBucket]`; an SSO
    user may not).

- **Empty result ≠ broken.** The run only aggregates *finished* days `>= ARCHIVE_START`
  (never today). If `/parlhub/web` logged no traffic on any such day, the query yields
  zero rows and an empty `summary.json` is written — the page still, correctly, shows
  "no figures yet".
