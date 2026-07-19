// app/server/sitemap/source.ts
//
// The uniform interface every sitemap "source" implements. A source is one shard
// family in the URL space (`/sitemaps/<key>-<page>.xml`): it knows how many URLs
// it has and can produce any single page of them. This is the seam that lets the
// build engine stay entity-agnostic while different sources enumerate very
// differently — a plain table scan, a fixed list of static pages, or a bespoke
// per-language query (organizations). Adding a source type is implementing this
// interface; adding an instance is one line in the registry.

import type { UrlEntry } from "~/lib/seo/sitemap/xml";

export interface SitemapSource {
    /** URL shard key, e.g. "people" → `/sitemaps/people-1.xml`. Unique, [a-z0-9_]+. */
    key: string;
    /** Total `<url>` count across all pages — drives page count in the index. */
    count(): Promise<number>;
    /** One page (1-based) of `<url>` entries, at most `pageSize` of them. */
    entries(page: number, pageSize: number): Promise<UrlEntry[]>;
}
