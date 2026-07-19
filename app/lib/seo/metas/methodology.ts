// /app/lib/seo/metas/methodology.ts
//
// Meta for /project/methodology — the "how each metric is calculated" page. A
// bespoke one-off (no entity data). On-page copy lives in loc_methodology.json;
// the SEO title + description live in that namespace's `metas` block (keys
// `methodology.title`/`methodology.desc`), read via metaLoc/mt (see
// docs/conventions.md).

import {
    type EntityMetaCtx,
    metaLang,
    buildMeta,
} from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function methodologyMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    return withBreadcrumbs(
        buildMeta({ title: mt(loc, "methodology.title"), description: mt(loc, "methodology.desc"), path, lang: L }),
        matches,
        params,
    );
}
