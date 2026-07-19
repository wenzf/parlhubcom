// bodies_id_loyalty.tsx            → ~/routes/pages/bodies/bodies_id_loyalty.tsx
//
// /bodies/:id/loyalty — party-loyalty (dissent rate) of every MP of this body
// over a date window (?from / ?to, ISO dates; default = whole record).
//
// Same single-SQL shape as the other body sub-pages: body_loyalty_by_id.sql
// returns the `body` base block (which the shared bodies_result_layout validates
// and <BodyBase/> renders) alongside the `loyalty` list. The route is
// is_primary_data_match, so the layout reads data.body; the panel reads
// data.loyalty.

import { langByParam } from "~/lib/lang";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/bodies_id_loyalty";
import { PAGE_CONFIG } from "~/configs/site.config";
import { runBodyLoyalty } from "~/server/db/analytics/body_loyalty";
import { useLoaderData } from "react-router";
import BodyLoyalty from "~/components/opd_views/bodies/BodyLoyalty";
import { isoToEpoch } from "~/lib/dimensions/filters";
import { bodyDimensionMeta } from "~/lib/seo/metas";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_BODIES_LOYALTY.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return bodyDimensionMeta(ld?.data, "loyalty", { lang: params.lang, path: location.pathname, matches, params });
}

// ?from / ?to change the window; the layout skips same-id revalidation otherwise.
// ?scale is a client-only axis toggle, so a scale-only change must NOT refetch.
export function shouldRevalidate({
    currentUrl,
    nextUrl,
}: {
    currentUrl: URL;
    nextUrl: URL;
}) {
    const key = (u: URL) => {
        const p = new URLSearchParams(u.search);
        p.delete("scale");
        p.sort();
        return `${u.pathname}?${p.toString()}`;
    };
    return key(currentUrl) !== key(nextUrl);
}

/** Validate a YYYY-MM-DD (ignore anything else). */
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

    // ?chamber = votings.group_id; absent/garbage → null = BOTH (pool chambers).
    const chamberRaw = Number(url.searchParams.get("chamber"));
    const chamber = Number.isInteger(chamberRaw) && chamberRaw > 0 ? chamberRaw : null;

    // votings.date is a DOUBLE (epoch-ms), so convert; isoToEpoch snaps the "end"
    // edge to end-of-day for an inclusive upper bound.
    const data = await runBodyLoyalty({
        bodyId,
        langs,
        from: isoToEpoch(from, "start"),
        to: isoToEpoch(to, "end"),
        chamber,
    });
    if (!data) throw new Response("Not Found", { status: 404 });

    return Response.json({ data, filters: { from, to, chamber }, perf: performance.now() - start });
}

export default function BodyLoyaltyPage() {
    const loaderData = useLoaderData() as { data: any } | undefined;
    const { loc, locale } = useDashboardLoc();

    const body = loaderData?.data?.body;
    const members = loaderData?.data?.loyalty?.items ?? [];
    const cohesion = loaderData?.data?.cohesion?.items ?? [];
    const filters = (loaderData as any)?.filters ?? { from: null, to: null, chamber: null };

    return (
        <BodyLoyalty
            members={members}
            cohesion={cohesion}
            chambers={loaderData?.data?.chambers ?? []}
            chamberId={filters.chamber ?? null}
            bodyTitle={body?.legislative_name ?? body?.name ?? null}
            from={filters.from}
            to={filters.to}
            loc={loc}
            locale={locale}
        />
    );
}