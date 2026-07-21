// routes/home.tsx
//
// / — the homepage. Minimal by design: wordmark, one search field with
// section-scope chips, the live dataset strip — nothing else. (The "what you
// can explore" pitch lives at /project/data-guide.)
// Copy lives in /public/locales/<lang>/loc_home.json; counts come
// from home_stats.server (import_meta ledger, COUNT(*) fallback); SEO +
// WebSite/SearchAction JSON-LD from the `homeMeta` builder.
//
// The search has no global backend — it submits to the selected section's
// catalogue (?q=), which is where search actually lives. Without JS the form
// still works: it posts to the server-rendered default scope (people).

import { useEffect, useState } from "react";
import { Form, NavLink, useParams } from "react-router";
import type { Route } from "./+types/home";

import { langByParam, localizedPath } from "~/lib/lang";
import { SITE_TIME_ZONE } from "~/configs/site.config";
import { getStaticData } from "~/server/static/get_static_data.server";
import { getHomeStats, type HomeStats } from "~/server/home_stats.server";
import { homeMeta } from "~/lib/seo/metas";
import { Button, buttonVariants } from "~/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { Icon } from "~/components/icons/opd_icons";
import { LogoWordmark } from "~/components/icons/logo";
import { HomeSearchMcpTool } from "~/components/blocks/HomeSearchMcpTool";
import { MAIN_ID } from "~/components/blocks/skip-link";
import type { PageNamespaces } from "@/types/site";

export function meta({ params, location, matches }: Route.MetaArgs) {
    return homeMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const [locs, stats] = await Promise.all([
        getStaticData(["loc_home"], lang_code),
        getHomeStats(),
    ]);
    return Response.json({ locs, stats });
}

/** Search scope chips: loc_home.sections key → the section catalogue route. */
const SCOPES: { label: string; ns: PageNamespaces }[] = [
    { label: "people", ns: "NS_PEOPLE_INDEX" },
    { label: "votings", ns: "NS_VOTINGS_INDEX" },
    { label: "affairs", ns: "NS_AFFAIRS_INDEX" },
    { label: "speeches", ns: "NS_SPEECHES_INDEX" },
    { label: "bodies", ns: "NS_BODIES_INDEX" },
    { label: "groups", ns: "NS_GROUPS_INDEX" },
    { label: "meetings", ns: "NS_MEETINGS_INDEX" },
    { label: "texts", ns: "NS_TEXTS_INDEX" },
    { label: "documents", ns: "NS_DOCS_INDEX" },
    { label: "interests", ns: "NS_INTERESTS_INDEX" },
    { label: "organizations", ns: "NS_ORGANIZATIONS_INDEX" },
];

/** Per-scope search copy: example placeholder + the hint line under the input. */
export type ScopeHint = { placeholder?: string; hint?: string };

type HomeContent = {
    tagline: string;
    search_label: string;
    search_placeholder: string;
    search_button: string;
    search_scope_label: string;
    /** Keyed by SCOPES[].label; a missing entry falls back to search_placeholder. */
    search_scope_hints?: Record<string, ScopeHint>;
    sections: Record<string, string>;
    stats_updated: string;
    start_link: string;
};

