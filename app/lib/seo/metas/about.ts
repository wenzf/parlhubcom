// /app/lib/seo/metas/about.ts
//
// Meta for /about — the static project page. A bespoke one-off (no entity data),
// so it computes a MetaSpec directly and delegates to buildMeta. The page body
// copy lives in /public/locales/<lang>/loc_about.json; the SEO title +
// description live in that namespace's `metas` block (keys `about.title`/`about.desc`).

import {
    type EntityMetaCtx,
    metaLang,
    buildMeta,
    absoluteUrl,
    SITE_NAME,
    SITE_URL,
} from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";
import { REPO_URL } from "~/configs/site.config";

// Maintainer facts for the JSON-LD block. TODO: add `name` (real name) to AUTHOR
// if wanted for entity/knowledge-graph use.
const AUTHOR = {
    "@type": "Person",
    url: "https://wefrick.com",
    email: "hello@wefrick.com",
} as const;

export function aboutMeta({ lang, path, matches, params }: EntityMetaCtx = {}) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    const title = mt(loc, "about.title");
    const description = mt(loc, "about.desc");
    const tags = buildMeta({
        title,
        description,
        path,
        lang: L,
    });

    // AboutPage JSON-LD: this page describes the site — a free, non-profit,
    // one-person project built on OpenParlData.ch. A data block, not executable
    // script, so the strict nonce CSP doesn't apply to it.
    tags.push({
        "script:ld+json": {
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: title,
            url: absoluteUrl(path),
            inLanguage: L,
            mainEntity: {
                "@type": "WebSite",
                name: SITE_NAME,
                url: SITE_URL,
                description,
                inLanguage: ["de", "fr", "it", "en"],
                isAccessibleForFree: true,
                author: AUTHOR,
                maintainer: AUTHOR,
                isBasedOn: "https://openparldata.ch",
                sameAs: [REPO_URL],
            },
        },
    });

    return withBreadcrumbs(tags, matches, params);
}
