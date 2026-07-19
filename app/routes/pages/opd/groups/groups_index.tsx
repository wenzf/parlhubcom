// routes/pages/groups/groups_index.tsx
//
// Route module for /groups — the top-level groups catalogue (NS_GROUPS_INDEX).
// LIST family: server-side search / filter / sort via groups_list.sql +
// runListPaginatedFiltered. Analogue of affairs_index.tsx / votings_index.tsx.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/groups_index";

import groups_list_sql from "~/server/db/sql/groups/groups_list.sql?raw";
import { runListPaginatedFiltered } from "~/server/db/core";
import {
    type GroupsListResponse,
    type GroupsListResult,
} from "@/types/opd_paginated_client";
import { parseRaw, resolveLimit, resolveOrderBy, hasActiveCriteria } from "~/lib/dimensions/filters";
import { groupsDescriptor } from "~/lib/dimensions/descriptors";

import { GroupsList } from "~/components/opd_views/groups/GroupsList";
import { PAGE_CONFIG } from "~/configs/site.config";
import { groupsIndexMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_GROUPS_INDEX.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    const criteria = parseRaw(groupsDescriptor, new URLSearchParams(location.search))
    return groupsIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(groupsDescriptor, criteria),
        offset: Number(new URLSearchParams(location.search).get(groupsDescriptor.pageParam)) || 0,
    })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const criteria = parseRaw(groupsDescriptor, url.searchParams);
    const limit = resolveLimit(groupsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runListPaginatedFiltered<NonNullable<GroupsListResult>>(
        groups_list_sql,
        {
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: groupsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(groupsDescriptor, criteria),
        },
    );

    typia.assert<GroupsListResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function GroupsIndexPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<GroupsListResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <GroupsList
            groups={data.groups}
            bodies={data.bodies?.items}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={groupsDescriptor.pageParam}
            exportConfig={{
                segment: "groups",
                datasetKey: "groups",
                filenameBase: "groups",
                subject: "all groups",
            }}
        />
    );
}