export default function Home({ loaderData }: Route.ComponentProps) {
    const { locs, stats } = loaderData as unknown as {
        locs: { home: HomeContent };
        stats: HomeStats;
    };
    const c = locs.home;
    const { lang } = useParams();
    const { lang_code } = langByParam(lang);
    const [scope, setScope] = useState<PageNamespaces>("NS_PEOPLE_INDEX");

    // The search box describes the *selected* catalogue: example query in the
    // placeholder, one line naming the fields it matches underneath (same
    // information the catalogues' info tooltips carry). Both fall back to the
    // generic placeholder / no hint when a scope has no copy.
    const scopeLabel = SCOPES.find((s) => s.ns === scope)?.label;
    const scopeHint = scopeLabel ? c.search_scope_hints?.[scopeLabel] : undefined;

    // WebMCP tools call hooks unconditionally, so they must only mount on the
    // client after hydration (mirrors DimensionMcpTools' gating).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const fmt = (n: number) => n.toLocaleString(`${lang_code}-CH`);
    // `stats.updated` is an *instant* (import_meta.synced_at), so the calendar
    // day it falls on depends on the zone. Pinned to Europe/Zurich: unpinned it
    // followed the system zone, and a UTC server plus a browser west of UTC
    // rendered different days -> hydration text mismatch (React #418), which is
    // exactly what PageSpeed's US-hosted Chrome reported.
    const updated = stats.updated
        ? new Intl.DateTimeFormat(`${lang_code}-CH`, {
            dateStyle: "medium",
            timeZone: SITE_TIME_ZONE,
        }).format(new Date(stats.updated))
        : null;

    return (
        <main
            id={MAIN_ID}
            tabIndex={-1}
            // Google-start-page feel: the page is exactly one viewport, no scroll.
            // 100svh (small-viewport units — stable while mobile browser chrome
            // shows/hides) minus the header's fixed h-14 (3.5rem, see blocks/header).
            // Content overflowing on a truly tiny screen still scrolls gracefully.
            className="mx-auto flex h-[calc(100svh-3.5rem)] w-full max-w-3xl flex-col px-4 outline-none"
        >
            {/* Expose the search box to in-browser agents (WebMCP). Routes to the
                scoped catalogue, same as submitting the form — see the component. */}
            {mounted ? (
                <HomeSearchMcpTool
                    scopes={SCOPES}
                    sections={c.sections}
                    hints={c.search_scope_hints}
                    lang={lang}
                    currentScope={scope}
                />
            ) : null}

            {/* ----- hero + live dataset strip, centered in the viewport ----- */}
            <section className="flex flex-1 flex-col items-center justify-center gap-10">
                {/* ----- hero: wordmark, tagline, search ----- */}
                <div className="flex w-full flex-col items-center gap-6 text-center">
                    <h1 className="sr-only">parlhub</h1>
                    <LogoWordmark className="h-10" />
                    <p className="text-lg text-muted-foreground">{c.tagline}</p>

                    <Form
                        method="get"
                        action={localizedPath(lang, scope)}
                        // Declarative WebMCP: the same `home_search` identity the
                        // imperative HomeSearchMcpTool registers, but server-rendered
                        // so Lighthouse's form-coverage audit sees it pre-hydration.
                        // See types/webmcp.d.ts.
                        toolname="home_search"
                        tooldescription="Search parlhub's Swiss and Liechtenstein parliamentary data; submitting navigates to the selected section's catalogue with the query applied."
                        className="flex w-full max-w-xl flex-col gap-2"
                    >
                        {/* Mobile: input on its own line, scope select + button underneath.
                            Desktop (md+): input + button on one row, scope chips below. */}
                        <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
                            <label htmlFor="home-search" className="sr-only">
                                {c.search_label}
                            </label>
                            <input
                                id="home-search"
                                type="search"
                                name="q"
                                placeholder={scopeHint?.placeholder ?? c.search_placeholder}
                                aria-describedby="home-search-hint"
                                className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
                            />
                            <div className="flex items-center gap-2">
                                {/* Scope picker on mobile only — chips take over at md+. */}
                                <Select
                                    value={scope}
                                    onValueChange={(v) => setScope(v as PageNamespaces)}
                                >
                                    <SelectTrigger
                                        id="home-scope"
                                        aria-label={c.search_scope_label}
                                        className={buttonVariants({
                                            variant: "outline",
                                            className: "min-w-0 flex-1 md:hidden",
                                        })}
                                    >
                                        <SelectValue>
                                            {(value) => {
                                                const s = SCOPES.find((x) => x.ns === value);
                                                return s ? c.sections[s.label] ?? s.label : null;
                                            }}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SCOPES.map((s) => (
                                            <SelectItem key={s.ns} value={s.ns}>
                                                {c.sections[s.label] ?? s.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button type="submit" variant="outline">
                                    <Icon name="search" />
                                    {c.search_button}
                                </Button>
                            </div>
                        </div>

                        {/* What the selected catalogue's search matches. Reserved
                            height so switching scope never shifts the layout;
                            polite live region so the change is announced. */}
                        <p
                            id="home-search-hint"
                            aria-live="polite"
                            className="min-h-4 text-left text-xs text-muted-foreground md:text-center"
                        >
                            {scopeHint?.hint}
                        </p>
                    </Form>

                    <div
                        role="group"
                        aria-label={c.search_scope_label}
                        className="hidden flex-wrap justify-center gap-2 md:flex"
                    >
                        {SCOPES.map((s) => (
                            <Button
                                key={s.ns}
                                type="button"
                                size="sm"
                                variant={scope === s.ns ? "secondary" : "ghost"}
                                aria-pressed={scope === s.ns}
                                onClick={() => setScope(s.ns)}
                                className={scope === s.ns ? "" : "text-muted-foreground"}
                            >
                                {c.sections[s.label] ?? s.label}
                            </Button>
                        ))}
                    </div>

                    {/* Guided entry for anyone the catalogue search is too abstract for:
            /start lists chambers, cantons and communes as plain links.
            Inline (not the flex InternalLink) so the trailing arrow flows with
            the last word instead of pinning to the right edge when text wraps. */}
                    <NavLink
                        to={localizedPath(lang, "NS_START")}
                        end
                        viewTransition
                        className="text-sm font-medium text-primary underline-offset-4 rounded-sm hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        {c.start_link}
                        <Icon
                            name="arrow-right"
                            className="ml-1 inline-block size-3.5 align-middle"
                        />
                    </NavLink>
                </div>

                {/* ----- live dataset strip ----- */}
                {stats.items.length > 0 && (
                    <div className="flex flex-col items-center gap-2 text-center">
                        <p className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
                            {/* Count links hidden on mobile; the sync date below stays visible. */}
                            {stats.items.map((it, i) => (
                                <span key={it.ns} className="hidden items-center gap-x-2 md:inline-flex">
                                    <NavLink
                                        to={localizedPath(lang, it.ns)}
                                        end
                                        viewTransition
                                        className="rounded-sm underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                    >
                                        {fmt(it.count)}&nbsp;{c.sections[it.label] ?? it.label}
                                    </NavLink>
                                    {i < stats.items.length - 1 && <span aria-hidden="true">·</span>}
                                </span>
                            ))}
                            {/* Last data sync — flows as the strip's final item. */}
                            {updated && (
                                <span className="inline-flex items-center gap-x-2">
                                    <span aria-hidden="true" className="hidden md:inline">
                                        ·
                                    </span>
                                    <span>
                                        {c.stats_updated}: {updated}
                                    </span>
                                </span>
                            )}
                        </p>
                    </div>
                )}
            </section>
        </main>
    );
}
