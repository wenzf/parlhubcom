// bodies_id_discussion.tsx          → ~/routes/pages/bodies/bodies_id_discussion.tsx
//
// /parliaments/:id/discussion — Wordfish ideological scaling of a chamber. Takes
// the active members of the body and their speeches in a SHARED window (last N
// months, same lower bound for everyone, so the axis reflects word choice, not
// "old vs new member"), tokenizes + removes stopwords in DuckDB, runs Wordfish,
// and plots each member on the latent axis (see body_discussion.ts + wordfish.ts).
//
// Compute-on-request: at chamber scale (dozens–hundreds of members, a year of
// speeches) Wordfish takes a few seconds, so the loader runs in two stages —
//   1. FAST: body_by_id.sql, awaited, gives the layout its data.body (the shell +
//      <BodyBase/> render immediately);
//   2. EXPENSIVE: runBodyDiscussion is returned UNRESOLVED so React Router
//      streams it; the panel shows a spinner (via <Suspense>/<Await>) until the
//      scaling arrives.
//
// Query params:
//   ?months=<n>   size of the shared window in months (default 12)

import * as React from "react";
import { contentLangs } from "~/server/content_langs.server";
import { langByParam } from "~/lib/lang";
import type { Route } from "./+types/bodies_id_discussion";
import { PAGE_CONFIG } from "~/configs/site.config";
import { runByIdLocalized } from "~/server/db/core";
import bodySql from "~/server/db/sql/bodies/body_by_id.sql?raw";
import type { BodyByIdResult } from "@/types/opd_client";
import { runBodyDiscussion } from "~/server/db/analytics/body_discussion";
import {
    BodyDiscussion,
    type DiscussionResult,
} from "~/components/opd_views/bodies/BodyDiscussion";
import { FeedLoading } from "~/components/opd_views/_shared/feeds/FeedLoading";
import { PendingOverlay, useSameRoutePending } from "~/components/opd_views/_shared/feeds/PendingOverlay";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { InternalLink, makeT } from "~/components/opd_views/opd_micros";
import { Await, useLoaderData, useParams, useRouteLoaderData, useSearchParams } from "react-router";
import { localizedPath } from "~/lib/lang";
import { bodyDimensionMeta } from "~/lib/seo/metas";

// Selectable shared-window presets (months). The Wordfish cost is bounded by the
// vocabulary cap, so it's independent of the window length — a longer range is no
// slower, it just widens the span of speeches the axis is built from.
const RANGE_PRESETS = [
    { months: 12, key: "discussion_range_1y" },
    { months: 24, key: "discussion_range_2y" },
    { months: 48, key: "discussion_range_4y" },
    { months: 96, key: "discussion_range_8y" },
] as const;

export const handle = PAGE_CONFIG.NS_BODIES_DISCUSSION.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return bodyDimensionMeta(ld?.data, "discussion", {
        lang: params.lang,
        path: location.pathname, matches, params,
    });
}

// ?months changes the window; nothing else refetches.
export function shouldRevalidate({
    currentUrl,
    nextUrl,
}: {
    currentUrl: URL;
    nextUrl: URL;
}) {
    const key = (u: URL) => `${u.pathname}?months=${u.searchParams.get("months") ?? ""}`;
    return key(currentUrl) !== key(nextUrl);
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const bodyId = Number(params.id);
    if (!Number.isFinite(bodyId)) {
        throw new Response("Not Found", { status: 404 });
    }

    const { lang_code } = langByParam(params.lang);
    const langs = contentLangs(context, params.lang);

    const url = new URL(request.url);
    const rawMonths = Number(url.searchParams.get("months") ?? 12);
    const months =
        Number.isFinite(rawMonths) && rawMonths > 0 ? Math.floor(rawMonths) : 12;

    // shared window: now - `months`, same lower bound for every member
    const asOfDate = new Date();
    const start = new Date(asOfDate);
    start.setMonth(start.getMonth() - months);
    const windowStartMs = start.getTime();

    // Stage 1 — fast: body base block, awaited. Gives the layout its data.body.
    const data = await runByIdLocalized<NonNullable<BodyByIdResult>>(bodySql, {
        id: bodyId,
        langs,
    });
    if (!data?.body) throw new Response("Not Found", { status: 404 });

    // Stage 2 — expensive: Wordfish. Returned UNRESOLVED so React Router streams
    // it; the shell flushes first and the panel shows a spinner.
    const discussion = Promise.resolve().then(() =>
        runBodyDiscussion({
            bodyId,
            langs,
            windowStartMs,
            months,
            asOf: asOfDate.toISOString().slice(0, 10),
        }),
    );

    return { data, discussion, months };
}

function DiscussionError({ loc }: { loc: Record<string, string> }) {
    const t = makeT(loc);
    return (
        <Card>
            <CardContent>
                <p className="py-16 text-center text-sm text-muted-foreground">
                    {t("discussion_error")}
                </p>
            </CardContent>
        </Card>
    );
}

export default function BodyDiscussionPage() {
    const loaderData = useLoaderData() as {
        data: { body?: any };
        discussion: Promise<DiscussionResult>;
        months: number;
    };
    const { lang } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const layoutRouteLoaderData = useRouteLoaderData(
        "routes/layouts/data_dashboard_layout",
    ) as
        | { locs?: { pages?: { person?: { labels?: Record<string, string> } } }; locale?: string }
        | undefined;

    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels ?? {};
    const locale =
        layoutRouteLoaderData?.locale ?? (lang ? `${lang}-CH` : "de-CH");
    const t = makeT(loc);

    // Range change in flight: the held previous chart stays visible, dimmed
    // under a spinner, until the new Wordfish window streams in.
    const pending = useSameRoutePending();

    // Changing the range rewrites ?months= (preserving any other params); the loader
    // re-runs and the chart re-streams behind the spinner. Rendered ABOVE the
    // Suspense so it stays put — and stays usable — while the new window computes.
    const onRange = (v: string) =>
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set("months", v);
                return next;
            },
            { preventScrollReset: true },
        );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Methodology write-up (Wordfish) lives in the experiments section. */}
                <InternalLink to={localizedPath(lang, "NS_EXPERIMENTS_WORDFISH")} className="text-sm">
                    {t("discussion_methodology")}
                </InternalLink>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">{t("discussion_range_label")}</span>
                    <Segmented size="sm" value={String(loaderData.months)} onValueChange={onRange}>
                        {RANGE_PRESETS.map((r) => (
                            <SegmentedItem key={r.months} value={String(r.months)}>
                                {t(r.key)}
                            </SegmentedItem>
                        ))}
                    </Segmented>
                </div>
            </div>

            <div className="relative" aria-busy={pending || undefined}>
                <React.Suspense fallback={<FeedLoading loc={loc} label="discussion_calculating" />}>
                    <Await resolve={loaderData.discussion} errorElement={<DiscussionError loc={loc} />}>
                        {(result: DiscussionResult) => (
                            <BodyDiscussion result={result} loc={loc} locale={locale} />
                        )}
                    </Await>
                </React.Suspense>
                {pending ? <PendingOverlay loc={loc} label="discussion_calculating" /> : null}
            </div>
        </div>
    );
}
