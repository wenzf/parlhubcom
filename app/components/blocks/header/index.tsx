"use client"

import { useReducer, useState } from "react"
import { NavLink, useFetcher, useMatches, useRouteLoaderData, useNavigate, useParams } from "react-router"

import { Minus, Plus } from "lucide-react"

import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

import { langSwitcher, langByParam, makeT, resolveContentLangs, CONTENT_LANGS, localizedPath } from '../../../lib/lang'
import type { SiteLangs } from '@/types/site'
import { useCurrentURL } from '../../../hooks/use-current-url'
import { Icon } from '~/components/icons/opd_icons'
import { LogoMark } from '~/components/icons/logo'

import { SITE_LANGS, REPO_URL, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from '../../../configs/site.config'

// Ghost select trigger for use inside a grouped settings list: the card border
// supplies the boundary, so the control drops its own border/fill and reads as
// a value + chevron (Apple/Vercel "border-first"). It's the trailing control, so
// its hover surface bleeds to the frame — `rounded-r-none` squares the trailing
// corner and the card's `overflow-hidden` clips it flush (no sliver). Focus ring
// is inset so the card's clip doesn't eat it. Value uses muted-foreground (7:1).
const GHOST_TRIGGER =
    "w-auto gap-1.5 rounded-r-none border-transparent bg-transparent px-2.5 text-sm text-muted-foreground shadow-none hover:bg-muted hover:text-foreground focus-visible:ring-inset focus-visible:ring-offset-0 dark:bg-transparent dark:hover:bg-muted"

// The Explore panel renders the shared section grouping (labels via loc_main
// `nav.*`; the sidebar renders the same groups via `section_switcher`).
import { NAV_SECTION_GROUPS } from '~/configs/sidebars.config'

// Header-only Explore addition: the Experiments section links to the standalone
// experiment write-ups. These aren't a data section, so they live neither in
// NAV_SECTION_GROUPS nor the sidebar — appended here as one more group in the grid.
const NAV_EXPLORE_GROUPS: typeof NAV_SECTION_GROUPS = [
    ...NAV_SECTION_GROUPS,
    {
        group: "experiments",
        items: [
            { label: "wordfish", ns: "NS_EXPERIMENTS_WORDFISH", icon: "scatter-chart" },
        ],
    },
]

// Static site pages grouped under the "Project" dropdown. More items land here
// later; each row shows a label + short description (loc `nav.*`).
const PROJECT_ITEMS = [
    { ns: "NS_PROJECT_INDEX", icon: "info", label: "project", desc: "project_desc", logo: true },
    { ns: "NS_PROJECT_DATA_GUIDE", icon: "search", label: "data_guide", desc: "data_guide_desc", logo: false },
    { ns: "NS_PROJECT_DATA_MAP", icon: "database", label: "data_map", desc: "data_map_desc", logo: false },
    { ns: "NS_PROJECT_METHODOLOGY", icon: "braces", label: "methodology", desc: "methodology_desc", logo: false },
    { ns: "NS_ABOUT", icon: "info", label: "about", desc: "about_desc", logo: false },
    { ns: "NS_FAQ", icon: "message-square-quote", label: "faq", desc: "faq_desc", logo: false },
    { ns: "NS_SUSTAINABILITY", icon: "globe", label: "sustainability", desc: "sustainability_desc", logo: false },
    { ns: "NS_ACCESSIBILITY", icon: "heart-handshake", label: "accessibility", desc: "accessibility_desc", logo: false },
    { ns: "NS_TRAFFIC_STATS", icon: "scatter-chart", label: "traffic_stats", desc: "traffic_stats_desc", logo: false },
    { ns: "NS_IMPRINT", icon: "id-card", label: "imprint", desc: "imprint_desc", logo: false },
] as const

export default function Header() {
    const { settings } = useRouteLoaderData('root')
    // Localized settings labels from `/public/locales/<lang>/loc_main.json`, loaded
    // by the lang layout. `t(key)` returns the key itself when the loc map has no
    // entry, so the menu never renders blank.
    const langLayoutData = useRouteLoaderData('routes/layouts/lang_layout') as
        { locs?: { settings?: Record<string, string>; nav?: Record<string, string> } } | undefined
    const t = makeT(langLayoutData?.locs?.settings)
    const tNav = makeT(langLayoutData?.locs?.nav)
    const settingsFetchter = useFetcher({ key: 'settingsFetcher' })
    const navigate = useNavigate()
    const { lang } = useParams()
    // The mobile brand → home mark is surfaced ONLY on the OPD data routes (they
    // sit under data_dashboard_layout, where the wordmark is off-canvas in the
    // sidebar). Home / start / project / experiments carry their own brand mark,
    // so the header stays clean there.
    const onDataRoute = useMatches().some(
        (m) => m.id === "routes/layouts/data_dashboard_layout",
    )
    // Controlled open-state: React Router link clicks navigate client-side, so the
    // dropdown otherwise stays open (esp. on mobile). Mirroring Base UI's value lets
    // us force it shut on link activation — the WAI-ARIA-expected close-on-select.
    const [navValue, setNavValue] = useState<string | null>(null)
    const closeNav = () => setNavValue(null)
    // The header's left slot stays empty: home has the hero mark, the dashboard
    // has the sidebar footer wordmark, and the /project pages get their brand →
    // home link from project_layout. Menus stay right-aligned via justify-between.
    const currentURL = useCurrentURL()
    const { lang_code } = langByParam(lang)
    const [{
        theme,
        isOpen,
        font_size,
        ui_grayscale,
        ui_high_contrast,
        content_lang
    }, dispatch] = useReducer(((st, act) => {
        return {
            ...st,
            ...act.reduce((
                i: Record<string, unknown>,
                j: Record<string, unknown>
            ) => ({ ...i, ...j }), {})
        }
    }), {
        font_size: settings.font_size,
        theme: settings.theme,
        isOpen: false,
        ui_grayscale: settings.ui_grayscale,
        ui_high_contrast: settings.ui_high_contrast,
        content_lang: settings.content_lang ?? null
    })

    // Preview of the loc() priority the current content-language choice yields,
    // e.g. "DE › FR › IT › RM › EN". Mirrors resolveContentLangs on the server.
    const contentPriority = resolveContentLangs(content_lang, lang)
        .map((c) => c.toUpperCase())
        .join(" › ")

    // Content language persists like the other settings but must reload the
    // current page's data: no revalidate-suppression here, so the fetcher's
    // completion re-runs the loaders in place with the new loc() priority.
    const onChangeContentLang = (value: SiteLangs["lang_code"] | null) => {
        dispatch([{ content_lang: value }])
        settingsFetchter.submit({
            payload: JSON.stringify({ content_lang: value }),
        }, {
            method: "post",
            action: "/actions/cu-settings",
            encType: "application/x-www-form-urlencoded",
            preventScrollReset: true,
        })
    }

    const onSwitchLang = (it: SiteLangs) => {
        const targetLangCode = it.lang_code

        navigate(
            langSwitcher(
                lang,
                currentURL,
                targetLangCode
            ))

    }



    const onChangeSettings = (key: string, value: string | number | boolean) => {
        if (typeof document === "object") {
            const doc = document.documentElement
            const body = document.body
            let additionalValue = {}
            if (key === "theme") {
                if (doc.classList.contains(theme)) doc.classList.replace(theme, value as string)

            } else if (key === "font_size") {
                doc.style.fontSize = `${value}%`
            } else if (key === "ui_high_contrast") {
                if (value) {
                    doc.classList.add('contrast')
                } else {
                    doc.classList.remove('contrast')
                }
            } else if (key === "ui_grayscale") {
                if (value) {
                    doc.classList.add('grayscale')
                } else {
                    doc.classList.remove('grayscale')
                }
            }

            dispatch([{ ...additionalValue, [key]: value }])

            settingsFetchter.submit({
                payload: JSON.stringify({ ...additionalValue, [key]: value }),
            }, {
                method: "post",
                action: "/actions/cu-settings",
                encType: "application/x-www-form-urlencoded",
                preventScrollReset: true,
                defaultShouldRevalidate: false
            })
        }
    }


    return (

        <header
            // Explicit h-14: the home page sizes itself to the exact remainder
            // (h-[calc(100svh-3.5rem)] in routes/home.tsx) so the start page fills
            // the viewport without scrolling — keep the two in sync.
            className="flex h-14 w-full shrink-0 items-center justify-between gap-1 px-2"
            data-print-hide
        >

            {/* Left slot: empty on desktop (the brand → home link lives in
                project_layout / the hero / the sidebar footer). On mobile — and
                only on the OPD data routes, where the sidebar carrying the wordmark
                is off-canvas — surface just the narrow hemicycle mark here as a home
                link, on the nav-menu row. The span stays as the flex placeholder so
                justify-between keeps the nav menu right-aligned even when the link
                is absent / display:none. */}
            <span className="flex items-center">
                {onDataRoute ? (
                    <NavLink
                        to={localizedPath(lang, "NS_LANG_LAYOUT")}
                        viewTransition
                        aria-label={tNav("home")}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:hidden"
                    >
                        <LogoMark className="size-6" />
                    </NavLink>
                ) : null}
            </span>

            <NavigationMenu value={navValue} onValueChange={setNavValue}>
                <NavigationMenuList>
                    <NavigationMenuItem>
                        <NavigationMenuTrigger>{tNav("explore")}</NavigationMenuTrigger>
                        <NavigationMenuContent>
                            {/* Guided quicklinks entry point — same plain link style as
                                the section rows below (icon + label), no featured card. */}
                            <div className="p-2 pb-0">
                                <NavigationMenuLink
                                    render={
                                        <NavLink
                                            to={localizedPath(lang, "NS_START")}
                                            end
                                            viewTransition
                                            onClick={closeNav}
                                            className="flex min-h-11 flex-row items-start gap-2 rounded-md px-2 text-sm"
                                        >
                                            <Icon
                                                name="map-pin"
                                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                            />
                                            <span className="flex flex-col gap-0.5">
                                                <span>{tNav("start")}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {tNav("start_desc")}
                                                </span>
                                            </span>
                                        </NavLink>
                                    }
                                />
                            </div>
                            <div className="grid w-full grid-cols-1 gap-4 p-2 sm:w-[440px] sm:grid-cols-2">
                                {NAV_EXPLORE_GROUPS.map((g) => (
                                    <div key={g.group} className="flex flex-col gap-1">
                                        <p className="px-2 text-xs font-medium text-muted-foreground">
                                            {tNav(g.group)}
                                        </p>
                                        <ul className="flex flex-col">
                                            {g.items.map((it) => (
                                                <li key={it.ns}>
                                                    <NavigationMenuLink
                                                        render={
                                                            <NavLink
                                                                to={localizedPath(lang, it.ns)}
                                                                end
                                                                viewTransition
                                                                onClick={closeNav}
                                                                className="flex min-h-11 flex-row items-center gap-2 text-sm"
                                                            >
                                                                <Icon
                                                                    name={it.icon}
                                                                    className="size-4 shrink-0 text-muted-foreground"
                                                                />
                                                                {tNav(it.label)}
                                                            </NavLink>
                                                        }
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </NavigationMenuContent>
                    </NavigationMenuItem>
                    <NavigationMenuItem>
                        <NavigationMenuTrigger>{tNav("project")}</NavigationMenuTrigger>
                        <NavigationMenuContent>
                            {/* The first item is the /project INDEX; the rest are its
                                child pages — indented behind a hairline tree rule so the
                                hierarchy is visible at a glance. */}
                            <ul className="flex w-full flex-col p-2 sm:w-[300px]">
                                {PROJECT_ITEMS.map((it, i) => (
                                    <li
                                        key={it.ns}
                                        className={i > 0 ? "ml-4 border-l border-border pl-1" : undefined}
                                    >
                                        <NavigationMenuLink
                                            render={
                                                <NavLink
                                                    to={localizedPath(lang, it.ns)}
                                                    end
                                                    viewTransition
                                                    onClick={closeNav}
                                                    className="flex min-h-11 flex-row items-start gap-2 p-2 text-sm"
                                                >
                                                    {it.logo ? (
                                                        <LogoMark className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                    ) : (
                                                        <Icon
                                                            name={it.icon}
                                                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                                        />
                                                    )}
                                                    <span className="flex flex-col gap-0.5">
                                                        <span>{tNav(it.label)}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {tNav(it.desc)}
                                                        </span>
                                                    </span>
                                                </NavLink>
                                            }
                                        />
                                    </li>
                                ))}
                                {/* The source repository — off-site, so it sits outside
                                    the tree rule (it's no /project child page) behind a
                                    hairline, and takes the new-tab + external-glyph
                                    treatment every other outbound link uses. */}
                                <li className="mt-1 border-t border-border pt-1">
                                    <NavigationMenuLink
                                        render={
                                            <a
                                                href={REPO_URL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={closeNav}
                                                className="flex min-h-11 flex-row items-start gap-2 p-2 text-sm"
                                            >
                                                <Icon
                                                    name="github"
                                                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                                />
                                                <span className="flex flex-col gap-0.5">
                                                    <span className="inline-flex items-center gap-1">
                                                        {tNav("github")}
                                                        <Icon
                                                            name="external-link"
                                                            className="size-3 shrink-0 text-muted-foreground"
                                                        />
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {tNav("github_desc")}
                                                    </span>
                                                </span>
                                            </a>
                                        }
                                    />
                                </li>
                            </ul>
                        </NavigationMenuContent>
                    </NavigationMenuItem>
                    <NavigationMenuItem>
                        <NavigationMenuTrigger>{t("menu_label")}</NavigationMenuTrigger>
                        <NavigationMenuContent>
                            {/* Settings menu — reference implementation of the styleguide
                                "Grouped list" pattern: related settings sit in an inset card
                                with hairline row dividers (Apple HIG), controls are ghost
                                (border-first / Vercel) since the card supplies the boundary,
                                on/off uses switches (WCAG APG), radii are concentric
                                (panel xl > card lg > control md). */}
                            <div className="flex w-full flex-col gap-4 p-2 sm:w-[264px]">
                                <div className="flex flex-col gap-1.5">
                                    <p className="px-1 text-xs font-medium text-muted-foreground">{t("appearance")}</p>
                                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                                        <div className="flex h-11 items-center justify-between gap-2 pl-3 pr-0">
                                            <span className="text-sm">{t("theme")}</span>
                                            <Select value={theme} onValueChange={(v) => onChangeSettings("theme", v)}>
                                                <SelectTrigger className={GHOST_TRIGGER}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem className="text-sm" value="system">{t("theme_system")}</SelectItem>
                                                    <SelectItem className="text-sm" value="light">{t("theme_light")}</SelectItem>
                                                    <SelectItem className="text-sm" value="dark">{t("theme_dark")}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="flex h-11 items-center justify-between gap-2 pl-3 pr-0">
                                            <span className="text-sm">{t("font_size")}</span>
                                            <div className="flex items-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={t("font_size_decrease")}
                                                    disabled={font_size <= FONT_SIZE_MIN}
                                                    onClick={() => onChangeSettings("font_size", Math.max(FONT_SIZE_MIN, font_size - FONT_SIZE_STEP))}
                                                >
                                                    <Minus className="size-4" />
                                                </Button>
                                                <span className="w-11 text-center text-sm tabular-nums">{font_size}%</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="rounded-r-none focus-visible:ring-inset focus-visible:ring-offset-0"
                                                    aria-label={t("font_size_increase")}
                                                    disabled={font_size >= FONT_SIZE_MAX}
                                                    onClick={() => onChangeSettings("font_size", Math.min(FONT_SIZE_MAX, font_size + FONT_SIZE_STEP))}
                                                >
                                                    <Plus className="size-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <label className="flex h-11 cursor-pointer items-center justify-between gap-2 pl-3 pr-3.5">
                                            <span className="text-sm">{t("high_contrast")}</span>
                                            <Switch
                                                checked={ui_high_contrast}
                                                onCheckedChange={(v) => onChangeSettings("ui_high_contrast", v)}
                                            />
                                        </label>

                                        <label className="flex h-11 cursor-pointer items-center justify-between gap-2 pl-3 pr-3.5">
                                            <span className="text-sm">{t("grayscale")}</span>
                                            <Switch
                                                checked={ui_grayscale}
                                                onCheckedChange={(v) => onChangeSettings("ui_grayscale", v)}
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <p className="px-1 text-xs font-medium text-muted-foreground">{t("language")}</p>
                                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                                        {/* Interface language — rewrites the URL (:lang? param). */}
                                        <div className="flex h-11 items-center justify-between gap-2 pl-3 pr-0">
                                            <span className="text-sm">{t("interface_language")}</span>
                                            <Select
                                                value={lang_code}
                                                onValueChange={(code) => {
                                                    const it = SITE_LANGS.find((l) => l.lang_code === code)
                                                    if (it) onSwitchLang(it)
                                                }}
                                            >
                                                <SelectTrigger className={GHOST_TRIGGER}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SITE_LANGS.map((it) => (
                                                        <SelectItem className="text-sm" key={it.lang_code} value={it.lang_code}>
                                                            {it.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {/* Content (data) language — the primary loc() slot; independent of
                                            the interface. "Auto" follows the interface language. */}
                                        <div className="flex h-11 items-center justify-between gap-2 pl-3 pr-0">
                                            <span className="text-sm">{t("content_language")}</span>
                                            <Select
                                                value={content_lang ?? "auto"}
                                                onValueChange={(v) =>
                                                    onChangeContentLang(v === "auto" ? null : (v as SiteLangs["lang_code"]))
                                                }
                                            >
                                                <SelectTrigger className={GHOST_TRIGGER}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                {/* Dropdown defaults to the (narrow) trigger width and clips overflow;
                                                    widen it so the long "Auto (follow interface)" option is never cut. */}
                                                <SelectContent className="min-w-56">
                                                    <SelectItem className="text-sm" value="auto">{t("content_language_auto")}</SelectItem>
                                                    {CONTENT_LANGS.map((code) => {
                                                        const it = SITE_LANGS.find((l) => l.lang_code === code)
                                                        return (
                                                            <SelectItem className="text-sm" key={code} value={code}>
                                                                {it?.label ?? code}
                                                            </SelectItem>
                                                        )
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <p className="px-1 text-xs text-muted-foreground">
                                        {t("content_language_priority")}: <span className="tabular-nums">{contentPriority}</span>
                                    </p>
                                    <p className="px-1 text-xs text-muted-foreground">{t("content_language_note")}</p>
                                </div>
                            </div>
                        </NavigationMenuContent>
                    </NavigationMenuItem>
                </NavigationMenuList>
            </NavigationMenu>
        </header>
    )
}
