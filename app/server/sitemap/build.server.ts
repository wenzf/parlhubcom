"server-only";
// app/server/sitemap/build.server.ts
//
// The source-agnostic engine that turns the registry into XML. Two public
// builders back the two dynamic routes:
//   • buildSitemapIndex()      → the <sitemapindex> at /sitemap.xml
//   • buildEntitySitemap(k, p) → one paged <urlset> at /sitemaps/<k>-<p>.xml
//
// It knows nothing about tables, organizations, or static pages — every source
// implements the same SitemapSource interface (count + entries). Paging uses the
// language-aware SITEMAP_URLS_PER_PAGE so files stay under both the 50k-entry and
// 50 MB caps as languages are added.

import { SITEMAP_URLS_PER_PAGE, SITE_ORIGIN } from "~/lib/seo/sitemap/urls";
import { renderSitemapIndex, renderUrlset, type SitemapRef } from "~/lib/seo/sitemap/xml";
import { SITEMAP_SOURCES, sitemapSource } from "./registry.server";
import type { SitemapSource } from "./source";

/** Max `<url>` entries per child sitemap — derived from the language count so
 *  every file stays inside the 50k-entry / 50 MB caps (see urls.ts). */
export const SITEMAP_PAGE_SIZE = SITEMAP_URLS_PER_PAGE;

/** Number of child sitemap pages for a source (always ≥ 1). */
function pageCount(total: number): number {
    return Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
}

/**
 * Build the top-level `<sitemapindex>`: every source, expanded to one `<sitemap>`
 * ref per page. One count() per source (cheap — a COUNT or a small key scan).
 */
export async function buildSitemapIndex(): Promise<string> {
    const refs: SitemapRef[] = [];
    for (const source of SITEMAP_SOURCES) {
        const pages = pageCount(await source.count());
        for (let page = 1; page <= pages; page += 1) {
            refs.push({ loc: `${SITE_ORIGIN}/sitemaps/${source.key}-${page}.xml` });
        }
    }
    return renderSitemapIndex(refs);
}

/**
 * Build one child `<urlset>` for `key` page `page` (1-based). Returns null when
 * the key is unknown or the page is out of range — the route maps that to 404.
 */
export async function buildEntitySitemap(key: string, page: number): Promise<string | null> {
    const source: SitemapSource | undefined = sitemapSource(key);
    if (!source || !Number.isInteger(page) || page < 1) return null;

    const pages = pageCount(await source.count());
    if (page > pages) return null;

    const entries = await source.entries(page, SITEMAP_PAGE_SIZE);
    return renderUrlset(entries);
}
