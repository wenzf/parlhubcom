// app/lib/seo/sitemap/urls.ts
//
// Turns a PAGE_CONFIG namespace + route params into the absolute URLs a sitemap
// needs — the canonical `<loc>` plus one hreflang alternate per site language.
//
// URL construction goes through `localizedPath` (the same helper the app's
// <Link>s and canonical <meta> use), so sitemap URLs are guaranteed to match the
// real routes — including the quirk that the default locale (en) has an EMPTY
// lang param and therefore no `/en` prefix. Adding a language to SITE_LANGS
// automatically adds its alternate here; nothing entity-specific lives in this
// file, so every entity family reuses it unchanged.

import type { Params } from "react-router";
import type { PageNamespaces } from "@/types/site";
import { SITE_DEPLOYMENT, SITE_LANGS } from "~/configs/site.config";
import { createLangPathByParam, localizedPath } from "~/lib/lang";
import type { Alternate, UrlEntry } from "./xml";

/** Origin without a trailing slash, e.g. "https://parlhub.com". */
export const SITE_ORIGIN = SITE_DEPLOYMENT.DOMAIN_URL.replace(/\/+$/, "");

/** The default (prefix-less) language — its `<loc>` is the canonical URL. */
const DEFAULT_LANG = SITE_LANGS.find((l) => l.default) ?? SITE_LANGS[0];

/** epoch-ms (DuckDB DOUBLE) → ISO-8601, or undefined when absent/invalid.
 *  Shared by every sitemap source that reads a `<lastmod>` timestamp. */
export function msToIso(ms: unknown): string | undefined {
    if (ms == null) return undefined;
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return new Date(n).toISOString();
}

/**
 * The one entry-builder every source funnels through: given a resolver that maps
 * a `:lang?` param to a (relative) pathname, emit one `<url>` whose `<loc>` is the
 * default-locale (canonical) URL plus one `hreflang` alternate per SITE_LANGS
 * entry and an `x-default`. One entry per page (not per language) keeps files
 * compact — the 50k `<url>` cap counts entries, not their alternates.
 */
function entryFrom(resolvePath: (langParam: string) => string, lastmod?: string): UrlEntry {
    const alternates: Alternate[] = SITE_LANGS.map((l) => ({
        hreflang: l.lang_html,
        href: `${SITE_ORIGIN}${resolvePath(l.lang_param)}`,
    }));
    const canonical = `${SITE_ORIGIN}${resolvePath(DEFAULT_LANG.lang_param)}`;
    alternates.push({ hreflang: "x-default", href: canonical });
    return { loc: canonical, lastmod, alternates };
}

/** Absolute, localized URL for a page namespace + params, e.g.
 *  `absoluteLocalizedUrl("de", "NS_PEOPLE_OVERVIEW", { id: 42 })`
 *  → "https://parlhub.com/de/people/42". */
export function absoluteLocalizedUrl(
    langParam: string,
    pageNamespace: PageNamespaces,
    params?: Params,
): string {
    return `${SITE_ORIGIN}${localizedPath(langParam, pageNamespace, params)}`;
}

/** One `<url>` entry for a PAGE_CONFIG namespace + params, localized across all
 *  languages. Used by table entities (params = { id }) and the static list pages
 *  (params = {}). */
export function localizedSitemapEntry(
    pageNamespace: PageNamespaces,
    params: Params,
    lastmod?: string,
): UrlEntry {
    return entryFrom((langParam) => localizedPath(langParam, pageNamespace, params), lastmod);
}

/** One `<url>` entry for a raw path fragment (e.g. "/" for home), localized
 *  across all languages. For routes without a PAGE_CONFIG namespace. */
export function pathSitemapEntry(fragment: string, lastmod?: string): UrlEntry {
    return entryFrom((langParam) => createLangPathByParam(langParam, fragment), lastmod);
}

/* -------------------------------------------------------------------------- */
/* Per-file URL budget — language-aware                                        */
/* -------------------------------------------------------------------------- */
//
// sitemaps.org caps a child file at 50,000 <url> entries AND 50 MB uncompressed.
// The entry count is fixed, but BYTES-per-entry grow with the language count:
// each `localizedSitemapEntry` above emits one <xhtml:link> alternate PER site
// language (+ x-default), so every language added to SITE_LANGS enlarges every
// <url> block. A fixed urls-per-file could therefore breach the 50 MB cap while
// still under 50,000 entries once enough languages exist. So we DERIVE the limit
// from SITE_LANGS.length — adding a language automatically re-pages every sitemap
// (fewer URLs per file), no manual retuning.

/** Hard sitemaps.org caps, applied at 90% for margin. */
const MAX_URLS_PER_FILE = 50_000;
const MAX_BYTES_PER_FILE = 50 * 1024 * 1024;
const SAFETY = 0.9;

// Conservative byte estimates — real parlhub entries measure well under these
// (people ≈ 610 B/entry at 6 alternates vs. the ~1.3 kB this assumes).
const EST_URL_BYTES = 100; // avg absolute URL, headroom for long ids/segments
const EST_LINK_OVERHEAD = 70; // <xhtml:link rel=… hreflang=… href="…"/> markup
const EST_ENTRY_FIXED = 70; // <url>/<loc> tags + <lastmod> value

/** Estimated bytes of one <url> block carrying `alternateCount` alternates
 *  (one <loc> URL + one URL per alternate, each wrapped in link markup). */
function estEntryBytes(alternateCount: number): number {
    return (1 + alternateCount) * (EST_URL_BYTES + EST_LINK_OVERHEAD) + EST_ENTRY_FIXED;
}

/** Number of `<xhtml:link>` alternates one entry emits: one per language + x-default. */
export const SITEMAP_ALTERNATES_PER_ENTRY = SITE_LANGS.length + 1;

/**
 * Max `<url>` entries per child sitemap, bounded by BOTH the 50k-entry cap and
 * the 50 MB size cap, and SCALING DOWN with the language count. With today's 5
 * languages this is ~37k; at 10 languages it falls to ~24k, at 20 to ~13k —
 * keeping every generated file safely inside both limits automatically.
 */
export const SITEMAP_URLS_PER_PAGE: number = Math.max(
    1,
    Math.min(
        Math.floor(MAX_URLS_PER_FILE * SAFETY),
        Math.floor((MAX_BYTES_PER_FILE * SAFETY) / estEntryBytes(SITEMAP_ALTERNATES_PER_ENTRY)),
    ),
);
