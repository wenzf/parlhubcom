// routes/pages/groups/groups_id_memberships.tsx
//
// /groups/:id/memberships — the memberships of one group (NS_GROUPS_MEMBERSHIPS).
// PERSON family: runPersonPaginatedFiltered with $1 = the group id, filters $9+.
// Rendered below <GroupBase /> via the groups layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/groups_id_memberships";

import group_memberships_sql from "~/server/db/sql/groups/group_memberships_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type GroupMembershipsResponse,
    type GroupMembershipsResult,
} from "@/types/opd_paginated_client";
import { parseRaw, resolveLimit, resolveOrderBy } from "~/lib/dimensions/filters";
import { groupMembershipsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";
import { groupDimensionMeta } from "~/lib/seo/metas";

import { GroupMemberships } from "~/components/opd_views/groups/GroupMemberships";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_GROUPS_MEMBERSHIPS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return groupDimensionMeta(ld?.data, "memberships", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(groupMembershipsDescriptor, url.searchParams);
    const limit = resolveLimit(groupMembershipsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<GroupMembershipsResult>>(
        group_memberships_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the group id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: groupMembershipsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(groupMembershipsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<GroupMembershipsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function GroupMembershipsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<GroupMembershipsResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <GroupMemberships
            memberships={data.memberships}
            bodies={data.bodies?.items}
            groupId={data.group.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={groupMembershipsDescriptor.pageParam}
        />
    );
}
