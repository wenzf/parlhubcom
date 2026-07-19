// app/routes/sitemap/robots.tsx
//
// GET /robots.txt — registered at the site root (OUTSIDE the ':lang?' prefix, like
// wellknown_devtools) so there is exactly one robots file. It points crawlers at
// the sitemap index; the index in turn fans out to the per-entity child sitemaps.
//
// Disallows cover non-content surfaces: the settings action and the bulk data
// EXPORT resource routes (attachment downloads, not pages). Everything else is
// crawlable.
//
// Crawl-delay: 3 paces well-behaved crawlers to one request per 3s — bots are
// the overwhelming share of traffic (see /project/traffic-stats) and the site is
// a single DuckDB-backed container, so an unpaced burst on the heavy analytics
// pages degrades everyone's response times. Advisory only: Bing honors it,
// Google ignores it (rate is set in Search Console), abusive bots ignore
// robots.txt entirely.

import { SITE_ORIGIN } from "~/lib/seo/sitemap/urls";

const BODY = `User-agent: *
Allow: /
Disallow: /actions/
Disallow: /*/export/
Crawl-delay: 3

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

export function loader(): Response {
    return new Response(BODY, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
