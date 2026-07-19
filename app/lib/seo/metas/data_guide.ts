// /app/lib/seo/metas/data_guide.ts
//
// Meta for /project/data-guide — the "what you can explore" field guide. A bespoke
// one-off (no entity data). On-page copy lives in loc_guide.json; the SEO title +
// description live in that namespace's `metas` block (keys `data_guide.title`/
// `data_guide.desc`), read via metaLoc/mt (see docs/conventions.md).

import {
    type EntityMetaCtx,
    metaLang,
    buildMeta,
} from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function dataGuideMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    return withBreadcrumbs(
        buildMeta({ title: mt(loc, "data_guide.title"), description: mt(loc, "data_guide.desc"), path, lang: L }),
        matches,
        params,
    );
}
