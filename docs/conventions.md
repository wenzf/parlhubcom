# Conventions & structure

## Localization of texts

- **URL-driven**: the active language comes from the `:lang?` route param (URL
  structure), resolved via helpers in [`app/lib/lang.ts`](../app/lib/lang.ts)
  (`langByParam`, `resolveLangs`, `localizedPath`, `langSwitcher`, …). The default
  language carries **no** prefix — see *Language route structure* below before touching
  routes or links.
- **Loading**: localized text fragments live in `/public/locales/<lang>/<loc>.json`
  and are read **from the filesystem** per namespace by
  [`getStaticData`](../app/server/static/get_static_data.server.ts) in loaders —
  `public/locales` in dev, `build/client/locales` in prod (react-router build
  copies `/public` into `build/client`). Never load them by HTTP-fetching the
  site's own URL: in a container that deadlocks the first boot (health check →
  loader → fetch of a not-yet-healthy domain).
- **Lookup**: build a `t(key)` with `makeT(loc)` (from `lang.ts`) — returns
  `loc[key]`, falling back to the key itself when unlocalized.
- **Data-driven labels**: a label that must name what it describes (chart `aria-label`s
  carrying counts / scope / window) is a **tokenized template**, same shape as the SEO
  copy: flat `{token}` string in JSON, grammar in TS, filled with `t(key, vars)`
  (`makeT`'s optional second arg → `substitute`). Optional parts do **not** fork the
  copy into sibling keys per combination: they join into one trailing `{ctx}` fact list
  built by `chartCtx()`
  ([`_shared/chart_alt.ts`](../app/components/opd_views/_shared/chart_alt.ts)), which
  uses punctuation the cards already use and so needs no localizing.

### Language route structure

- **The default language has no prefix.** `SITE_LANGS[0]` is `en` with
  `lang_param: ''` ([`site.config.ts`](../app/configs/site.config.ts)) — so English is
  `/people`, German `/de/people`. **There is no `/en/*`.** `params.lang === undefined`
  therefore means *English*, not "missing" — never treat it as an error or default it to
  `de`. Only `de`/`fr`/`it`/`es`/`pt`/`rm` appear as prefixes.
- **One optional prefix wraps everything**: `prefix(':lang?', [...])` in
  [`routes.ts`](../app/routes.ts). Every page consequently has two URL forms per
  language, and `:lang?` shifts the position of every other param — a path is
  `/:lang?/people/:id`, never `/people/:id`.
- **Three registration tiers** (getting this wrong is the usual bug):
  1. *Outside `:lang?`* — `robots.txt`, `sitemap.xml`, `/sitemaps/:file`, `carbon.txt`,
     `llms.txt`, the devtools probe, `actions/cu-settings`. Specs mandate one file at
     the domain root; there is no per-language variant. (`llms.txt` builds its links
     from `PAGE_CONFIG` via `absoluteLocalizedUrl` — adding a page there means adding
     its row in `routes/sitemap/llms_txt.ts`.)
  2. *Inside `:lang?`, sibling of `lang_layout`* — the `*_export` resource routes
     (loader-only). Deliberate: a download must run only its own loader, not the
     chrome's locale loaders. Note the flip side — the unsupported-lang guard lives in
     the layout (below), so it does **not** cover these.
  3. *Inside `lang_layout`* — every real page.
- **The 404 for a bad prefix is in the layout, not the router**: `langByParam` never
  throws — an unknown param returns the default entry flagged `is_fallback`, and
  [`lang_layout`](../app/routes/layouts/lang_layout.tsx) turns that into a 404. A loader
  that calls `langByParam` outside that layout silently renders English for `/xx/…`.
- **Never hardcode a path.** Segments come from `URL_PATH_SEGMENTS`, full paths from
  `PAGE_CONFIG.*.absolute_path` (both in `site.config.ts`). Segment ≠ route filename:
  `BODIES: "parliaments"`, so the `bodies_*` route files serve `/parliaments/:id`.
- **Which helper** (all in [`lang.ts`](../app/lib/lang.ts)):
  - `localizedPath(lang, NS_KEY, params)` — **the default for links.** Resolves the
    `PAGE_CONFIG` path, fills `:id`-style params, applies the prefix.
  - `langSwitcher(param, path, targetLang)` — only the language switcher: rewrites the
    prefix on the *current* path, handling the empty-param default both ways.
  - `createLangPathByParam(lang, fragment)` — a raw fragment not in `PAGE_CONFIG`;
    prefer `localizedPath`.
  - `langByParam(param)` → the `SITE_LANGS` entry (`lang_code` for `getStaticData`,
    `lang_html` for `<html lang>`); `resolveLangs`/`resolveContentLangs` → the SQL
    `loc()` priority, a different axis (see below).

### Three language axes (don't conflate)

- **UI lang** — the interface chrome (labels, buttons). From the `:lang?` URL param;
  loaded from `/public/locales/<lang>/`; looked up with `t()`. One language.
- **Content lang** — the priority order the SQL `loc()` uses to pick which language a
  *data* field shows in (a record may have de but not fr). An ordered fallback list,
  defaulted per UI lang in [`content_langs.config.ts`](../app/configs/content_langs.config.ts)
  (general default de-first) via `resolveLangs`/`resolveContentLangs`.
- **Export lang** — the content-lang priority for a *download*, chosen per-export in the
  `<DataExport>` menu (seeded from the same config) and sent as `?langs=` to the export
  route. Only affects server/bulk exports.

## Page config, breadcrumbs & sidebars

- [`site.config.ts`](../app/configs/site.config.ts): `PAGE_CONFIG`, the `NS_*`-keyed
  page registry — `absolute_path`, `data_section`/`data_sub_section`, `handle`
  (breadcrumbs) and `sidebar` header per page. Routes wire in with
  `export const handle = PAGE_CONFIG.NS_X.handle`; layouts read matched handles via
  `useMatches()` ([`use-breadcrumbs-by-handle.ts`](../app/hooks/use-breadcrumbs-by-handle.ts),
  [`use-sidebar-data.ts`](../app/hooks/use-sidebar-data.ts)).
- **Labels** (breadcrumbs + sidebar) resolve via `data_origin` (source namespace) +
  dotprop `data_key` — either a loc string (`locs.*`) or live entity data (`data.body.name`).
  A crumb resolves only if a *matched* route (usually a **layout**) with that `page_key`
  is in the current tree — data pages source their static labels from the
  `NS_DATA_DASHBOARD_LAYOUT` loader (`loc_data_dashboard`). Pages **outside** that layout
  (e.g. the `/project/*` section under `project_layout`) must point `data_origin` at a
  layout they *do* sit under — `NS_LANG_LAYOUT` (`loc_main.nav`); pulling a static label
  from the leaf route's own loader is unreliable, so prefer a layout loc source.
- **Sidebar item lists** live in [`sidebars.config.ts`](../app/configs/sidebars.config.ts);
  each item's `data_section`+`data_sub_section` must match a handle to highlight. Its
  `IconMap` translates a page's `icon_namespace` into a sprite `IconName` — and is typed
  `Record<string, IconName>` against a `string` namespace, so a namespace with **no**
  `IconMap` entry type-checks fine and renders `<use href="#opd-undefined" />`, a blank
  icon. Adding an `icon_namespace` means adding its `IconMap` row in the same change.
- **Sub-feed entries are generated, not written.** The 34 `/{section}/:id/{leaf}` feeds
  come from `feedPage(page_key, section, absolute_path, data_sub_section, opts?)` over the
  per-section `FEED_SECTIONS` table (index/overview crumb keys, sidebar icon + title, and
  `is_primary_data_match` — a *section* property, not a per-page one). Only genuine
  deviations are arguments: `leaf_loc` where the crumb key ≠ the `data_sub_section`
  (`NS_GROUPS_VOTINGS` is sub-section `votes` but reads the `votings` crumb), `subtitle`
  for the one page that names itself rather than its record (`NS_BODIES_DISCUSSION`).
  Indexes, overviews and the one-off pages stay hand-written literals.
- **New route**: add the `PAGE_CONFIG` entry — a `feedPage(…)` call for a data sub-feed, a
  literal for anything else — export its `handle`, add the sidebar item +
  `locs.sidebar.labels` key.

## Route modules

- **Dashboard labels + locale**: any page under `data_dashboard_layout` reads them from
  [`useDashboardLoc()`](../app/hooks/use-dashboard-loc.ts) — never re-read
  `useRouteLoaderData("routes/layouts/data_dashboard_layout")` inline. That block stood
  copy-pasted, with the layout's shape retyped, in ~40 components; the route id is a
  string, so a layout rename degrades silently to `{}` + `"de-CH"` rather than failing the
  build. The hook also settles the locale fallback: the UI language (`fr` → `"fr-CH"`),
  and only `"de-CH"` when there is no language at all.
- **Pagination offset**: parse with `parseOffsetParam(raw, limit) ?? 0`
  ([`lib/urls/params.ts`](../app/lib/urls/params.ts)). Offsets are **grid-only** — one
  that is not a multiple of `limit` is rejected and falls back to the first page, so
  paginated URLs stay canonical. Don't hand-roll `Number(…)`: that fork previously let
  ~25 routes serve off-grid pages while 14 rejected them.
- **Export routes** are already factored over `makeExportLoader` (a registry + one call) —
  follow that shape rather than copying a sibling wholesale.

## WebMCP (in-browser agent tools)

Data pages expose themselves to browser agents as MCP tools via `@mcp-b/react-webmcp`.
The polyfill (`@mcp-b/global`) is mounted **once** at the client root
([`webmcp_polyfill.client.ts`](../app/lib/webmcp/webmcp_polyfill.client.ts), imported from
`entry.client.tsx`) — never inside a component. Two registration paths, both in play:

- **Imperative** (`useWebMCP` / `useWebMCPContext`) — the runtime tools:
  [`DimensionMcpTools`](../app/components/opd_views/controls/DimensionMcpTools.tsx)
  (`<base>_filter` action + `<base>_query_state` read, per dimension),
  [`DataExportMcpTool`](../app/components/opd_views/_shared/DataExportMcpTool.tsx)
  (`<segment>_export`), and
  [`HomeSearchMcpTool`](../app/components/blocks/HomeSearchMcpTool.tsx) (`home_search`).
  These call hooks unconditionally, so the parent **must** gate them on a client `mounted`
  flag (`{mounted && …}`); they render nothing and register **after hydration**.
- **Declarative** — `toolname` / `tooldescription` attributes on a real, server-rendered
  `<form>`: the home search `<Form>` ([`home.tsx`](../app/routes/home.tsx)) and every feed's
  search form ([`DimensionControls`](../app/components/opd_views/controls/DimensionControls.tsx)).
  The attributes typecheck via the `FormHTMLAttributes` augmentation in
  [`types/webmcp.d.ts`](../types/webmcp.d.ts). Only tools that map to an actual `<form>` can
  be declarative — the read (`_query_state`) and export (`_export`) tools stay imperative-only,
  and non-searchable dimensions (e.g. person images) render no form.

- **Name invariant**: a declarative form's `toolname` **must equal** its imperative twin
  (`<base>_filter`). Both derive the base from `dimensionToolBase(dimension, namespace)`
  ([`lib/dimensions/filters.ts`](../app/lib/dimensions/filters.ts)) — `FeedShell` hands the
  **same** `mcpNamespace` to `DimensionControls` and `DimensionMcpTools`, so they can't drift.
  Never hand-format the name in one place. `namespace` disambiguates the same dimension
  across contexts (a person's votes vs. the top-level `catalog` votes).

- **Lighthouse "agentic browsing" audits ≠ a health check on this code.** They detect tools
  by observing Chrome's **native** WebMCP registration events (CDP), which is behind an
  **origin trial** (Chrome ~146+) and **off in a normal browser**. So in ordinary Chrome the
  audits read "Not applicable" no matter what the site registers — the imperative tools live
  only in the JS polyfill (invisible to that channel) and the declarative attributes are inert
  until a native browser parses them. This is expected, not a bug; don't try to "fix" it in
  app code. The declarative annotations are the server-rendered path a native browser picks up
  without running our JS, so they're what lights the audits up once tested on a WebMCP-enabled
  Chrome. The audits are informational (unscored) regardless.

## SQL (`app/server/db/sql/`)

- **Macros first.** [`macro_loc.sql`](../app/server/db/sql/macro_loc.sql) is applied on
  every connection by every runner (all `CREATE OR REPLACE TEMP MACRO`, so it is
  idempotent) — anything defined there is available to every query for free:
  - `loc(v_de, v_fr, v_it, v_rm, v_en, l1..l5)` — the localized field picker (the *content
    lang* axis above); `loc_lang(…)` is its companion, returning which variant `loc()` took.
  - `sibling_ids(pid)` — the person-scope set (one person may be several identity rows).
  - `body_struct(b, l1..l5)` — **the** body projection. Pass the row itself
    (`body_struct(b, $2, $3, $4, $5, $6) … FROM bodies b`; an unaliased table name and a
    CTE both work) plus the caller's own language slots, so the list family's `$1..$5` and
    the by-id family's `$2..$6` both fit without the macro caring. Valid standalone and
    inside `list(body_struct(b, …) ORDER BY …)`.
- **Never inline an entity projection.** The body struct previously stood duplicated in 45
  places across 44 files — identical but for whitespace — so adding a `bodies` column was a
  45-site edit. If another entity's projection starts spreading, give it a `*_struct` macro
  rather than a 46th copy.
- Duplication **between query bodies** is fine and usually clearer: `body_votings_by_id.sql`
  and `group_votings_by_id.sql` differ in real scoping logic and should not be merged. It is
  the repeated *column lists* that belong in a macro.
- `/* __ORDER_BY__ */` is a placeholder the runner fills from a whitelist. When running a
  query by hand, note that a stand-in `ORDER BY 1` leaves ties unordered — the same query
  then returns rows in a different order run to run, which will look like a diff.

## Meta tags (SEO)

- Route `meta()` exports build data-driven title/description/canonical/OpenGraph +
  `hreflang` via builders in [`app/lib/seo/metas/`](../app/lib/seo/metas/) (barrel:
  `~/lib/seo/metas`). `core.ts` = engine (`buildMeta`), `factory.ts` =
  `makeOverviewMeta`/`makeDimensionMeta`/`makeIndexMeta`, one file per entity = facts
  resolver + key-selection + token substitution (logic only — **no localized prose**).
  All three factories take a **required** `copyPrefix` and read their copy from the loc
  namespace, so the no-prose-inline rule below is structural, not a convention to remember.
- **SEO copy lives in the `"metas"` block of the locale namespace a route's subtree
  already loads**, NOT inline in `metas/*.ts`. Entity pages sit under
  `data_dashboard_layout` → `public/locales/<lang>/loc_data_dashboard.json` `"metas"`;
  the bespoke one-off pages carry theirs in their own namespace (home→`loc_home`,
  about→`loc_about`, faq→`loc_faq`, data_map→`loc_data_map`, start→`loc_start`,
  data_guide→`loc_guide`, wordfish→`loc_experiments`, plus methodology, imprint,
  accessibility, sustainability and traffic_stats in their like-named namespaces —
  the full list is `NAMESPACES` in `.agents/verify-loc-metas.ts`) — except project/experiments,
  which have no own loader, so their copy rides in `loc_main` (lang layout).
- Copy is stored as **tokenized templates** (JSON holds flat strings only; grammar
  stays in TS). [`loc.ts`](../app/lib/seo/metas/loc.ts): `metaLoc(matches)` reads
  `locs.metas` off the **deepest** match that has one, `substitute(tpl, vars)` fills
  `{tokens}` (unknown tokens left verbatim; defined in [`lang.ts`](../app/lib/lang.ts)
  and re-exported here, since the UI labels tokenize the same way via
  `t(key, vars)` — see below), `mt(loc, key)` looks a key up (dev-throw
  on a miss, so a typo can't silently ship a raw key into `<title>`). Conditional
  variants are **sibling keys** the TS picks between (e.g. `person.born{,NoAge,Died}`),
  never a branch inside JSON. Tokens: dimensions `{name}`/`{ctx}`/`{count}`, index
  `{q}`/`{count}`/`{site}`, overview tails `{site}`.
- Every key the code reads is registered in [`keys.ts`](../app/lib/seo/metas/keys.ts)
  (`META_KEYS`); `npm run verify:metas` asserts the union of every namespace's `"metas"`
  block == `META_KEYS` exactly, in every language the `LANGS` array lists (`en`/`de`/`fr`/
  `it`/`es`/`pt`/`rm` today) — this replaces the old `Record<MetaLang, …>` compile-time exhaustiveness.
  Add a namespace that gains a `"metas"` block to `NAMESPACES`, and a new language to `LANGS`,
  in [`verify-loc-metas.ts`](../.agents/verify-loc-metas.ts).
- Any `public/locales/**` change must sync the [`/localization`](../localization/) mirror
  (`localization/<ns>.meta.json` → `keys."metas.<key>"` with `context` + one entry per language).
- **New entity**: add `<entity>.ts` (resolveFacts + factory calls with `copyPrefix`), one
  barrel line, `meta()` per route (cast `loaderData as unknown as { data?: any }` → builder);
  then register the keys in `keys.ts`, fill the `"metas"` block in every language's
  `loc_data_dashboard.json`, and mirror them. Verify with a zero-diff SEO-head snapshot.

### Structured data (JSON-LD only)

- **All** structured data is schema.org **JSON-LD emitted in `<head>`** — there is **no
  microdata** in the DOM (grep `itemScope\|itemType\|itemProp\|itemID` must stay at 0).
- One **`@graph` per page**: the leaf `meta()` emits a single `script:ld+json` whose graph
  concatenates breadcrumbs + the primary entity (+ list items on index pages, + bulk
  Datasets). `buildGraph` (in [`jsonld/graph.ts`](../app/lib/seo/jsonld/graph.ts)) dedupes
  by `@id`, so the shared Organization/WebSite appears once.
- Node builders mirror the metas layout — one file per entity in
  [`app/lib/seo/jsonld/`](../app/lib/seo/jsonld/) (barrel `~/lib/seo/jsonld`); `@id`s
  come from `ids.ts`. They plug into the metas factory seam (`node`/`dimNode`/`datasets`),
  so entity routes get head JSON-LD by passing `matches`/`params` in the meta ctx.
  Builders stay **logic only** — no localized prose inline. The bulk-export `Dataset`
  description ([`jsonld/dataset.ts`](../app/lib/seo/jsonld/dataset.ts)) is a **tokenized
  template** in the `loc_data_dashboard` `"metas"` block (`dataset.desc` / `dataset.descNoScope`
  — scope vs. no-scope siblings, tokens `{label}`/`{scope}`/`{site}`), read off `matches` via
  `metaLoc`/`substitute` like every other metas string.
- The site-wide Organization + WebSite node lives in `jsonld/site.ts`, emitted once from
  the root layout via `<JsonLd>`; the homepage augments the **same** WebSite `@id` with a
  SearchAction (`metas/home.ts`). JSON-LD `<script>` is a nonce-free data block (CSP-exempt);
  do not introduce a runtime schema lib (keep the bundle eval-free).
