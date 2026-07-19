"use client"

import { useEffect, useRef } from "react"
import { useFetcher, useNavigate, useParams, useRouteLoaderData } from "react-router"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { langByParam, langByLangCode, langSwitcher, SITE_LANG_CODES } from "~/lib/lang"
import { useCurrentURL } from "~/hooks/use-current-url"
import type { SiteLangs } from "@/types/site"

/** 90s — a longer-lived intro; it explains several things and shouldn't rush. */
const INTRO_DURATION = 90_000
const INTRO_TOAST_ID = "site-intro"

/**
 * The intro copy for one language. The prose lives in the `intro` block of
 * `public/locales/<lang>/loc_main.json` (loaded for every content language by
 * lang_layout) — this is only the shape.
 *  - `cookie` — only essential, functional cookies; no analytics, no tracking;
 *  - `dataLang` — content-language explainer (priority independent of the UI,
 *    adjustable under Settings → Content language);
 *  - `alt` / `switch` — the alternative-language offer, shown in the *offered*
 *    language (e.g. fr → "…en français"), so the map carries every language;
 *  - `dismiss` — "Don't show again" label.
 */
export interface IntroCopy {
    cookie: string
    dataLang: string
    alt: string
    switch: string
    dismiss: string
}

/** The intro copy in every interface language, keyed by lang code — the alternative-
 *  language offer is rendered in the offered language, so all are needed at once. */
export type IntroCopyMap = Partial<Record<SiteLangs["lang_code"], IntroCopy>>

// The offer switches the *interface* language, so only UI languages are valid
// targets — a content-only fallback like `rm` (no UI route) is excluded.
const supportedCodes = new Set<string>(SITE_LANG_CODES)

/** Browser/OS preferred languages as primary subtags ("de-CH" → "de"), in order. */
function browserPrimaryLangs(): string[] {
    if (typeof navigator === "undefined") return []
    const list = navigator.languages?.length ? navigator.languages : [navigator.language]
    const seen = new Set<string>()
    const out: string[] = []
    for (const tag of list) {
        if (!tag) continue
        const primary = tag.split("-")[0].toLowerCase()
        if (primary && !seen.has(primary)) {
            seen.add(primary)
            out.push(primary)
        }
    }
    return out
}

/**
 * One combined intro notice, merging what used to be three separate toasts:
 * cookie notice, content-language explainer, and — when the page isn't in one of
 * the visitor's browser languages but a supported one is — a one-click switch
 * offer (rendered in the offered language). Auto-dismisses after 90s; "Don't show
 * again" persists the opt-out to the settings cookie so it never returns. The
 * `intro` map (every content language's copy) is loaded by lang_layout.
 */
export default function SiteIntro({ intro }: { intro: IntroCopyMap }) {
    const rootData = useRouteLoaderData("root") as
        { settings?: { show_cookie_consent_message?: boolean } } | undefined
    const showIntro = rootData?.settings?.show_cookie_consent_message

    const { lang } = useParams()
    const currentURL = useCurrentURL()
    const navigate = useNavigate()
    const fetcher = useFetcher({ key: "siteIntroFetcher" })
    const shownRef = useRef(false)

    const { lang_code } = langByParam(lang)

    useEffect(() => {
        // Master gate: hidden once the visitor has dismissed the intro.
        if (showIntro === false) return
        if (shownRef.current) return
        shownRef.current = true

        const copy = intro[lang_code] ?? intro.en
        if (!copy) return

        // Alternative-language offer: first browser-preferred, supported language
        // that isn't the current page language (skipped when the page is already
        // in one of the visitor's languages).
        const preferred = browserPrimaryLangs()
        const alreadyPreferred = preferred.includes(lang_code)
        const targetCode = alreadyPreferred
            ? undefined
            : (preferred.find((p) => supportedCodes.has(p) && p !== lang_code) as
                  SiteLangs["lang_code"] | undefined)
        const target = targetCode ? langByLangCode(targetCode) : undefined
        // The alternative-language line + switch button address the visitor in the
        // *offered* language (Google-style): on /de/people with a French browser we
        // speak French. Cookie/content/dismiss stay in the interface language.
        const targetCopy = targetCode ? intro[targetCode] : undefined

        const persistDismiss = () => {
            // Persist the opt-out to the __settings cookie (same pattern as the
            // header Settings menu). The fetcher applies the cookie in place.
            fetcher.submit(
                {
                    payload: JSON.stringify({ show_cookie_consent_message: false, msg_lang_hint: false }),
                },
                {
                    method: "post",
                    action: "/actions/cu-settings",
                    encType: "application/x-www-form-urlencoded",
                    preventScrollReset: true,
                    defaultShouldRevalidate: false,
                }
            )
        }

        const showToast = () =>
            toast.custom(
            (id) => (
                <div className="flex w-[356px] max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10">
                    <p className="text-muted-foreground">{copy.cookie}</p>
                    <p className="text-muted-foreground">{copy.dataLang}</p>
                    {target && targetCopy ? (
                        <p className="text-muted-foreground">{targetCopy.alt}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-2">
                        {target && targetCopy ? (
                            <Button
                                size="sm"
                                onClick={() => {
                                    navigate(langSwitcher(lang, currentURL, target.lang_code))
                                    toast.dismiss(id)
                                }}
                            >
                                {targetCopy.switch}
                            </Button>
                        ) : null}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                persistDismiss()
                                toast.dismiss(id)
                            }}
                        >
                            {copy.dismiss}
                        </Button>
                    </div>
                </div>
            ),
            { id: INTRO_TOAST_ID, duration: INTRO_DURATION }
        )

        // Defer mounting until the visitor's first interaction. Lighthouse/lab
        // LCP stops updating at the first user input, so a toast shown only after
        // an interaction can never become (and delay) the LCP element. The intro
        // is purely informational, so a slight delay is a non-cost.
        const events = ["pointerdown", "keydown", "scroll"] as const
        let fired = false
        const onInteract = () => {
            if (fired) return
            fired = true
            cleanup()
            showToast()
        }
        const cleanup = () => {
            for (const ev of events) window.removeEventListener(ev, onInteract)
        }
        for (const ev of events)
            window.addEventListener(ev, onInteract, { once: true, passive: true })
        return cleanup
    }, [showIntro, lang_code, lang, currentURL, navigate, fetcher, intro])

    return null
}
