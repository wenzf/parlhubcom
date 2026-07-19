// /app/lib/seo/metas/core.ts
//
// The entity-agnostic meta engine: constants, primitives, and the single
// `buildMeta()` template every route funnels through. Nothing here knows about
// people / bodies / affairs — entity files (person.ts, …) compute a `MetaSpec`
// (directly or via the factories) and delegate here.
//
// Everything is pure and synchronous so it runs on server + client identically.

import type { MetaDescriptor } from "react-router";
import { SITE_DEPLOYMENT, SITE_LANGS } from "~/configs/site.config";
import { langByParam } from "~/lib/lang";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const SITE_NAME = "parlhub";
export const SITE_URL = SITE_DEPLOYMENT.DOMAIN_URL; // https://parlhub.com

/**
 * Default social-card image (the parlhub wordmark on the dark tile), used when a
 * route supplies no entity-specific `image`. Sized to the OG recommendation
 * (1200×630, 1.91:1) — see `public/icons/og-image.png`.
 */
const DEFAULT_OG_IMAGE = `${SITE_URL}/icons/og-image.png`;
const DEFAULT_OG_IMAGE_W = 1200;
const DEFAULT_OG_IMAGE_H = 630;

/** Google truncates titles ~60 chars and descriptions ~155–160. */
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 158;

/**
 * The site's languages, derived from `SITE_LANGS` (single source of truth) — add
 * a language there and it flows through here. Because the copy tables are typed
 * `Record<MetaLang, …>`, a new language surfaces as compile errors listing every
 * translation still owed (OG_LOCALE + each entity's copy).
 */
export type MetaLang = (typeof SITE_LANGS)[number]["lang_code"];

/** The default language (the `SITE_LANGS` entry flagged `default`), for fallbacks. */
const DEFAULT_META_LANG: MetaLang = (
    SITE_LANGS.find((l) => l.default) ?? SITE_LANGS[0]
).lang_code;

/** OpenGraph `og:locale` per site language (the `_CH` suffix can't be derived). */
const OG_LOCALE: Record<MetaLang, string> = {
    de: "de_CH",
    fr: "fr_CH",
    it: "it_CH",
    rm: "rm_CH",
    en: "en",
    es: "es",
    pt: "pt",
};

/* -------------------------------------------------------------------------- */
/* Shared ctx passed from route meta() exports                                */
/* -------------------------------------------------------------------------- */

/** What every entity builder needs from a route's `meta()` args. */
export interface EntityMetaCtx {
    /** Raw `:lang?` route param. */
    lang?: string | undefined;
    /** `location.pathname` — drives canonical + og:url. */
    path?: string | undefined;
    /** Matched routes (`Route.MetaArgs.matches`). Session 1: breadcrumb graph. */
    matches?: unknown[] | undefined;
    /** Route params (`Route.MetaArgs.params`). Session 1: breadcrumb graph. */
    params?: Record<string, string | undefined> | undefined;
}

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

/** Resolve the `:lang?` param to a site language, falling back to the default. */
export function metaLang(langParam: string | undefined): MetaLang {
    const code = langByParam(langParam).lang_code;
    return SITE_LANGS.some((l) => l.lang_code === code) ? (code as MetaLang) : DEFAULT_META_LANG;
}

