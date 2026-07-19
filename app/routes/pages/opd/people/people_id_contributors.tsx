import {
    runPersonPaginatedFiltered,
    type PageParams,
} from "~/server/db/core";

import contributorsSql from "~/server/db/sql/person/person_contributors_by_id.sql?raw";

import type { PersonContributorsResult } from "@/types/opd_paginated_client";
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/people_id_contributors";
import { parseOffsetParam } from "~/lib/urls/params";
import PersonContributions from "~/components/opd_views/person/PersonContributions";
import { PAGE_CONFIG } from "~/configs/site.config";
import { contentLangs } from "~/server/content_langs.server";
import { contributorsDescriptor } from "~/lib/dimensions/descriptors";
import {
    parseRaw,
    resolveOrderBy,
    resolveLimit,
} from "~/lib/dimensions/filters";
import { personDimensionMeta } from "~/lib/seo/metas";


export const handle = PAGE_CONFIG.NS_PEOPLE_CONTRIBUTORS.handle


// Rich, data-driven <title>/<meta> for /people/:id/contributions.
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PersonContributorsResult | null }
    return personDimensionMeta(ld?.data, "contributions", { lang: params.lang, path: location.pathname, matches, params })
}






export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now();

    const base: Omit<PageParams, "limit" | "offset"> = {
        personId: Number(params.id),
        langs: contentLangs(context, params.lang),
    }
    // URL → validated criteria (search + sort + page size), driven by the same
    // descriptor the controls + agent tools use.
    const criteria = parseRaw(contributorsDescriptor, url.searchParams);
    const limit = resolveLimit(contributorsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get('offset'), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<PersonContributorsResult>>(
        contributorsSql,
        {
            ...base,
            limit,
            offset,
            // $9 search term (slot order mirrors the SQL header).
            filters: contributorsDescriptor.toSqlParams(criteria),
            // whitelisted ORDER BY fragment spliced into the /* __ORDER_BY__ */ token.
            orderBy: resolveOrderBy(contributorsDescriptor, criteria),
        },
    );
    return Response.json({ data, perf: performance.now() - start });
}



export default function Page() {

    const loaderData = useLoaderData()
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const [params] = useSearchParams()

    const criteria = parseRaw(contributorsDescriptor, params)
    const limit = resolveLimit(contributorsDescriptor, criteria)
    const offset = parseOffsetParam(params.get('offset'), limit) ?? 0

    return (
        <PersonContributions
            persons={loaderData?.data?.persons}

            identities={loaderData?.data?.person_identities?.items}
            bodies={loaderData?.data?.bodies?.items}
            contributors={loaderData?.data?.contributors}
            groups={loaderData?.data?.groups?.items}
            affairs={loaderData?.data?.affairs?.items}
            loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
            offset={offset}
            limit={limit}
            //  className="inset_page_transition"
            variant="page"
        />
    )
}