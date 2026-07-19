import {
    runPersonPaginatedFiltered,
    type PageParams,
} from "~/server/db/core";

import accessBadgesSql from "~/server/db/sql/person/person_access_badges_by_id.sql?raw";
import type { PersonAccessBadgesResult } from "../../../../../types/opd_paginated_client";
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router";
import { PAGE_CONFIG } from "~/configs/site.config";
import PersonAccessBadges from "~/components/opd_views/person/PersonAccessBadges";
import type { Route } from "./+types/people_id_access_badges";
import { parseOffsetParam } from "~/lib/urls/params";
import { accessBadgesDescriptor } from "~/lib/dimensions/descriptors";
import {
    parseRaw,
    resolveOrderBy,
    resolveLimit,
} from "~/lib/dimensions/filters";
import { personDimensionMeta } from "~/lib/seo/metas";
import { contentLangs } from "~/server/content_langs.server";


export const handle = PAGE_CONFIG.NS_PEOPLE_ACCESS_BADGES.handle


// Rich, data-driven <title>/<meta> for /people/:id/lobby (access badges granted).
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PersonAccessBadgesResult | null }
    return personDimensionMeta(ld?.data, "lobby", { lang: params.lang, path: location.pathname, matches, params })
}





export async function loader({ url, params, context }: Route.LoaderArgs) {

    const base: Omit<PageParams, "limit" | "offset"> = {
        personId: Number(params.id),
        langs: contentLangs(context, params.lang),
    };
    // URL → validated criteria (search / type / body / date-range / sort / page size),
    // all driven by the same descriptor the controls + agent tools use.
    const criteria = parseRaw(accessBadgesDescriptor, url.searchParams);
    const limit = resolveLimit(accessBadgesDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get('offset'), limit) ?? 0;

    const start = performance.now();
    const data = await runPersonPaginatedFiltered<NonNullable<PersonAccessBadgesResult>>(
        accessBadgesSql,
        {
            ...base,
            limit,
            offset,
            // $9..$13 bound values, in the descriptor's slot order (mirrors the SQL header).
            filters: accessBadgesDescriptor.toSqlParams(criteria),
            // whitelisted ORDER BY fragment spliced into the /* __ORDER_BY__ */ token.
            orderBy: resolveOrderBy(accessBadgesDescriptor, criteria),
        },
    );
    return Response.json({ data, perf: performance.now() - start });
}



export default function Page() {

    const loaderData = useLoaderData()
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const [params] = useSearchParams()

    // Page size + offset come from the same descriptor-validated criteria so the
    // component's pager math matches the loader's slice exactly.
    const criteria = parseRaw(accessBadgesDescriptor, params)
    const limit = resolveLimit(accessBadgesDescriptor, criteria)
    const offset = parseOffsetParam(params.get('offset'), limit) ?? 0


    return (
        <PersonAccessBadges
            persons={loaderData?.data?.persons}

            identities={loaderData?.data?.person_identities?.items}
            bodies={loaderData?.data?.bodies?.items}
            access_badges={loaderData?.data?.access_badges}


            loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
            offset={offset}
            limit={limit}
            //  className="inset_page_transition"
            variant="page"
        />
    )
}