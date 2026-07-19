// /app/lib/seo/metas/faq.ts
//
// Meta for /faq — the static FAQ page. Like about.ts, a bespoke one-off: SEO
// title + description live in the loc_faq `metas` block (keys `faq.title`/
// `faq.desc`), but the FAQPage JSON-LD is built from the page's loc content
// (passed in from the route's loaderData) so the structured data always matches
// the visible Q&A.

import {
    type EntityMetaCtx,
    metaLang,
    buildMeta,
    absoluteUrl,
} from "./core";
import { withBreadcrumbs } from "./factory";
import { metaLoc, mt } from "./loc";

/** The loc shape the route loader passes in (locs.faq from loc_faq.json). */
export interface FaqLocContent {
    items?: {
        id: string;
        q: string;
        body: string[];
        code?: string[];
        body_after?: string[];
    }[];
}

export function faqMeta(
    faq: FaqLocContent | null | undefined,
    { lang, path, matches, params }: EntityMetaCtx = {},
) {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    const tags = buildMeta({
        title: mt(loc, "faq.title"),
        description: mt(loc, "faq.desc"),
        path,
        lang: L,
    });

    // FAQPage JSON-LD from the actual localized Q&A. Each Question's @id carries
    // the same hash the heading anchors use, so engines can deep-link a question.
    const items = faq?.items ?? [];
    if (items.length) {
        const url = absoluteUrl(path);
        tags.push({
            "script:ld+json": {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                inLanguage: L,
                mainEntity: items.map((it) => ({
                    "@type": "Question",
                    "@id": `${url}#${it.id}`,
                    name: it.q,
                    acceptedAnswer: {
                        "@type": "Answer",
                        text: [...it.body, ...(it.code ?? []), ...(it.body_after ?? [])]
                            .join(" ")
                            .replace(/\s+/g, " "),
                    },
                })),
            },
        });
    }

    return withBreadcrumbs(tags, matches, params);
}
