// routes/pages/start/start.tsx
//
// /start — "Start here" quicklinks. A guided entry point for users who find the
// abstract catalogue too hard: curated links to the federal chambers + their
// sub-pages, the full 26-canton grid, and the ~460 communal parliaments. Not a
// data section (no data sidebar) — mounted under lang_layout.
//
// One search box at the top filters the whole page client-side. Empty query →
// federal cards + all 26 cantons in full (communes stay a "type to search" hint,
// since ~460 is too many to dump). A query filters all three sections at once —
// federal by body/chamber name, cantons and communes by name/canton code. The
// commune index ships whole in the loader (~460 rows, tiny), so filtering never
// hits the server. Federal chambers (Nationalrat / Ständerat) are groups of ONE
// body, so their links deep-link into that body's chamber-filtered votings
// (`?chamber=<id>`). Copy: /public/locales/<lang>/loc_start.json.

import { useMemo, useState } from "react";
import { NavLink, useParams, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/start";

import { LogoWordmark } from "~/components/icons/logo";
import { langByParam, localizedPath, makeT } from "~/lib/lang";
import { bodyHref } from "~/lib/urls/hrefs";
import { startMeta } from "~/lib/seo/metas";
import { getStaticData } from "~/server/static/get_static_data.server";
import {
    getStartData,
    type StartData,
    type StartLink,
    type FederalBody,
} from "~/server/start_data.server";
import { InternalLink } from "~/components/opd_views/opd_micros";
import { Icon } from "~/components/icons/opd_icons";
import { MAIN_ID } from "~/components/blocks/skip-link";
import type { PageNamespaces } from "@/types/site";

type StartContent = {
    title: string;
    lede: string;
    search_label: string;
    search_placeholder: string;
    no_matches: string;
    federal_heading: string;
    federal_sub: string;
    chambers_label: string;
    cantonal_heading: string;
    cantonal_sub: string;
    communal_heading: string;
    communal_sub: string;
    communal_intro: string;
    results_count: string;
    results_capped: string;
    link_overview: string;
    link_members: string;
    link_votings: string;
    link_lobby: string;
    link_alignment: string;
    link_loyalty: string;
    link_affairs: string;
};

export function meta({ params, location, matches }: Route.MetaArgs) {
    return startMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const [locs, data] = await Promise.all([
        getStaticData(["loc_start"], lang_code),
        getStartData(lang_code),
    ]);
    return Response.json({ locs, data });
}

// Body sub-page chips shown on every federal card, in reading order.
const BODY_LINKS: { key: keyof StartContent; ns: PageNamespaces }[] = [
    { key: "link_members", ns: "NS_BODIES_PEOPLE" },
    { key: "link_votings", ns: "NS_BODIES_VOTINGS" },
    { key: "link_lobby", ns: "NS_BODIES_LOBBY" },
    { key: "link_alignment", ns: "NS_BODIES_ALIGNMENT" },
    { key: "link_loyalty", ns: "NS_BODIES_LOYALTY" },
    { key: "link_affairs", ns: "NS_BODIES_AFFAIRS" },
];

const CHIP =
    "inline-flex min-h-11 items-center rounded-md border border-border/60 bg-muted/60 px-3 text-sm text-foreground no-underline hover:border-input outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const PLACE_LINK =
    "flex min-h-11 items-center gap-2.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2 no-underline hover:border-input outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Strip case + diacritics so "Zurich" matches "Zürich". */
const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** Cap on commune results rendered at once — the index is ~460 rows. */
const COMMUNE_LIMIT = 60;

export default function Start({ loaderData }: Route.ComponentProps) {
    const { locs, data } = loaderData as unknown as {
        locs: { start: StartContent };
        data: StartData;
    };
    const c = locs.start;
    const { lang } = useParams();
    const langLayoutData = useRouteLoaderData("routes/layouts/lang_layout") as
        | { locs?: { nav?: Record<string, string> } }
        | undefined;
    const tNav = makeT(langLayoutData?.locs?.nav);

    const [q, setQ] = useState("");
    const nq = norm(q.trim());
    const searching = nq.length > 0;

    // Filter every section against the one query. Empty query → federal + cantons
    // shown in full; communes wait for a search (see the section below).
    const federal = useMemo(
        () =>
            !searching
                ? data.federal
                : data.federal.filter(
                    (b) =>
                        norm(b.name).includes(nq) ||
                        b.chambers.some((ch) => norm(ch.name).includes(nq)),
                ),
        [nq, searching, data.federal],
    );
    const cantons = useMemo(
        () =>
            !searching
                ? data.cantons
                : data.cantons.filter(
                    (ct) =>
                        norm(ct.name).includes(nq) || (ct.canton ? norm(ct.canton).includes(nq) : false),
                ),
        [nq, searching, data.cantons],
    );
    // All commune matches; the list is capped for render but the count is not, so
    // "N matches" reflects the true total (and "showing X of N" when capped).
    const communeMatches = useMemo(
        () =>
            !searching
                ? []
                : data.communes.filter(
                    (m) => norm(m.name).includes(nq) || (m.canton ? norm(m.canton).includes(nq) : false),
                ),
        [nq, searching, data.communes],
    );
    const communes = communeMatches.slice(0, COMMUNE_LIMIT);

    const nothing =
        searching && federal.length === 0 && cantons.length === 0 && communeMatches.length === 0;

    const sub = (ns: PageNamespaces, id: number, qs?: string) =>
        `${localizedPath(lang, ns, { id: String(id) })}${qs ? `?${qs}` : ""}`;

    return (
        <>
            <div className="px-2 py-1" data-print-hide>
                <NavLink
                    to={localizedPath(lang, "NS_LANG_LAYOUT")}
                    viewTransition
                    aria-label={tNav("home")}
                    className="inline-flex h-11 items-center rounded-md px-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <LogoWordmark className="h-6" />
                </NavLink>
            </div>
            <main
                id={MAIN_ID}
                tabIndex={-1}
                className="mx-auto flex w-full max-w-5xl flex-col gap-12 p-4 pt-0 pb-16 outline-none"
            >
                <header className="flex flex-col gap-4 pt-8">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            {c.title}
                        </h1>
                        <p className="max-w-2xl text-base text-muted-foreground">{c.lede}</p>
                    </div>

                    {/* One search that filters the whole page — no requests while typing. */}
                    <div className="flex h-11 w-full max-w-xl items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring">
                        <Icon name="search" className="size-4 shrink-0 text-muted-foreground" />
                        <label htmlFor="start-search" className="sr-only">
                            {c.search_label}
                        </label>
                        <input
                            id="start-search"
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={c.search_placeholder}
                            autoComplete="off"
                            className="h-full w-full min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                        />
                    </div>
                </header>

                {nothing && (
                    <p className="text-sm text-muted-foreground">
                        {c.no_matches.replace("{{q}}", q.trim())}
                    </p>
                )}

                {/* ----- 1 · Federal ----- */}
                {federal.length > 0 && (
                    <section className="flex flex-col gap-4">
                        <SectionHead heading={c.federal_heading} sub={c.federal_sub} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            {federal.map((b) => (
                                <FederalCard key={b.id} b={b} c={c} lang={lang} sub={sub} />
                            ))}
                        </div>
                    </section>
                )}

                {/* ----- 2 · Cantonal ----- */}
                {cantons.length > 0 && (
                    <section className="flex flex-col gap-4">
                        <SectionHead heading={c.cantonal_heading} sub={c.cantonal_sub} />
                        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                            {cantons.map((ct) => (
                                <li key={ct.id}>
                                    <PlaceLink place={ct} lang={lang} />
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* ----- 3 · Communal — waits for a search (index too large to list) ----- */}
                {(!searching || communeMatches.length > 0) && (
                    <section className="flex flex-col gap-4">
                        <SectionHead heading={c.communal_heading} sub={c.communal_sub} />
                        {!searching ? (
                            <p className="text-sm text-muted-foreground">{c.communal_intro}</p>
                        ) : (
                            <>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                    {communeMatches.length > communes.length
                                        ? c.results_capped
                                            .replace("{{n}}", String(communes.length))
                                            .replace("{{total}}", String(communeMatches.length))
                                        : c.results_count.replace("{{n}}", String(communeMatches.length))}
                                </p>
                                <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                                    {communes.map((m) => (
                                        <li key={m.id}>
                                            <PlaceLink place={m} lang={lang} />
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </section>
                )}
            </main>
        </>
    );
}

function SectionHead({ heading, sub }: { heading: string; sub: string }) {
    return (
        <div className="flex items-baseline gap-3 border-b border-border pb-2">
            <h2 className="text-lg font-medium tracking-tight text-foreground">{heading}</h2>
            <span className="ml-auto text-xs text-muted-foreground">{sub}</span>
        </div>
    );
}

/** A canton or commune: canton-code chip + name, links to the body overview. */
function PlaceLink({ place, lang }: { place: StartLink; lang: string | undefined }) {
    return (
        <a href={bodyHref(lang, place.id)} className={PLACE_LINK}>
            {place.canton && (
                <span className="min-w-9 rounded-sm bg-muted px-1.5 py-1 text-center text-xs font-medium tabular-nums text-muted-foreground">
                    {place.canton}
                </span>
            )}
            <span className="text-sm text-foreground">{place.name}</span>
        </a>
    );
}

function FederalCard({
    b,
    c,
    lang,
    sub,
}: {
    b: FederalBody;
    c: StartContent;
    lang: string | undefined;
    sub: (ns: PageNamespaces, id: number, qs?: string) => string;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-5">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-medium tracking-tight text-foreground">{b.name}</h3>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {b.key}
                </span>
            </div>

            {/* Voting chambers (Nationalrat / Ständerat) → chamber-filtered votings. */}
            {b.chambers.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{c.chambers_label}</p>
                    <div className="flex flex-wrap gap-2">
                        {b.chambers.map((ch) => (
                            <InternalLink
                                key={ch.id}
                                to={sub("NS_BODIES_VOTINGS", b.id, `chamber=${ch.id}`)}
                                className="min-h-11 pr-1 text-sm"
                            >
                                {ch.name}
                            </InternalLink>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <a href={bodyHref(lang, b.id)} className={CHIP}>
                    {c.link_overview}
                </a>
                {BODY_LINKS.map((l) => (
                    <a key={l.ns} href={sub(l.ns, b.id)} className={CHIP}>
                        {c[l.key]}
                    </a>
                ))}
            </div>
        </div>
    );
}
