// /app/lib/lang.ts

import { createPath, type Params, type Path } from "react-router";


import { PAGE_CONFIG, SITE_LANGS } from "~/configs/site.config"
import { CONTENT_LANGS, contentLangPriority, type ContentLang } from "~/configs/content_langs.config"
import type { PageNamespaces, SiteLangs } from "@/types/site";

// Re-exported so existing importers (`from "~/lib/lang"`) keep working; the
// canonical definition + the per-language priority live in content_langs.config.
export { CONTENT_LANGS, type ContentLang } from "~/configs/content_langs.config"

/** The interface (UI) languages, as lang codes — the languages the URL can switch
 *  to. Narrower than CONTENT_LANGS: e.g. `rm` is a data-content fallback but not a
 *  UI language, so it isn't here. */
export const SITE_LANG_CODES = SITE_LANGS.map((l) => l.lang_code)


/* -------------------------------- labels (loc) ---------------------------- */

/** Replace `{token}` placeholders from `vars`; unknown tokens are left verbatim
 *  (a literal `{` in real data is never a known token, so data is never mangled). */
export function substitute(tpl: string, vars: Record<string, string | number>): string {
    return tpl.replace(/\{(\w+)\}/g, (whole, key: string) =>
        key in vars ? String(vars[key]) : whole,
    );
}

/** Label lookup: returns `loc[key]`, falling back to the key itself when the
 *  loc map has no entry (so `t("color")` → `"color"` when unlocalized). A label
 *  that has to name what it describes (a chart's `aria-label`) is a tokenized
 *  template and takes `vars`: `t("loyalty_chart_alt", { count: 46, ctx })`.
 *  Grammar stays in TS, the JSON holds flat strings only. */
export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

/** Build a `t(key)` from a loc map. Usage: `const t = makeT(loc);` */
export function makeT(loc: Record<string, string> = {}): TFunc {
    return (key, vars) => {
        const tpl = loc[key] ?? key;
        return vars ? substitute(tpl, vars) : tpl;
    };
}



/**
 * @description `SiteLangs` entry by lang param
 * @param langParam `:lang?`
 * @returns `SiteLangs` / `SITE_LANGS`
 */


export const langByParam = (
    langParam: string | undefined | Params
): SiteLangs & { is_fallback?: boolean } => {

    const config = SITE_LANGS as SiteLangs[];

    let defaultCase = config[0];
    if (typeof langParam === 'string') {
        for (let i = 0; i < config.length; i += 1) {
            const entry = config[i];
            if (entry.default) defaultCase = entry;
            if (langParam === entry.lang_param) return entry
        }

        return {
            ...defaultCase,
            is_fallback: true
        }
    }
    return {
        ...defaultCase
    }
}


/**
 * @description `SiteLangs` entry by `SiteLangs.lang_code`
 * @param langCode `SiteLangs.lang_code`
 * @returns `SiteLangs` / `SITE_LANGS`
 */

export const langByLangCode = (
    langCode: SiteLangs["lang_code"]
): SiteLangs => {

    const config = SITE_LANGS as SiteLangs[];
    for (let i = 0; i < config.length; i += 1) {
        if (config[i].lang_code === langCode) return config[i]
    }
    // fallback
    return config[0]
}

/**
 * @description SQL localization priority for a route: the URL's lang first, then
 * the standard CH fallbacks (de, fr, it, rm, en). Consumed by the paginated /
 * list runners as the $2..$6 loc() slots. Missing lang → the default order.
 * @param lang the `:lang?` route param
 * @returns language codes, highest priority first
 */
export function resolveLangs(lang: string | undefined): string[] {
    return contentLangPriority(langByParam(lang).lang_code);
}

const isContentLang = (v: unknown): v is ContentLang =>
    typeof v === "string" && (CONTENT_LANGS as readonly string[]).includes(v);

/**
 * Content-language priority for loc(): the visitor's chosen primary data
 * language first, then the remaining supported languages in canonical order.
 * Mirrors the bulk-export chooser (pick the primary, rest follows canonically).
 *
 * `content_lang` (from the settings cookie) wins when set; otherwise the primary
 * defaults to the page/interface language — so a German page yields
 * `[de, fr, it, rm, en]`, a French page `[fr, de, it, rm, en]`. The interface
 * language and the content language are independent: a visitor can read the UI
 * in English while preferring German data.
 *
 * @param contentLang the stored `Settings.content_lang` (or null/undefined → auto)
 * @param lang the `:lang?` route param (drives the auto default)
 */
export function resolveContentLangs(
    contentLang: string | null | undefined,
    lang: string | undefined
): ContentLang[] {
    // Default (no explicit setting): the per-interface-language priority from
    // content_langs.config (English/unknown → de-first).
    const base = contentLangPriority(langByParam(lang).lang_code);
    // A stored content_lang wins: promote it to the front, keep the config order.
    if (isContentLang(contentLang)) {
        return [contentLang, ...base.filter((l) => l !== contentLang)];
    }
    return base;
}

export function replaceDoubleTrailingSlash(path: string) {
    if (path.startsWith('//')) {
        return createPath({ pathname: path.replace('//', '/') })
    }
    return createPath({ pathname: path })
}

export const langSwitcher = (
    param: string | undefined | Params,
    path: string,
    targetLang: SiteLangs["lang_code"]
): string => {
    const target = langByLangCode(targetLang);
    const target_lang_param = target.lang_param;
    let out = '';
    if (path === '/' && param === undefined) {
        out = replaceDoubleTrailingSlash(`/${target_lang_param}`)
    } else if (param === undefined) {
        out = replaceDoubleTrailingSlash(`/${target_lang_param}${path}`)
    } else if (target_lang_param === '') {
        out = replaceDoubleTrailingSlash(
            path.replace(`/${param}`, `/${target_lang_param}`))
    } else {
        out = replaceDoubleTrailingSlash(
            path.replace(`/${param}`, `/${target_lang_param}`))
    }

    if (out.endsWith('/')) out = out.substring(0, out.length - 1);

    return createPath({ pathname: out })
}


/**
 * @description creates localized URL path by lang param and path fragment `:lang?/<path>`
 * @param langParam `:lang?`
 * @param pathFragment <path>
 * @returns localized URL pathname
 */

export const createLangPathByParam = (
    langParam: string | undefined,
    pathFragment: string
): Path["pathname"] => {

    let newPath = ''
    const langParams = SITE_LANGS.map((it) => it.lang_param)
    const param = langParam ?? ''
    if (langParams.includes(param as any)) {
        newPath = `/${param}${pathFragment}`
    } else {
        if (pathFragment === '/') {
            newPath = '/'
        } else {
            newPath = pathFragment
        }
    }
    if (newPath.endsWith('/')) newPath = newPath.substring(0, newPath.length - 1);
    if (newPath.startsWith('//')) newPath = newPath.substring(1)
    return createPath({ pathname: newPath })
}

export function createPathByPageNS(pageNamespace: PageNamespaces): Path["pathname"] {


    let path = PAGE_CONFIG?.[pageNamespace]?.absolute_path
    if (path) return path
    return '/'
}

const replacePathParams = (path: string, params: Params): string => {
    return path.replace(/:([^/]+)/g, (match, key) => {
        return params[key] !== undefined ? String(params[key]) : match;
    });
};

export function localizedPath(
    lang: Params["lang"],
    pageNamespace: PageNamespaces,
    param?: Params
): Path["pathname"] {
    let path = createPathByPageNS(pageNamespace)
    if (param) {
        path = replacePathParams(path, param)
    }
    return createLangPathByParam(lang, path)

}