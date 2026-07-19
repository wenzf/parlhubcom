// /app/lib/seo/metas/sustainability.ts
//
// Meta for /project/sustainability — the static sustainability page. A bespoke
// one-off (no entity data), so it computes a MetaSpec directly and delegates to
// buildMeta, exactly like about.ts. Page body copy lives in
// /public/locales/<lang>/loc_sustainability.json; the SEO title + description live
// in that namespace's `metas` block (keys `sustainability.title`/`.desc`).
//
// No JSON-LD beyond breadcrumbs: schema.org has no vocabulary for a hosting /
// energy disclosure, and the machine-readable channel for this page is
// /carbon.txt, which points its org.disclosures entry here.

import { type EntityMetaCtx, metaLang, buildMeta } from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function sustainabilityMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    const tags = buildMeta({
        title: mt(loc, "sustainability.title"),
        description: mt(loc, "sustainability.desc"),
        path,
        lang: L,
    });

    return withBreadcrumbs(tags, matches, params);
}
