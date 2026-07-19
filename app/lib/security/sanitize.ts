// /app/lib/security/sanitize.ts

// sanitize.js
// Thin wrapper around `xss` (js-xss) for Node.js.
// - Whitelists the most common HTML elements + safe attributes.
// - Any tag NOT in the whitelist (including XML-style tags like <config>,
//   <ns:data>, custom elements) is removed entirely, not escaped.
// - For dangerous containers (script/style/etc.) the inner content is
//   dropped too, so nothing leaks through as text.
//
// Install: npm i xss
// Usage:   import { sanitize } from "./sanitize.js";
//          const clean = sanitize(userHtml);

import { FilterXSS } from "xss";

// Common HTML elements -> allowed attributes for each.
// Empty array means "tag allowed, but strip all its attributes".
const whiteList = {
    // text / structure
    p: [],
    div: ["class"],
    span: ["class"],
    br: [],
    hr: [],
    blockquote: [],
    pre: [],
    code: [],
    // headings
    h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
    // inline formatting
    b: [], strong: [], i: [], em: [], u: [], s: [],
    small: [], sub: [], sup: [], mark: [], abbr: ["title"],
    // lists
    ul: [], ol: ["start"], li: [], dl: [], dt: [], dd: [],
    // links & media
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    figure: [], figcaption: [],
    // tables
    table: [], thead: [], tbody: [], tfoot: [],
    tr: [], th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    caption: [],
};

// Tags whose entire body (tag + inner content) should be discarded
// if they ever appear. Everything else not in the whitelist just has
// its tags stripped while keeping the inner text.
const stripIgnoreTagBody = ["script", "style", "xml", "iframe", "object", "embed"];

const filter = new FilterXSS({
    whiteList,
    stripIgnoreTag: true,        // remove non-whitelisted tags entirely (not escape)
    stripIgnoreTagBody,          // and drop the contents of these dangerous ones
    allowCommentTag: false,      // strip <!-- comments -->
    css: false,                  // disallow inline style values entirely
});

// HTML void elements — they never carry a closing tag and never nest.
const VOID_ELEMENTS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
]);

// Matches a single start/end tag, tolerating quoted attribute values that
// contain `>`.
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

/**
 * Balance an (already xss-sanitized) HTML fragment so it is a well-formed tree:
 * unmatched CLOSING tags are dropped and any still-open elements are closed at
 * the end. `xss` filters tag-by-tag without pairing, so malformed source data
 * (OpenParlData rich text ships stray `</div>`/`</li>` runs) passes through
 * unbalanced. That is harmless as client-side `innerHTML` (fragment parsing
 * ignores orphan end tags) but CATASTROPHIC in SSR: embedded in the full
 * document, a stray `</div>` closes the fragment's *ancestors*, reparenting the
 * rest of the page. The server DOM then differs from the client's → React
 * throws a hydration mismatch (#418). Balancing guarantees the fragment stays
 * contained in both parsing contexts. No-op for well-formed input.
 */
function balanceTags(html: string): string {
    let out = "";
    let lastIndex = 0;
    const stack: string[] = [];
    let m: RegExpExecArray | null;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(html)) !== null) {
        out += html.slice(lastIndex, m.index);
        lastIndex = TAG_RE.lastIndex;

        const whole = m[0];
        const name = m[1].toLowerCase();
        const isClosing = whole[1] === "/";
        const isSelfClosing = whole.endsWith("/>") || VOID_ELEMENTS.has(name);

        if (isClosing) {
            const idx = stack.lastIndexOf(name);
            if (idx === -1) continue; // orphan end tag — drop it
            // Close this element and any still-open descendants above it.
            for (let i = stack.length - 1; i >= idx; i--) out += `</${stack[i]}>`;
            stack.length = idx;
        } else {
            out += whole;
            if (!isSelfClosing) stack.push(name);
        }
    }
    out += html.slice(lastIndex);
    for (let i = stack.length - 1; i >= 0; i--) out += `</${stack[i]}>`;
    return out;
}

/**
 * Sanitize an untrusted HTML string.
 * @param {string} dirty
 * @returns {string} clean HTML safe to render
 */
export function sanitize(dirty: string) {
    if (typeof dirty !== "string" || dirty.length === 0) return "";
    return balanceTags(filter.process(dirty));
}

export default sanitize;