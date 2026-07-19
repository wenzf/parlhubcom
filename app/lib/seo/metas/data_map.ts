// /app/lib/seo/metas/data_map.ts
//
// Meta for /project/data-map — the Data Map (a diagram of the data model and how
// the entities interconnect). A bespoke one-off like about.ts: SEO title +
// description live in the loc_data_map `metas` block (keys `data_map.title`/
// `data_map.desc`); the page copy lives in /public/locales/<lang>/loc_data_map.json.

import {
    type EntityMetaCtx,
    metaLang,
    buildMeta,
    absoluteUrl,
    SITE_NAME,
} from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

export function dataMapMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    const title = mt(loc, "data_map.title");
    const description = mt(loc, "data_map.desc");
    const tags = buildMeta({
        title,
        description,
        path,
        lang: L,
    });

    // CollectionPage JSON-LD: this page is an overview/index of the site's data
    // catalogues. A data block, not executable script, so the strict nonce CSP
    // does not apply.
    tags.push({
        "script:ld+json": {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            url: absoluteUrl(path),
            inLanguage: L,
            isPartOf: { "@type": "WebSite", name: SITE_NAME },
        },
    });

    return withBreadcrumbs(tags, matches, params);
}
