// bodies_id_lobby.tsx             → ~/routes/pages/bodies/bodies_id_lobby.tsx
//
// /bodies/:id/lobby — the register-of-interests network of this chamber over a
// date window (?from / ?to, ISO dates; default = whole record).
//
// The chamber's shared-tie graph needs an O(n²) force-directed layout, which is
// too slow to block first paint. So the loader runs in two stages: the fast SQL
// (body base block + raw graph) is awaited — giving the layout its data.body so
// the page shell + <BodyBase/> render immediately — while the expensive layout
// pass is returned as a PROMISE and STREAMED. The panel shows a spinner (via
// <Suspense>/<Await>) until the positioned graph arrives.

import * as React from "react";
import { langByParam, makeT } from "~/lib/lang";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/bodies_id_lobby";
import { PAGE_CONFIG } from "~/configs/site.config";
import {
    runBodyLobbyData,
    layoutBodyLobby,
    type BodyLobbyNetwork,
} from "~/server/db/analytics/body_lobby";
import { Await, useLoaderData } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "~/components/icons/opd_icons";
import BodyLobby from "~/components/opd_views/bodies/BodyLobby";
import { PendingOverlay, useSameRoutePending } from "~/components/opd_views/_shared/feeds/PendingOverlay";
import { isoToEpoch } from "~/lib/dimensions/filters";
import { bodyDimensionMeta } from "~/lib/seo/metas";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_BODIES_LOBBY.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return bodyDimensionMeta(ld?.data, "lobby", { lang: params.lang, path: location.pathname, matches, params });
}

// ?from / ?to change the window; ?view is a client-only tab toggle (graph /
// breakdown) so a view-only change must NOT refetch.
export function shouldRevalidate({
    currentUrl,
    nextUrl,
}: {
    currentUrl: URL;
    nextUrl: URL;
}) {
    const key = (u: URL) => {
        const p = new URLSearchParams(u.search);
        p.delete("view");
        p.sort();
        return `${u.pathname}?${p.toString()}`;
    };
    return key(currentUrl) !== key(nextUrl);
}

function cleanISODate(v: string | null): string | null {
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function loader({ url, params, context }: Route.LoaderArgs) {
    const bodyId = Number(params.id);
    if (!Number.isFinite(bodyId)) throw new Response("Not Found", { status: 404 });

    const { lang_code } = langByParam(params.lang);
    const langs = contentLangs(context, params.lang);

    const from = cleanISODate(url.searchParams.get("from"));
    const to = cleanISODate(url.searchParams.get("to"));

    // ?chamber = groups.id (chamber membership); absent/garbage → null = BOTH.
    const chamberRaw = Number(url.searchParams.get("chamber"));
    const chamber = Number.isInteger(chamberRaw) && chamberRaw > 0 ? chamberRaw : null;

    // Stage 1 — fast: SQL + raw graph. Gives us data.body for the layout.
    const raw = await runBodyLobbyData({
        bodyId,
        langs,
        from: isoToEpoch(from, "start"),
        to: isoToEpoch(to, "end"),
        chamber,
    });
    if (!raw) throw new Response("Not Found", { status: 404 });

    // Stage 2 — expensive: force-directed layout. Returned UNRESOLVED so React
    // Router streams it; the shell flushes first and the panel shows a spinner.
    const network = Promise.resolve().then(() => layoutBodyLobby(raw));

    // Export-ready lobby ties (long form, one row per declared mandate over a
    // shared org), joined to the member's name/party — the "who is tied to what"
    // the header Export serializes. Built from the SYNCHRONOUS raw graph (names
    // need no force layout), so the layout's <DataExport> gets it without awaiting
    // the streamed positions.
    const personById = new Map(raw.rawPeople.map((p) => [Number(p.person_id), p]));
    const lobbyItems = raw.ties.map((tie) => {
        const p = personById.get(tie.person_id);
        return {
            person_id: tie.person_id,
            member: p?.fullname ?? null,
            party: p?.party ?? null,
            party_key: p?.party_key ?? null,
            org_key: tie.org_key,
            organization: tie.org_name ?? null,
            role: tie.role ?? null,
            payment: tie.payment,
            begin_date: tie.begin_date,
            end_date: tie.end_date,
        };
    });

    return {
        data: {
            body: raw.body,
            lobby: { total_count: lobbyItems.length, items: lobbyItems },
        },
        network,
        filters: { from, to, chamber },
    };
}

/** Panel-shaped placeholder shown while the graph is being computed. */
function LobbyLoading({
    loc,
    title,
}: {
    loc: Record<string, string>;
    title: string | null;
}) {
    const t = makeT(loc);
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Icon name="share-2" className="size-4 text-muted-foreground" />
                    {t("section_lobby")}
                    {title ? (
                        <span className="text-sm font-normal text-muted-foreground">· {title}</span>
                    ) : null}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-muted-foreground">
                    <span
                        role="status"
                        aria-label="Loading"
                        className="inline-block size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
                    />
                    {t("lobby_calculating")}
                </div>
            </CardContent>
        </Card>
    );
}

function LobbyError({ loc }: { loc: Record<string, string> }) {
    const t = makeT(loc);
    return (
        <Card>
            <CardContent>
                <p className="py-16 text-center text-sm text-muted-foreground">
                    {t("lobby_error")}
                </p>
            </CardContent>
        </Card>
    );
}

export default function BodyLobbyPage() {
    const loaderData = useLoaderData() as {
        data: { body?: any };
        network: Promise<BodyLobbyNetwork>;
        filters: { from: string | null; to: string | null; chamber: number | null };
    };
    const { loc, locale } = useDashboardLoc();

    const body = loaderData?.data?.body;
    const filters = loaderData?.filters ?? { from: null, to: null, chamber: null };
    const bodyTitle = body?.legislative_name ?? body?.name ?? null;

    // Window/chamber filter change in flight: the held previous graph stays
    // visible, dimmed under a spinner, until the new layout streams in.
    const pending = useSameRoutePending();

    return (
        <div className="relative" aria-busy={pending || undefined}>
            <React.Suspense fallback={<LobbyLoading loc={loc} title={bodyTitle} />}>
                <Await resolve={loaderData.network} errorElement={<LobbyError loc={loc} />}>
                    {(net: BodyLobbyNetwork) => (
                        <BodyLobby
                            people={net.people?.items ?? []}
                            orgs={net.orgs ?? []}
                            edges={net.edges ?? []}
                            ties={net.ties ?? []}
                            payment={net.payment ?? { paid: 0, unpaid: 0, unknown: 0 }}
                            chambers={net.chambers ?? []}
                            chamberId={filters.chamber ?? null}
                            bodyTitle={bodyTitle}
                            from={filters.from}
                            to={filters.to}
                            loc={loc}
                            locale={locale}
                        />
                    )}
                </Await>
            </React.Suspense>
            {pending ? <PendingOverlay loc={loc} label="lobby_calculating" /> : null}
        </div>
    );
}