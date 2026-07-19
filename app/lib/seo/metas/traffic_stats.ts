// /app/lib/seo/metas/traffic_stats.ts
//
// Meta for /project/traffic-stats — the public traffic statistics page. A bespoke
// one-off (no entity data), so it computes a MetaSpec directly and delegates to
// buildMeta, exactly like sustainability.ts. Page body copy lives in
// /public/locales/<lang>/loc_traffic_stats.json; the SEO title + description live
// in that namespace's `metas` block (keys `traffic_stats.title`/`.desc`).
//
// No JSON-LD beyond breadcrumbs: the page reports the site's own request counts,
// which is a Dataset only in the loosest sense — there is no download and no
// stable distribution URL to point a schema.org Dataset at. Revisit if the daily
// JSON is ever published directly.

import { type EntityMetaCtx, metaLang, buildMeta } from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function trafficStatsMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    const tags = buildMeta({
        title: mt(loc, "traffic_stats.title"),
        description: mt(loc, "traffic_stats.desc"),
        path,
        lang: L,
    });

    return withBreadcrumbs(tags, matches, params);
}
