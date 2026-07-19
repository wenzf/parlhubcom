// routes/pages/groups/groups_id_contributions.tsx
//
// /groups/:id/contributions — the contributions of one group (NS_GROUPS_CONTRIBUTIONS).
// PERSON family: runPersonPaginatedFiltered with $1 = the group id, filters $9+.
// Rendered below <GroupBase /> via the groups layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/groups_id_contributions";

import group_contributions_sql from "~/server/db/sql/groups/group_contributions_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type GroupContributionsResponse,
    type GroupContributionsResult,
} from "@/types/opd_paginated_client";
import { parseRaw, resolveLimit, resolveOrderBy } from "~/lib/dimensions/filters";
import { groupContributionsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";
import { groupDimensionMeta } from "~/lib/seo/metas";

import { GroupContributions } from "~/components/opd_views/groups/GroupContributions";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_GROUPS_CONTRIBUTIONS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return groupDimensionMeta(ld?.data, "contributions", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(groupContributionsDescriptor, url.searchParams);
    const limit = resolveLimit(groupContributionsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<GroupContributionsResult>>(
        group_contributions_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the group id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: groupContributionsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(groupContributionsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<GroupContributionsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function GroupContributionsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<GroupContributionsResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <GroupContributions
            contributions={data.contributions}
            bodies={data.bodies?.items}
            affairs={data.affairs?.items}
            groupId={data.group.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={groupContributionsDescriptor.pageParam}
        />
    );
}