// /app/lib/seo/metas/experiments.ts
//
// Meta for the /experiments section — the index and the Wordfish write-up.
// Bespoke one-offs like start.ts / project.ts. SEO copy is read via metaLoc/mt:
// the index has no own loader, so `experiments.title`/`experiments.desc` ride in
// the loc_main `metas` block (lang layout, the deepest match with metas here);
// the Wordfish page loads loc_experiments, so its `wordfish.title`/`wordfish.desc`
// live there (see docs/conventions.md).

import {
    type EntityMetaCtx,
    metaLang,
    buildMeta,
} from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function experimentsMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    return withBreadcrumbs(
        buildMeta({ title: mt(loc, "experiments.title"), description: mt(loc, "experiments.desc"), path, lang: L }),
        matches,
        params,
    );
}

export function wordfishMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    return withBreadcrumbs(
        buildMeta({ title: mt(loc, "wordfish.title"), description: mt(loc, "wordfish.desc"), path, lang: L }),
        matches,
        params,
    );
}
