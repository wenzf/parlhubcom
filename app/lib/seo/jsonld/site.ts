// /app/lib/seo/jsonld/site.ts
//
// The site-wide structured-data nodes: parlhub as the publisher Organization
// (referenced by `@id` from every Dataset and entity node) and the WebSite in
// all site languages. Emitted once from the root layout via <JsonLd>. Split out
// of core.tsx so core keeps only the render primitive.

import { SITE_LANGS } from "~/configs/site.config";
import { SITE_NAME, SITE_URL } from "~/lib/seo/metas/core";

/** The one Organization node every page's structured data hangs off. */
export const ORG_ID = `${SITE_URL}/#organization`;
/** The one WebSite node; the homepage augments this same `@id` with a
 *  SearchAction (metas/home.ts), so consumers merge them into one node. */
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** The site-wide graph, emitted once from the root layout: parlhub as the
 *  publisher Organization (referenced by `@id` from every Dataset node) and
 *  the WebSite in all site languages. */
export function siteJsonLd(): object {
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": ORG_ID,
                name: SITE_NAME,
                url: SITE_URL,
                logo: `${SITE_URL}/icons/logo.svg`,
            },
            {
                "@type": "WebSite",
                "@id": WEBSITE_ID,
                name: SITE_NAME,
                url: SITE_URL,
                inLanguage: SITE_LANGS.map((l) => l.lang_html),
                publisher: { "@id": ORG_ID },
            },
        ],
    };
}
