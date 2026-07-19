"server-only";
// app/server/sitemap/registry.server.ts
//
// The single source of truth for WHAT gets a sitemap. It assembles the ordered
// list of SitemapSource instances the index and shard routes serve. Adding a
// route family to the sitemap is ONE entry here — everything downstream (routing,
// pagination, XML) is source-agnostic.
//
// Scope: entity OVERVIEW pages (/<entity>/:id), the DB-free static pages — home,
// the list/index pages, and the editorial routes under /start, /project and
// /experiments (one static file) — and organizations (derived, language-specific
// ids). Per-entity sub-tabs (votes / alignment / docs / …) are intentionally
// excluded — they are secondary views of the same entity.
//
// lastmod columns are per the live schema: most tables carry updated_at/created_at
// (epoch-ms DOUBLE); `bodies` has none (null); `docs` has no created_at.

import { organizationsSource, staticPagesSource, tableSource } from "./sources.server";
import type { SitemapSource } from "./source";

/** Home, every top-level list/index page, and the editorial pages outside the
 *  data dashboard (start / project / experiments) — the crawlable non-detail
 *  routes. */
const staticPages = staticPagesSource("pages", [
    { path: "/" }, // home (no PAGE_CONFIG namespace)
    { ns: "NS_START" },
    { ns: "NS_PEOPLE_INDEX" },
    { ns: "NS_BODIES_INDEX" },
    { ns: "NS_AFFAIRS_INDEX" },
    { ns: "NS_GROUPS_INDEX" },
    { ns: "NS_VOTINGS_INDEX" },
    { ns: "NS_MEETINGS_INDEX" },
    { ns: "NS_INTERESTS_INDEX" },
    { ns: "NS_ORGANIZATIONS_INDEX" },
    { ns: "NS_TEXTS_INDEX" },
    { ns: "NS_DOCS_INDEX" },
    { ns: "NS_SPEECHES_INDEX" },
    { ns: "NS_PROJECT_INDEX" },
    { ns: "NS_ABOUT" },
    { ns: "NS_FAQ" },
    { ns: "NS_SUSTAINABILITY" },
    { ns: "NS_ACCESSIBILITY" },
    { ns: "NS_PROJECT_DATA_MAP" },
    { ns: "NS_PROJECT_DATA_GUIDE" },
    { ns: "NS_PROJECT_METHODOLOGY" },
    { ns: "NS_IMPRINT" },
    { ns: "NS_EXPERIMENTS_INDEX" },
    { ns: "NS_EXPERIMENTS_WORDFISH" },
]);

/** Ordered sitemap sources; each becomes one or more `/sitemaps/<key>-<n>.xml`. */
export const SITEMAP_SOURCES: SitemapSource[] = [
    staticPages,
    tableSource({ key: "people", table: "persons", pageNamespace: "NS_PEOPLE_OVERVIEW", lastmodExpr: "COALESCE(updated_at, created_at)" }),
    tableSource({ key: "groups", table: "groups", pageNamespace: "NS_GROUPS_OVERVIEW", lastmodExpr: "COALESCE(updated_at, created_at)" }),
    tableSource({ key: "bodies", table: "bodies", pageNamespace: "NS_BODIES_OVERVIEW", lastmodExpr: null }),
    tableSource({ key: "affairs", table: "affairs", pageNamespace: "NS_AFFAIRS_OVERVIEW", lastmodExpr: "COALESCE(updated_at, created_at)" }),
    tableSource({ key: "votings", table: "votings", pageNamespace: "NS_VOTINGS_OVERVIEW", lastmodExpr: "COALESCE(updated_at, created_at)" }),
    tableSource({ key: "meetings", table: "meetings", pageNamespace: "NS_MEETINGS_OVERVIEW", lastmodExpr: "COALESCE(updated_at, created_at)" }),
    tableSource({ key: "interests", table: "interests", pageNamespace: "NS_INTERESTS_OVERVIEW", lastmodExpr: "COALESCE(updated_at, created_at)" }),
    organizationsSource,
    tableSource({ key: "texts", table: "texts", pageNamespace: "NS_TEXTS_OVERVIEW", lastmodExpr: "COALESCE(updated_at, created_at)" }),
    tableSource({ key: "docs", table: "docs", pageNamespace: "NS_DOCS_OVERVIEW", lastmodExpr: "COALESCE(updated_at, updated_external_at)" }),
    tableSource({ key: "speeches", table: "speeches", pageNamespace: "NS_SPEECHES_OVERVIEW", lastmodExpr: "COALESCE(updated_at, created_at)" }),
];

const BY_KEY: Record<string, SitemapSource> = Object.fromEntries(
    SITEMAP_SOURCES.map((s) => [s.key, s]),
);

/** Look up a source by shard key (undefined for unknown keys). */
export function sitemapSource(key: string): SitemapSource | undefined {
    return BY_KEY[key];
}
