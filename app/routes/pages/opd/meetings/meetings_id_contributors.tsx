// routes/pages/meetings/meetings_id_contributors.tsx
//
// /meetings/:id/contributors — the contributors of one meeting (NS_MEETINGS_CONTRIBUTORS).
// PERSON family: runPersonPaginatedFiltered with $1 = the meeting id, filters $9+.
// Rendered below <MeetingBase /> via the meetings layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/meetings_id_contributors";

import feed_sql from "~/server/db/sql/meetings/meeting_contributors_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import { type MeetingContributorsResponse, type MeetingContributorsResult } from "@/types/opd_paginated_client";
import { parseRaw, resolveLimit, resolveOrderBy } from "~/lib/dimensions/filters";
import { meetingContributorsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";
import { meetingDimensionMeta } from "~/lib/seo/metas";

import { MeetingContributors } from "~/components/opd_views/meetings/MeetingFeeds";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_MEETINGS_CONTRIBUTORS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return meetingDimensionMeta(ld?.data, "contributors", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(meetingContributorsDescriptor, url.searchParams);
    const limit = resolveLimit(meetingContributorsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<MeetingContributorsResult>>(feed_sql, {
        personId: id, // PERSON family scope slot ($1) = the meeting id
        langs: contentLangs(context, params.lang),
        limit,
        offset,
        filters: meetingContributorsDescriptor.toSqlParams(criteria),
        orderBy: resolveOrderBy(meetingContributorsDescriptor, criteria),
    });

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<MeetingContributorsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function MeetingContributorsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<MeetingContributorsResult> & { limit: number; offset: number } };

    const { loc, locale } = useDashboardLoc();

    return (
        <MeetingContributors
            contributors={data.contributors}
            persons={data.persons?.items}
            affairs={data.affairs?.items}
            loc={loc}
            locale={locale}
            variant="page"
            limit={data.limit}
            offset={data.offset}
            pageParam={meetingContributorsDescriptor.pageParam}
        />
    );
}
