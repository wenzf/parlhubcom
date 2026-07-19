// /app/lib/seo/metas/home.ts
//
// Meta for / — the homepage. Bespoke one-off like about.ts. Also the right
// place for the site-level WebSite JSON-LD with a SearchAction (tells engines
// about the search URL pattern; the homepage search itself submits to the
// per-section indexes' ?q=). SEO copy lives in the `metas` block of loc_home
// (keys `home.title`/`home.desc`); the JSON-LD is assembled here.

import {
    type EntityMetaCtx,
    metaLang,
    buildMeta,
    SITE_NAME,
    SITE_URL,
} from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";
import { WEBSITE_ID, ORG_ID } from "~/lib/seo/jsonld";

export function homeMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    const description = mt(loc, "home.desc");
    const tags = buildMeta({
        title: mt(loc, "home.title"),
        description,
        path,
        lang: L,
    });

    // Augment the site-wide WebSite node (defined once in jsonld/site.ts, emitted
    // from the root layout) with a homepage SearchAction. Same `@id` ⇒ consumers
    // merge the two into one canonical WebSite. The SearchAction points at the
    // people catalogue's ?q= (the default scope of the homepage search).
    tags.push({
        "script:ld+json": {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": WEBSITE_ID,
            name: SITE_NAME,
            url: SITE_URL,
            description,
            isAccessibleForFree: true,
            publisher: { "@id": ORG_ID },
            potentialAction: {
                "@type": "SearchAction",
                target: {
                    "@type": "EntryPoint",
                    urlTemplate: `${SITE_URL}/people?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
            },
        },
    });

    return withBreadcrumbs(tags, matches, params);
}
