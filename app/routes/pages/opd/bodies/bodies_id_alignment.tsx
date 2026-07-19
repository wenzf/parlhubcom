// bodies_id_alignment.tsx          → ~/routes/pages/bodies/bodies_id_alignment.tsx
//
// /bodies/:id/alignment — the co-voting spatial model of this chamber over a date
// window (?from / ?to, ISO dates; default = last year). Same single-SQL shape as
// the other body sub-pages: body_alignment_by_id.sql returns the `body` base
// block (validated by the shared bodies_result_layout + rendered by <BodyBase/>)
// alongside the alignment payload. The route is is_primary_data_match, so the
// layout reads data.body; the panel reads members / partyMatrix / parties.

import { langByParam } from "~/lib/lang";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/bodies_id_alignment";
import { PAGE_CONFIG } from "~/configs/site.config";
import { runBodyAlignment } from "~/server/db/analytics/body_alignment";
import { useLoaderData } from "react-router";
import BodyAlignment from "~/components/opd_views/bodies/BodyAlignment";
import { isoToEpoch } from "~/lib/dimensions/filters";
import { bodyDimensionMeta } from "~/lib/seo/metas";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_BODIES_ALIGNMENT.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return bodyDimensionMeta(ld?.data, "alignment", { lang: params.lang, path: location.pathname, matches, params });
}

// ?from / ?to change the window; ?view is a client-only tab toggle (scatter /
// heatmap) so a view-only change must NOT refetch.
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
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now();
    const bodyId = Number(params.id);
    if (!Number.isFinite(bodyId)) throw new Response("Not Found", { status: 404 });

    const { lang_code } = langByParam(params.lang);
    const langs = contentLangs(context, params.lang);

    // window default: one year ago → today (ISO dates)
    const today = new Date();
    const yearAgo = new Date();
    yearAgo.setFullYear(today.getFullYear() - 1);
    const from = cleanISODate(url.searchParams.get("from")) ?? isoDate(yearAgo);
    const to = cleanISODate(url.searchParams.get("to")) ?? isoDate(today);

    // ?chamber = votings.group_id; absent/garbage → null = SQL auto-resolves
    // (multi-chamber bodies default to their busiest chamber).
    const chamberRaw = Number(url.searchParams.get("chamber"));
    const chamber = Number.isInteger(chamberRaw) && chamberRaw > 0 ? chamberRaw : null;

    const data = await runBodyAlignment({
        bodyId,
        langs,
        from: isoToEpoch(from, "start"),
        to: isoToEpoch(to, "end"),
        chamber,
    });
    if (!data) throw new Response("Not Found", { status: 404 });

    return Response.json({ data, filters: { from, to }, perf: performance.now() - start });
}

export default function BodyAlignmentPage() {
    const loaderData = useLoaderData() as { data: any } | undefined;
    const { loc, locale } = useDashboardLoc();

    const body = loaderData?.data?.body;
    const members = loaderData?.data?.members?.items ?? [];
    const partyMatrix = loaderData?.data?.partyMatrix ?? [];
    const parties = loaderData?.data?.parties ?? [];
    const filters = (loaderData as any)?.filters ?? { from: null, to: null };

    return (
        <BodyAlignment
            members={members}
            partyMatrix={partyMatrix}
            parties={parties}
            chambers={loaderData?.data?.chambers ?? []}
            chamberId={loaderData?.data?.chamberId ?? null}
            bodyTitle={body?.legislative_name ?? body?.name ?? null}
            from={filters.from}
            to={filters.to}
            loc={loc}
            locale={locale}
        />
    );
}