/** Collapse whitespace and hard-trim to `max`, cutting on a word boundary. */
export function clamp(text: string, max: number): string {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    const slice = clean.slice(0, max - 1);
    const lastSpace = slice.lastIndexOf(" ");
    return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

/** Append the site name once: "Foo" → "Foo · parlhub" (skips if too long). */
export function withSite(title: string): string {
    const suffix = ` · ${SITE_NAME}`;
    const base = clamp(title, TITLE_MAX - suffix.length);
    return `${base}${suffix}`;
}

/** Join non-empty fragments with a separator (drops null/undefined/false/""). */
export function joinParts(
    parts: Array<string | null | undefined | false>,
    sep = ", ",
): string {
    return parts.filter((p): p is string => !!p && p.trim() !== "").join(sep);
}

/** `(ctx)` clause helper, empty when no context is known. */
export const withCtx = (ctx: string) => (ctx ? ` (${ctx})` : "");

/** Four-digit year from a (possibly partial) ISO date string. */
export function yearFrom(raw: string | number | null | undefined): string | null {
    if (raw == null) return null;
    const s = String(raw);
    const m = s.match(/(\d{4})/);
    return m ? m[1] : null;
}

/** Compact year range: "2019–2023", "2019–", "–2023", or a single year. */
export function yearRange(
    begin: string | number | null | undefined,
    end: string | number | null | undefined,
): string | null {
    const b = yearFrom(begin);
    const e = yearFrom(end);
    if (b && e) return b === e ? b : `${b}–${e}`;
    if (b) return `${b}–`;
    if (e) return `–${e}`;
    return null;
}

/** Format a total_count for the active language, or "" when unknown. */
export function countStr(count: number | null | undefined, lang: MetaLang): string {
    return typeof count === "number" ? count.toLocaleString(lang) : "";
}

/** Read a `{ total_count }` list off a response by key (entity-specific keys). */
export function readCount(
    data: unknown,
    key: string | null,
): number | undefined {
    if (!key || !data) return undefined;
    const bag = data as Record<string, { total_count?: number } | undefined>;
    return bag[key]?.total_count;
}

/** Absolute canonical URL for a pathname (`location.pathname`). */
export function absoluteUrl(path: string | undefined): string {
    if (!path) return SITE_URL;
    return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The non-empty `:lang?` URL prefixes, from SITE_LANGS (the default lang's is ""). */
const LANG_PARAMS: Set<string> = new Set(
    SITE_LANGS.map((l) => l.lang_param).filter((p) => p !== ""),
);

/**
 * `<link rel="alternate" hreflang="…">` for every language version of this page,
 * plus `x-default` → the default (en) URL. The current language is inferred from
 * the path's first segment (lang params never collide with route segments), so
 * the same route renders one alternate per site language pointing at the same
 * content under each locale's URL prefix. Empty when no path is known.
 */
export function hreflangLinks(path: string | undefined): MetaDescriptor[] {
    if (!path) return [];
    const segments = path.split("/"); // "/de/people/1" → ["", "de", "people", "1"]
    const hasLang = LANG_PARAMS.has(segments[1] ?? "");
    const bare = hasLang ? `/${segments.slice(2).join("/")}` : path;
    const barePath = bare === "" ? "/" : bare; // strip lang prefix → "/people/1"

    const links: MetaDescriptor[] = [];
    for (const l of SITE_LANGS) {
        // Prefix the bare path with the locale segment; the default lang has none.
        const localized = l.lang_param
            ? `/${l.lang_param}${barePath === "/" ? "" : barePath}`
            : barePath;
        const href = absoluteUrl(localized || "/");
        links.push({ tagName: "link", rel: "alternate", hrefLang: l.lang_html, href });
        if (l.default) {
            links.push({ tagName: "link", rel: "alternate", hrefLang: "x-default", href });
        }
    }
    return links;
}

/* -------------------------------------------------------------------------- */
/* The one template: build the full tag set from a flat spec                  */
/* -------------------------------------------------------------------------- */

export interface MetaSpec {
    /** Page-specific title; the site name is appended automatically. */
    title: string;
    /** Plain-text description (clamped to ~158 chars). */
    description: string;
    /** `location.pathname` — drives canonical + og:url. */
    path?: string | undefined;
    /** Site language, for og:locale. */
    lang?: MetaLang | undefined;
    /** og:type — "profile" for people, "website" default, "article" for docs. */
    type?: "website" | "profile" | "article" | undefined;
    /** Absolute image URL for social cards (person photo, chart, …). */
    image?: string | undefined;
    /** Override robots directive (e.g. "noindex" for filtered list views). */
    robots?: string | undefined;
}

/**
 * Turn a `MetaSpec` into the canonical tag array: title, description, canonical
 * link, OpenGraph, Twitter card. This is the single template every route funnels
 * through — entity builders just compute the `MetaSpec` and delegate here.
 */
export function buildMeta(spec: MetaSpec): MetaDescriptor[] {
    const title = withSite(spec.title);
    const description = clamp(spec.description, DESCRIPTION_MAX);
    const url = absoluteUrl(spec.path);
    const type = spec.type ?? "website";

    // Entity image if supplied, else the branded default card. Either way every
    // page ships an og:image, so the card is always a large-image summary.
    const image = spec.image ?? DEFAULT_OG_IMAGE;
    const usingDefaultImage = !spec.image;

    const tags: MetaDescriptor[] = [
        { title },
        { name: "description", content: description },

        // Canonical (rendered as <link rel="canonical">).
        { tagName: "link", rel: "canonical", href: url },

        // OpenGraph
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:type", content: type },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },

        // Twitter
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },

        // Alternate-language versions of this page (hreflang) + x-default.
        ...hreflangLinks(spec.path),
    ];

    if (spec.lang) tags.push({ property: "og:locale", content: OG_LOCALE[spec.lang] });

    tags.push({ property: "og:image", content: image });
    tags.push({ name: "twitter:image", content: image });
    if (usingDefaultImage) {
        // Known dimensions/type only for the branded card (entity images vary).
        tags.push({ property: "og:image:type", content: "image/png" });
        tags.push({ property: "og:image:width", content: String(DEFAULT_OG_IMAGE_W) });
        tags.push({ property: "og:image:height", content: String(DEFAULT_OG_IMAGE_H) });
        tags.push({ property: "og:image:alt", content: SITE_NAME });
    }

    if (spec.robots) tags.push({ name: "robots", content: spec.robots });

    return tags;
}
