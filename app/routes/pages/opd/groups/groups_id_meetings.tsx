// routes/pages/groups/groups_id_meetings.tsx
//
// /groups/:id/meetings — the meetings of one group (NS_GROUPS_MEETINGS).
// PERSON family: runPersonPaginatedFiltered with $1 = the group id, filters $9+.
// Rendered below <GroupBase /> via the groups layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/groups_id_meetings";

import group_meetings_sql from "~/server/db/sql/groups/group_meetings_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type GroupMeetingsResponse,
    type GroupMeetingsResult,
} from "@/types/opd_paginated_client";
import { parseRaw, resolveLimit, resolveOrderBy } from "~/lib/dimensions/filters";
import { groupMeetingsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";
import { groupDimensionMeta } from "~/lib/seo/metas";

import { GroupMeetings } from "~/components/opd_views/groups/GroupMeetings";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_GROUPS_MEETINGS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return groupDimensionMeta(ld?.data, "meetings", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(groupMeetingsDescriptor, url.searchParams);
    const limit = resolveLimit(groupMeetingsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<GroupMeetingsResult>>(
        group_meetings_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the group id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: groupMeetingsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(groupMeetingsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<GroupMeetingsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function GroupMeetingsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<GroupMeetingsResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <GroupMeetings
            meetings={data.meetings}
            bodies={data.bodies?.items}
            groupId={data.group.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={groupMeetingsDescriptor.pageParam}
        />
    );
}
