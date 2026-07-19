// /app/lib/seo/metas/imprint.ts
//
// Meta for /project/imprint — the legal notice / Impressum. A bespoke one-off (no
// entity data), so it computes a MetaSpec directly and delegates to buildMeta,
// exactly like about.ts / accessibility.ts. Page body copy lives in
// /public/locales/<lang>/loc_imprint.json; the SEO title + description live in that
// namespace's `metas` block (keys `imprint.title`/`.desc`). No JSON-LD beyond the
// breadcrumbs `withBreadcrumbs` appends.

import { type EntityMetaCtx, metaLang, buildMeta } from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function imprintMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    const tags = buildMeta({
        title: mt(loc, "imprint.title"),
        description: mt(loc, "imprint.desc"),
        path,
        lang: L,
    });

    return withBreadcrumbs(tags, matches, params);
}
