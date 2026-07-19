// routes/pages/meetings/meetings_id_agendas.tsx
//
// /meetings/:id/agendas — the agendas of one meeting (NS_MEETINGS_AGENDAS).
// PERSON family: runPersonPaginatedFiltered with $1 = the meeting id, filters $9+.
// Rendered below <MeetingBase /> via the meetings layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/meetings_id_agendas";

import feed_sql from "~/server/db/sql/meetings/meeting_agendas_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import { type MeetingAgendasResponse, type MeetingAgendasResult } from "@/types/opd_paginated_client";
import { parseRaw, resolveLimit, resolveOrderBy } from "~/lib/dimensions/filters";
import { meetingAgendasDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";
import { meetingDimensionMeta } from "~/lib/seo/metas";

import { MeetingAgendas } from "~/components/opd_views/meetings/MeetingFeeds";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_MEETINGS_AGENDAS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return meetingDimensionMeta(ld?.data, "agendas", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(meetingAgendasDescriptor, url.searchParams);
    const limit = resolveLimit(meetingAgendasDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<MeetingAgendasResult>>(feed_sql, {
        personId: id, // PERSON family scope slot ($1) = the meeting id
        langs: contentLangs(context, params.lang),
        limit,
        offset,
        filters: meetingAgendasDescriptor.toSqlParams(criteria),
        orderBy: resolveOrderBy(meetingAgendasDescriptor, criteria),
    });

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<MeetingAgendasResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function MeetingAgendasPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<MeetingAgendasResult> & { limit: number; offset: number } };

    const { loc, locale } = useDashboardLoc();

    return (
        <MeetingAgendas
            agendas={data.agendas}
            affairs={data.affairs?.items}
            loc={loc}
            locale={locale}
            variant="page"
            limit={data.limit}
            offset={data.offset}
            pageParam={meetingAgendasDescriptor.pageParam}
        />
    );
}
