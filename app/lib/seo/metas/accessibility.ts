// /app/lib/seo/metas/accessibility.ts
//
// Meta for /project/accessibility — the accessibility statement. A bespoke one-off
// (no entity data), so it computes a MetaSpec directly and delegates to buildMeta,
// exactly like about.ts / sustainability.ts. Page body copy lives in
// /public/locales/<lang>/loc_accessibility.json; the SEO title + description live in
// that namespace's `metas` block (keys `accessibility.title`/`.desc`).
//
// No JSON-LD beyond breadcrumbs: schema.org's accessibility vocabulary
// (accessibilityFeature/accessMode) describes creative works, not a conformance
// declaration, and no machine-readable accessibility-statement schema exists to
// target — unlike the sustainability page, whose machine-readable half is /carbon.txt.

import { type EntityMetaCtx, metaLang, buildMeta } from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function accessibilityMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    const tags = buildMeta({
        title: mt(loc, "accessibility.title"),
        description: mt(loc, "accessibility.desc"),
        path,
        lang: L,
    });

    return withBreadcrumbs(tags, matches, params);
}
