"server-only"

import { resolveContentLangs, type ContentLang } from "~/lib/lang"
import { settingsSessionContext } from "./contexts"

/** The slice of a loader/middleware `context` this helper reads. Structurally
 *  satisfied by React Router's context provider (`Route.LoaderArgs["context"]`). */
type SettingsCtx = {
    get(context: typeof settingsSessionContext): { content_lang?: string | null } | null
}

/**
 * Content-language priority for a route's `loc()` slots, honouring the visitor's
 * saved preference. Reads `content_lang` from the settings cookie (populated by
 * `settingsMiddleware` into `settingsSessionContext`) and otherwise falls back to
 * the per-interface-language default from `resolveContentLangs`.
 *
 * This is the *UI content language* — it follows the cookie, independent of the
 * interface language (URL `:lang?`) and of the bulk-export language (URL `?langs=`).
 *
 * @param context the loader `context` (carries the settings session)
 * @param lang the `:lang?` route param, for the auto/default order
 */
export function contentLangs(context: SettingsCtx, lang: string | undefined): ContentLang[] {
    return resolveContentLangs(context.get(settingsSessionContext)?.content_lang, lang)
}
