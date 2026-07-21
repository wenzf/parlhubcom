# parlhub

A portal for the Swiss and Liechtenstein parliaments: [parlhub.com](https://parlhub.com).

parlhub displays and visualizes data from [OpenParlData.ch](https://openparldata.ch/). Data 
dimensions are: **people** (MPs), **groups** (parties/fractions),**bodies** (councils & committees),
**affairs** (legislative business), **votings**, **speeches**, **docs/texts**, **meetings**,
**organizations** and **interests** (lobbying ties).

Aside of displaying data in tables, also some analytics are done: voting **alignment**, party
**loyalty**, **lobby** connections, **topics**, **vocabulary** (word-frequency maps of a
person's speeches) and co-voting neighbours. So you can ask "who votes like whom?", not
just "how did X vote?".

Seven interface languages (en/de/fr/it/es/pt/rm), server-rendered, WCAG 2.2 AAA.

## Tech stack

- **[React Router v8](https://reactrouter.com/)** (framework mode): SSR, loaders, one Node server.
  React 19, Vite 8, Node 24
- **[DuckDB](https://duckdb.org/)** (`@duckdb/node-api`): a single `data.duckdb` file opened **read-only**. All analytics are SQL plus a bit of TypeScript post-processing
- **Tailwind CSS v4** with shadcn components on [Base UI](https://base-ui.com/) primitives
  (`base-mira` style, lucide icons), monochrome WCAG AAA design (see `docs/styleguide.md`)
- **typia** (build-time codegen) + **zod** for validation. The client bundle is eval-free to satisfy a strict nonce-based CSP
- **WebMCP** (`@mcp-b/react-webmcp`): data pages register their filters and exports as MCP tools,
  so a browser agent can drive them
- **SST v4** for AWS deployment (Fargate, ALB, S3, EventBridge), optional. Any Docker host works

## Architecture in one paragraph

The app never writes data. A separate **ingest** step (`ingest/`) downloads NDJSON exports
from OpenParlData, validates them and builds `data.duckdb`. The web app opens that file
read-only and serves everything from it. Updating data = build a new DB file, swap it,
restart the server. This keeps the runtime simple: no migrations, no write locks, trivially
cacheable.

```
OpenParlData exports (.ndjson.gz)
        │  npm run import:remote
        ▼
  data.duckdb  ──read-only──▶  React Router app (SSR, port 5555)
```

## Getting started

### Prerequisites

- **Node.js 24+**
- ~40 GB free disk and a decent connection for the full dataset (a partial import works too, see below)

`npm install` just works: the repo ships an [`.npmrc`](.npmrc) with `legacy-peer-deps=true`
(typia is pinned to v11 for unplugin-typia compatibility, which conflicts with some peers
under npm's strict resolver).

### 1. Install

```bash
npm install
```

### 2. Build the database

The dev server needs a `data.duckdb` at the repo root. Build it by streaming the public
OpenParlData exports (fetch → gunzip → validate → append, flat RAM usage):

```bash
npm run import:remote
# writes to ingest/build/data.duckdb, swap it in when done:
mv ingest/build/data.duckdb data.duckdb
```

The import is **incremental and resumable**: entities already up to date (size + row count
match the `import_meta` ledger) are skipped, and a crashed run resumes where it left off.
You can interrupt it and start the app with whatever has been imported so far. Pages whose
tables are missing will just error. Environment knobs:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPD_EXPORTS_URL` | `https://files.openparldata.ch/exports` | Export bucket to stream from |
| `OPD_DB_OUT` | `ingest/build/data.duckdb` | Output DB path |

There is also `npm run import` for building from local `*.ndjson(.gz)` files in
`ingest/openparldata/`. The dataset registry (table ↔ source ↔ sort/index strategy) lives
in [`ingest/datasets.ts`](ingest/datasets.ts).

### 3. Run the dev server

```bash
npm run dev
```

The app runs at `http://localhost:5555` (the port is pinned with `strictPort`).

### Other scripts

```bash
npm run typecheck     # react-router typegen + tsc
npm run build         # production build → build/
npm run start         # serve the production build on port 5555
npm run verify:metas  # assert the SEO "metas" loc keys match META_KEYS in every language
npm run verify:safehref  # assert links go through the safe-href helpers
npm run test:a11y     # pa11y-ci accessibility run
npm run deploy        # sst deploy --stage production
```

## Project structure

```
.
├── app/
│   ├── routes/                 # React Router routes (wired in routes.ts)
│   │   ├── layouts/            # lang, data-dashboard, per-entity result & project layouts
│   │   ├── pages/              # opd/ (data pages), project/, experiments/, start/
│   │   └── sitemap/            # sitemap.xml routes
│   ├── server/                 # server-only code
│   │   ├── db/
│   │   │   ├── core/           # DuckDB connection (read-only, DB_PATH env)
│   │   │   ├── sql/            # one .sql file per query, grouped by entity
│   │   │   └── analytics/      # TS post-processing (MDS projection, alignment, vocabulary, …)
│   │   ├── static/             # filesystem loader for public/locales
│   │   ├── sitemap/            # sitemap registry + builder
│   │   └── export/             # bulk data-export route handler
│   ├── components/
│   │   ├── blocks/             # site chrome (header, sidebar, breadcrumbs)
│   │   ├── opd_views/          # per-entity views
│   │   ├── data_map/           # the interactive data map
│   │   ├── icons/
│   │   └── ui/                 # shadcn primitives on Base UI
│   ├── configs/                # page registry (site.config), sidebars, content-language config
│   └── lib/
│       ├── seo/                # metas/ (title/description/OG/hreflang), jsonld/, breadcrumbs, sitemap
│       ├── security/           # sanitize + headers/ (CSP, header scrubbing)
│       ├── dimensions/         # filter/facet descriptors shared by the data views
│       └── analytics/ domain/  # smaller shared helpers
│           export/ urls/
│           std/ webmcp/
├── public/locales/             # UI translations (en/de/fr/it/es/pt/rm), from the filesystem
├── localization/               # translator-facing mirror of public/locales (*.meta.json)
├── types/                      # OpenParlData row types (client + db) and site types
├── ingest/                     # DB build pipeline (decoupled from the app)
├── deploy/                     # container entrypoint, DB update task + its Dockerfile, upload-db.sh
└── docs/                       # contributor docs: conventions, domain, style guide, edge cases,
                                #   localization, data import, security, AWS, traffic stats
```

The `docs/` folder is the deep documentation for this codebase. Start with
[`docs/domain.md`](docs/domain.md) and [`docs/conventions.md`](docs/conventions.md).

### Localization

The active UI language comes from the `:lang?` URL param (`en` is the default and carries no
prefix; `de`/`fr`/`it`/`es`/`pt`/`rm` do). UI strings live in `public/locales/<lang>/*.json` and
are read from the filesystem in loaders. Separately, **content language** is an ordered fallback
list the SQL uses to pick which language a data field shows in (a record may exist in de but not
fr). Its selectable set is `de/fr/it/rm/en`, so it is not the same list as the UI languages.
Details in [`docs/conventions.md`](docs/conventions.md) and [`docs/localize.md`](docs/localize.md).

### Security & accessibility

- Strict nonce-based CSP in dev **and** prod: no `unsafe-eval`, no runtime JIT/schema
  compilers in the client bundle ([`docs/security.md`](docs/security.md)).
- Everything targets WCAG 2.2 **AAA**: ≥7:1 text contrast, 44×44px targets, full keyboard
  operability ([`docs/styleguide.md`](docs/styleguide.md)).

### Crawling & bots

[`robots.txt`](app/routes/sitemap/robots.tsx) allows everything except the settings action
and the bulk-export download routes, and sets **`Crawl-delay: 3`** (seconds between
requests). Rationale: bots account for the overwhelming share of traffic (see
[/project/traffic-stats](https://parlhub.com/project/traffic-stats)), and the site runs on
a single DuckDB-backed container — an unpaced crawler burst on the heavy analytics pages
degrades response times for everyone. The delay is advisory: Bing and most polite crawlers
honor it, Google ignores it (Google's rate is set in Search Console), and abusive bots
ignore robots.txt altogether.

## Deployment

### Docker (any host)

```bash
docker build -t parlhub .
docker run -p 5555:5555 -v /path/to/data.duckdb:/data/data.duckdb \
  -e DB_PATH=/data/data.duckdb parlhub
```

The container's [`deploy/entrypoint.sh`](deploy/entrypoint.sh) downloads the DB from S3 at
boot when `DB_S3_BUCKET` is set; with a mounted `DB_PATH` that step is skipped. The image
runs on anything that speaks Docker (Cloud Run, Fly.io, a VPS, …). The only requirements
are the env vars below and enough disk/RAM for the DB (~35 GB file; 8–16 GB RAM recommended,
DuckDB parallelizes across all cores you give it).

| Variable | Purpose |
| --- | --- |
| `DB_PATH` | Path to `data.duckdb` (default: `data.duckdb` in the workdir) |
| `DB_S3_BUCKET` | Optional: S3 bucket to download the DB from at boot |
| `DUCKDB_MEMORY_LIMIT` | Optional: cap the DuckDB buffer pool (e.g. `10GB`) |
| `DUCKDB_TMP` | Optional: DuckDB spill directory |

### AWS via SST (how parlhub.com runs)

[`sst.config.ts`](sst.config.ts) defines the full production setup in `eu-central-1`. Design
notes and cost breakdown: [`docs/aws-deployment.md`](docs/aws-deployment.md).

| AWS resource | Role |
| --- | --- |
| **VPC** | Public subnets, **no NAT**, so the 35 GB boot download goes S3 → internet gateway → task for free |
| **ECS Fargate** cluster + service | The app container: 4 vCPU / 16 GB / 100 GB ephemeral disk, **Spot**, 1 task |
| **ECR** | Image registry for the `Dockerfile` build that SST pushes |
| **ALB** (+ **ACM**, **Route 53**) | `80` → `443`, `443` → container `5555`, plus a listener rule 301ing `www` to the apex |
| **S3** | Immutable DB snapshots (`db/data-<stamp>.duckdb`) plus the `db/latest` pointer object |
| **EventBridge** cron → **ECS task** | Mondays 03:00 UTC: rebuild the DB (2 vCPU / 8 GB), upload it, then roll the service ([`deploy/update-db.ts`](deploy/update-db.ts)) |

Notable details: the service gets a 900 s health-check grace period so the ALB can't kill a
task mid-download, and a failed weekly rebuild simply leaves the app on the previous snapshot.

```bash
# one-time: upload an initial DB so the first deploy can go healthy
sh deploy/upload-db.sh <bucket-name>

npx sst deploy --stage production   # or: npm run deploy
```

You'll need your own AWS profile/region (edit the `providers.aws` block in
`sst.config.ts`) and your own domain in the `loadBalancer` config.

## Contributing

- `npm run typecheck` must pass.
- UI changes must hold the AAA bar (contrast, target size, focus, keyboard). The style
  guide has concrete recipes.
- Any `public/locales/**` change must be mirrored in [`localization/`](localization/); SEO
  copy changes must keep `npm run verify:metas` green.
- Data-shape gotchas (Liechtenstein has no harmonized party ids, some bodies lack
  vote-time group snapshots, …) are catalogued in [`docs/edge-cases.md`](docs/edge-cases.md).
  New analytics must tolerate them.

## Data source & license

All parliamentary data comes from [OpenParlData](https://openparldata.ch/), which collects
and harmonizes open data from the parliaments of Switzerland and Liechtenstein.
