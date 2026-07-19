// app/lib/seo/sitemap/xml.ts
//
// Pure, dependency-free renderers for the two sitemaps.org document types:
//   • a <urlset>       — one child sitemap file (a page of entity URLs), and
//   • a <sitemapindex> — the top-level index that points at every child file.
//
// Nothing here knows about the DB, entities, or React Router — it just turns
// plain data into spec-compliant XML strings, so it is trivially unit-testable
// and reused by every entity family. Localization is expressed with the
// xhtml:link alternates spec (https://developers.google.com/search/docs/
// specialty/international/localized-versions#sitemap).

/** One `hreflang` alternate for a URL (a localized version of the same page). */
export interface Alternate {
    /** BCP-47 language tag or the literal "x-default". */
    hreflang: string;
    /** Absolute URL of that language version. */
    href: string;
}

/** One `<url>` entry inside a `<urlset>`. */
export interface UrlEntry {
    /** Absolute canonical URL. */
    loc: string;
    /** W3C datetime (we emit full ISO-8601). Omitted when unknown. */
    lastmod?: string | undefined;
    /** hreflang alternates; when present, EACH entry should include a self-link
     *  and (conventionally) an `x-default`. */
    alternates?: Alternate[] | undefined;
}

/** One `<sitemap>` reference inside a `<sitemapindex>`. */
export interface SitemapRef {
    /** Absolute URL of the child sitemap file. */
    loc: string;
    /** W3C datetime of the newest URL in that child, if known. */
    lastmod?: string | undefined;
}

/** Escape the five XML predefined entities. `<loc>` values are URLs, so `&`
 *  (query separators) is the realistic case, but we escape all five for safety. */
export function xmlEscape(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>';
const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

function renderAlternate(alt: Alternate): string {
    return `<xhtml:link rel="alternate" hreflang="${xmlEscape(alt.hreflang)}" href="${xmlEscape(alt.href)}"/>`;
}

function renderUrl(entry: UrlEntry): string {
    const parts = [`<loc>${xmlEscape(entry.loc)}</loc>`];
    if (entry.lastmod) parts.push(`<lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
    if (entry.alternates) parts.push(...entry.alternates.map(renderAlternate));
    return `<url>${parts.join("")}</url>`;
}

/** Render a full `<urlset>` document (one child sitemap file). The xhtml
 *  namespace is always declared so alternates are valid even in a paged file. */
export function renderUrlset(entries: UrlEntry[]): string {
    const body = entries.map(renderUrl).join("\n");
    return `${XML_DECL}
<urlset xmlns="${NS}" xmlns:xhtml="${XHTML_NS}">
${body}
</urlset>
`;
}

function renderSitemapRef(ref: SitemapRef): string {
    const parts = [`<loc>${xmlEscape(ref.loc)}</loc>`];
    if (ref.lastmod) parts.push(`<lastmod>${xmlEscape(ref.lastmod)}</lastmod>`);
    return `<sitemap>${parts.join("")}</sitemap>`;
}

/** Render a full `<sitemapindex>` document (the top-level `/sitemap.xml`). */
export function renderSitemapIndex(refs: SitemapRef[]): string {
    const body = refs.map(renderSitemapRef).join("\n");
    return `${XML_DECL}
<sitemapindex xmlns="${NS}">
${body}
</sitemapindex>
`;
}
