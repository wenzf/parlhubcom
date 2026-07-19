// /app/lib/seo/metas/project.ts
//
// Meta for /project — the project section index (NS_PROJECT_INDEX). A bespoke
// one-off (no entity data): links out to About, FAQ and the Data map. This page
// has no own loader (its link labels come from loc_main.nav, loaded by the lang
// layout), so its SEO copy rides in the loc_main `metas` block (keys
// `project.title`/`project.desc`) — loc_main is the deepest match carrying metas
// here — read via metaLoc/mt.

import {
    type EntityMetaCtx,
    metaLang,
    buildMeta,
} from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function projectMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    return withBreadcrumbs(buildMeta({
        title: mt(loc, "project.title"),
        description: mt(loc, "project.desc"),
        path,
        lang: L,
    }), matches, params);
}
