import {
    runPersonPaginatedFiltered,
    type PageParams,
} from "~/server/db/core"

import votesSql from "~/server/db/sql/person/person_votes_by_id.sql?raw";
import type { PersonVotesResult } from "../../../../../types/opd_paginated_client";
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router";

import PersonVotes from "~/components/opd_views/person/PersonVotes";
import type { Route } from "./+types/people_id_votes";

import { parseOffsetParam } from "~/lib/urls/params";
import { PAGE_CONFIG } from "~/configs/site.config";
import { contentLangs } from "~/server/content_langs.server";

import { parseRaw, resolveOrderBy, resolveLimit } from "~/lib/dimensions/filters";
import { votesDescriptor } from "~/lib/dimensions/descriptors";
import { personDimensionMeta } from "~/lib/seo/metas";


export const handle = PAGE_CONFIG.NS_PEOPLE_VOTES.handle


// Rich, data-driven <title>/<meta> for /people/:id/votes. The loader returns a
// raw `Response.json(...)`, so RR types `loaderData` as `never`; cast to the
// payload shape. The votes response carries persons + the votes total_count.
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PersonVotesResult | null }
    return personDimensionMeta(ld?.data, "votes", { lang: params.lang, path: location.pathname, matches, params })
}


//const base: Omit<PageParams, "limit" | "offset"> = {
//    personId: 18613,
//    langs: ["de", "fr", "it"],
//};


export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now();


    const base: Omit<PageParams, "limit" | "offset"> = {
        personId: Number(params.id),
        langs: contentLangs(context, params.lang),
    }


    // search / filter / sort / page-size, validated against the descriptor.
    const criteria = parseRaw(votesDescriptor, url.searchParams);
    const limit = resolveLimit(votesDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get('offset'), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<PersonVotesResult>>(
        votesSql,
        {
            ...base,
            limit,
            offset,
            filters: votesDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(votesDescriptor, criteria),
        },
    );

    return Response.json({ data, perf: performance.now() - start });
}



export default function Page() {
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const loaderData = useLoaderData()
    const [params] = useSearchParams()

    // Mirror the loader so the pager + page-size match the server's slice.
    const criteria = parseRaw(votesDescriptor, params)
    const limit = resolveLimit(votesDescriptor, criteria)
    const offset = parseOffsetParam(params.get('offset'), limit) ?? 0



    return (
        <PersonVotes
            persons={loaderData?.data?.persons}
            votes={loaderData?.data?.votes}
            identities={loaderData?.data?.person_identities?.items}
            bodies={loaderData?.data?.bodies?.items}
            affairs={loaderData?.data?.affairs?.items}
            groups={loaderData?.data?.groups?.items}
            meetings={loaderData?.data?.meetings?.items}
            loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
            offset={offset}
            limit={limit}
            className="inset_page_transition"
            variant="page"
        />
    )
}