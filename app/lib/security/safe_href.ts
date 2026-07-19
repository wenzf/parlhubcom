// /app/lib/security/safe_href.ts
//
// URL-scheme allowlist for data-derived link hrefs. React does not block
// `javascript:` URLs, so any OpenParlData field bound into an anchor's href
// (speech.video_url, doc file URLs, official profiles, ...) is a script sink
// in the site origin. The rich-text path is covered by sanitize.ts; this
// helper is the equivalent guard for plain URL fields. Apply it inside the
// shared link primitives (LinkValue, ExternalAction, LinkedItem,
// LightboxLink), never per call site.

const ALLOWED_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

// The named entities js-xss's friendlyAttrValue decodes, plus the ones that
// matter for smuggling a scheme past a naive test.
const NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    colon: ":",
    lt: "<",
    gt: ">",
    quot: '"',
    tab: "\t",
    newline: "\n",
};

/** Decode numeric (`&#106;` / `&#x6A;`) and the few relevant named HTML
 *  entities, so `jav&#x09;ascript:` cannot slip past the scheme test. Unknown
 *  entities and out-of-range code points are left verbatim. */
function decodeEntities(s: string): string {
    if (!s.includes("&")) return s;
    return s.replace(
        /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));?/gi,
        (whole, hex: string | undefined, dec: string | undefined, named: string | undefined) => {
            const code = hex != null ? parseInt(hex, 16) : dec != null ? parseInt(dec, 10) : null;
            if (code != null) {
                return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
            }
            return NAMED_ENTITIES[named!.toLowerCase()] ?? whole;
        },
    );
}

/**
 * Return `url` unchanged when it is safe to bind as an anchor `href`,
 * `undefined` otherwise (the caller then renders non-interactive text).
 *
 * Allowed: `http:`, `https:`, `mailto:`, `tel:`, and scheme-less relative
 * URLs (no scheme means no `javascript:`/`data:` payload is possible).
 * The scheme test runs on a defensively normalized copy: entities decoded,
 * the characters browsers ignore while parsing a URL stripped (leading and
 * trailing C0 controls and space, tab/newline/CR anywhere), so
 * ` javascript:`, `java\tscript:` and `jav&#x09;ascript:` are all caught.
 */
export function safeHref(url: string | null | undefined): string | undefined {
    if (typeof url !== "string" || url.length === 0) return undefined;
    const candidate = decodeEntities(url)
        .replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, "")
        .replace(/[\t\n\r]/g, "");
    if (candidate.length === 0) return undefined;
    // Everything before the first `:` that precedes any `/`, `?` or `#` is the
    // scheme candidate. Matching the raw prefix (rather than a well-formed
    // scheme pattern) also rejects mangled forms like `java\0script:`.
    const scheme = /^([^/?#]*):/.exec(candidate)?.[1];
    if (scheme !== undefined) {
        return ALLOWED_SCHEMES.has(scheme.toLowerCase()) ? url : undefined;
    }
    return url;
}

export default safeHref;
