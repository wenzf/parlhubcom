// routes/pages/project/traffic_stats/traffic_stats.tsx
//
// /project/traffic-stats — public traffic statistics (NS_TRAFFIC_STATS). Same
// construction as /project/sustainability: page copy is a loc fragment
// (/public/locales/<lang>/loc_traffic_stats.json), SEO copy comes from the
// `trafficStatsMeta` builder.
//
// The figures are aggregated once a day by deploy/analytics.ts from the server's
// own request log into s3://<DB_S3_BUCKET>/analytics/summary.json — CloudWatch
// keeps the raw logs only 30 days, so that daily file IS the archive.
//
// When there is no cube — nothing aggregated yet, or S3 unreachable — the page
// says so and renders nothing else. It never substitutes sample figures: this is
// a public page on a site whose point is transparent data, and invented numbers
// with a disclaimer are still invented numbers. An empty state is the honest
// answer and needs no caveat.

import type { Route } from "./+types/traffic_stats";
import { langByParam, makeT } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import { loadSummary } from "~/server/analytics/summary.server";
import { PAGE_CONFIG } from "~/configs/site.config";
import { trafficStatsMeta } from "~/lib/seo/metas";
import { TrafficStats, type TrafficStatsLoc } from "~/components/traffic_stats/TrafficStats";
import type { Cube } from "~/lib/analytics/cube";

export const handle = PAGE_CONFIG.NS_TRAFFIC_STATS.handle;

export function meta({ params, location, matches }: Route.MetaArgs) {
    return trafficStatsMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const [locs, cube] = await Promise.all([
        getStaticData(["loc_traffic_stats"], lang_code),
        loadSummary(),
    ]);
    // lang_code rides along for Intl: number/date formatting must follow the URL's
    // language, not the ambient locale (which is the server's under SSR and the
    // browser's after hydration — different values, hence a mismatch).
    return Response.json({ locs, cube, lang: lang_code });
}

export default function TrafficStatsPage({ loaderData }: Route.ComponentProps) {
    const { locs, cube, lang } = loaderData as {
        locs: { traffic_stats: TrafficStatsLoc };
        cube: Cube | null;
        lang: string;
    };
    const c = locs.traffic_stats;
    const t = makeT(c as unknown as Record<string, string>);

    // <main> is the project layout's; every /project leaf renders a plain
    // <article>/<div> root. Wider than the prose pages' max-w-prose — a 6-column
    // table and a 45-bar chart need the room — but the same mx-auto / p-4 rhythm.
    return (
        <article className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 pt-2">
            <header className="flex flex-col gap-4">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{c.title}</h1>
                <p className="max-w-prose text-lg text-muted-foreground">{c.lead}</p>
            </header>

            {cube ? (
                <TrafficStats cube={cube} loc={c} lang={lang} />
            ) : (
                <p role="status" className="max-w-prose rounded-md border border-input px-3 py-3 text-sm">
                    {t("no_data")}
                </p>
            )}
        </article>
    );
}
