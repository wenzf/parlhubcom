// /app/lib/seo/metas/loc.ts
//
// The bridge between the SEO copy and the metas builders. The copy does NOT get
// its own namespace — it lives under a `metas` key inside whichever locale
// namespace a route's subtree already loads: entity pages sit under
// `data_dashboard_layout` (→ `loc_data_dashboard.json` `"metas"`), the bespoke
// one-off pages carry it in their own namespace. Those loaders return `{ locs }`,
// and a route `meta()` receives its ancestor loaders' data via `matches`, so
// builders read `locs.metas` off `matches` here — the same seam the breadcrumb
// JSON-LD uses, and no extra file / extra load.
//
// Pure + isomorphic (runs on server render and on client-side navigation, exactly
// like the rest of `metas/`).

import type { MetaKey } from "./keys";

// The token filler is a localization primitive, not an SEO one: the UI labels in
// `opd_views/` use the same tokenized-template shape through `makeT`. It lives in
// `~/lib/lang` and is re-exported here so `metas/*` keep importing it from `./loc`.
export { substitute } from "~/lib/lang";

/** The `metas` sub-object of a loaded locale namespace: flat key → template. */
export type MetaLoc = Record<string, string>;

/** Pull the `metas` copy bag out of a route `meta()`'s `matches`. The deepest
 *  matched loader wins — a route's meta copy lives in the namespace its own
 *  subtree loads (entity pages → loc_data_dashboard, one-offs → their own). Returns
 *  `{}` when no match carries one — `mt()` then guards. */
export function metaLoc(matches: unknown[] | undefined): MetaLoc {
    if (!matches?.length) return {};
    for (let i = matches.length - 1; i >= 0; i -= 1) {
        const bag = (matches[i] as { loaderData?: { locs?: { metas?: MetaLoc } } } | null)
            ?.loaderData?.locs?.metas;
        if (bag) return bag;
    }
    return {};
}

/** Look up a template by key. Throws in dev on a missing key (fail loud — a raw
 *  key must never reach a <title>); in prod returns the key so a response never
 *  crashes. The `verify:metas` script prevents missing keys from shipping. */
export function mt(loc: MetaLoc, key: MetaKey): string {
    const v = loc[key];
    if (v == null) {
        if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
            throw new Error(`[metas] missing loc_metas key: ${key}`);
        }
        return key;
    }
    return v;
}
