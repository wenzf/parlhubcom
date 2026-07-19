// routes/pages/meetings/meetings_id_events.tsx
//
// /meetings/:id/events — the events of one meeting (NS_MEETINGS_EVENTS).
// PERSON family: runPersonPaginatedFiltered with $1 = the meeting id, filters $9+.
// Rendered below <MeetingBase /> via the meetings layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/meetings_id_events";

import feed_sql from "~/server/db/sql/meetings/meeting_events_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import { type MeetingEventsResponse, type MeetingEventsResult } from "@/types/opd_paginated_client";
import { parseRaw, resolveLimit, resolveOrderBy } from "~/lib/dimensions/filters";
import { meetingEventsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";
import { meetingDimensionMeta } from "~/lib/seo/metas";

import { MeetingEvents } from "~/components/opd_views/meetings/MeetingFeeds";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_MEETINGS_EVENTS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return meetingDimensionMeta(ld?.data, "events", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(meetingEventsDescriptor, url.searchParams);
    const limit = resolveLimit(meetingEventsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<MeetingEventsResult>>(feed_sql, {
        personId: id, // PERSON family scope slot ($1) = the meeting id
        langs: contentLangs(context, params.lang),
        limit,
        offset,
        filters: meetingEventsDescriptor.toSqlParams(criteria),
        orderBy: resolveOrderBy(meetingEventsDescriptor, criteria),
    });

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<MeetingEventsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function MeetingEventsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<MeetingEventsResult> & { limit: number; offset: number } };

    const { loc, locale } = useDashboardLoc();

    return (
        <MeetingEvents
            events={data.events}
            loc={loc}
            locale={locale}
            variant="page"
            limit={data.limit}
            offset={data.offset}
            pageParam={meetingEventsDescriptor.pageParam}
        />
    );
}
