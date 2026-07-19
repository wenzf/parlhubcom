import {
    runPersonPaginatedFiltered,
    type PageParams,
} from "~/server/db/core"

import membershipsSql from "~/server/db/sql/person/person_memberships_by_id.sql?raw";

import type { PersonMembershipsResult } from "@/types/opd_paginated_client";
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/people_id_memberships";
import { parseOffsetParam } from "~/lib/urls/params";
import PersonMemberships from "~/components/opd_views/person/PersonMemberships";
import { PAGE_CONFIG } from "~/configs/site.config";
import { contentLangs } from "~/server/content_langs.server";
import { membershipsDescriptor } from "~/lib/dimensions/descriptors";
import { parseRaw, resolveOrderBy, resolveLimit } from "~/lib/dimensions/filters";
import { personDimensionMeta } from "~/lib/seo/metas";

export const handle = PAGE_CONFIG.NS_PEOPLE_MEMBERSHIPS.handle


// Rich, data-driven <title>/<meta> for /people/:id/memberships.
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PersonMembershipsResult | null }
    return personDimensionMeta(ld?.data, "memberships", { lang: params.lang, path: location.pathname, matches, params })
}


// personId + langs only; limit / offset / filters / orderBy are derived per request.
//const base: Omit<PageParams, "limit" | "offset"> = {
//  personId: 18613,
//  langs: ["de", "fr", "it"],
//};


export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now();

    const base: Omit<PageParams, "limit" | "offset"> = {
        personId: Number(params.id),
        langs: contentLangs(context, params.lang),
    }

    // URL → validated criteria (drops unknown sort keys / out-of-set facets / bad dates).
    const criteria = parseRaw(membershipsDescriptor, url.searchParams);
    const limit = resolveLimit(membershipsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset") ?? 0, limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<PersonMembershipsResult>>(
        membershipsSql,
        {
            ...base,
            limit,                                              // $7  (counts GROUPS)
            offset,                                             // $8  (in GROUPS)
            filters: membershipsDescriptor.toSqlParams(criteria), // $9..$14
            orderBy: resolveOrderBy(membershipsDescriptor, criteria), // GROUP-level token
        },
    );
    return Response.json({ data, perf: performance.now() - start });
}


export default function Page() {

    const loaderData = useLoaderData()

    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const [params] = useSearchParams()
    // Mirror the loader's limit/offset so the pager's page size matches the slice.
    const limit = resolveLimit(membershipsDescriptor, parseRaw(membershipsDescriptor, params))
    const offset = parseOffsetParam(params.get('offset') ?? 0, limit) ?? 0

    return (
        <PersonMemberships
            persons={loaderData?.data?.persons}
            identities={loaderData?.data?.person_identities?.items}
            bodies={loaderData?.data?.bodies?.items}
            groups={loaderData?.data?.groups?.items}
            membershipGroups={loaderData?.data?.membership_groups}
            loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
            offset={offset}
            limit={limit}
            variant="page"
        />
    )
}