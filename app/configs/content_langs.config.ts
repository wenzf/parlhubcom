// content_langs.config.ts
//
// The single source of truth for LOCALIZED-DATA language priority — the order in
// which the SQL `loc()` picks a language for a field. Used everywhere localized
// content is resolved: page loaders (via resolveLangs / resolveContentLangs in
// lib/lang) AND the data-export feature (the <DataExport> language chooser
// + the export resource route).
//
// The priority is keyed by the visitor's INTERFACE language, so /fr/... starts
// French-first, /it/... Italian-first, etc. The general default (English UI or an
// unknown language) is German-first, since the Swiss source data is mostly in
// German and rarely has an English translation. Edit the lists here to change it.

/** The data languages `loc()` can resolve — the selectable set, canonical order. */
export const CONTENT_LANGS = ["de", "fr", "it", "rm", "en"] as const;

export type ContentLang = (typeof CONTENT_LANGS)[number];

/** loc() fallback priority per interface language: the page's own language first,
 *  then the remaining data languages. */
export const CONTENT_LANG_PRIORITY: Record<string, ContentLang[]> = {
    de: ["de", "fr", "it", "rm", "en"],
    fr: ["fr", "de", "it", "rm", "en"],
    it: ["it", "de", "fr", "rm", "en"],
    rm: ["rm", "de", "fr", "it", "en"],
    // English UI (and the prefix-less default) → German-first: most data is German.
    en: ["de", "fr", "it", "rm", "en"],
    // Spanish UI is chrome-only (no Spanish source data) → German-first, like en.
    es: ["de", "fr", "it", "rm", "en"],
    // Portuguese UI is chrome-only (no Portuguese source data) → German-first, like en.
    pt: ["de", "fr", "it", "rm", "en"],
};

/** Used when the interface language is unknown / not listed above (de-first). */
export const CONTENT_LANG_PRIORITY_DEFAULT: ContentLang[] = ["de", "fr", "it", "rm", "en"];

/** The default loc() priority for an interface language code (e.g. "fr" → French
 *  first). Falls back to the general de-first order for unknown codes. */
export function contentLangPriority(langCode: string | undefined): ContentLang[] {
    return (langCode && CONTENT_LANG_PRIORITY[langCode]) || CONTENT_LANG_PRIORITY_DEFAULT;
}
