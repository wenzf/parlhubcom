// /app/lib/seo/metas/start.ts
//
// Meta for /start — the "Start here" quicklinks landing page. Bespoke one-off
// like home.ts / about.ts. The page copy itself lives in loc_start.json; the SEO
// title + description live in that namespace's `metas` block (keys `start.title`/
// `start.desc`), read via metaLoc/mt (see docs/conventions.md).

import {
    type EntityMetaCtx,
    metaLang,
    buildMeta,
} from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function startMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    return withBreadcrumbs(buildMeta({
        title: mt(loc, "start.title"),
        description: mt(loc, "start.desc"),
        path,
        lang: L,
    }), matches, params);
}
