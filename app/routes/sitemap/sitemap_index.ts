// app/routes/sitemap/sitemap_index.ts
//
// GET /sitemap.xml — the <sitemapindex>. Registered at the site root (outside the
// ':lang?' prefix) and loader-only (no chrome layouts). Lists every child sitemap
// (`/sitemaps/<entity>-<page>.xml`) across all registered entities; the heavy
// per-page URL lists live in the shard route.

import { buildSitemapIndex } from "~/server/sitemap/build.server";

export async function loader(): Promise<Response> {
    const xml = await buildSitemapIndex();
    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
