import {
    runPersonPaginatedFiltered,
    type PageParams,
} from "~/server/db/core";

import speechesSql from "~/server/db/sql/person/person_speeches_by_id.sql?raw";

import type { PersonSpeechesResult } from "@/types/opd_paginated_client";
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/people_id_speeches";
import { parseOffsetParam } from "~/lib/urls/params";
import PersonSpeeches from "~/components/opd_views/person/PersonSpeeches";
import { PAGE_CONFIG } from "~/configs/site.config";
import { speechesDescriptor } from "~/lib/dimensions/descriptors";
import {
    parseRaw,
    resolveOrderBy,
    resolveLimit,
} from "~/lib/dimensions/filters";
import { personDimensionMeta } from "~/lib/seo/metas";
import { contentLangs } from "~/server/content_langs.server";


export const handle = PAGE_CONFIG.NS_PEOPLE_SPEECHES.handle


// Rich, data-driven <title>/<meta> for /people/:id/speeches.
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PersonSpeechesResult | null }
    return personDimensionMeta(ld?.data, "speeches", { lang: params.lang, path: location.pathname, matches, params })
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


    // URL → validated criteria (search / type / has-video / body / date-range /
    // sort / page size), driven by the same descriptor the controls + agent tools use.
    const criteria = parseRaw(speechesDescriptor, url.searchParams);
    const limit = resolveLimit(speechesDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get('offset'), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<PersonSpeechesResult>>(
        speechesSql,
        {
            ...base,
            limit,
            offset,
            // $9..$14 bound values, in the descriptor's slot order (mirrors the SQL header).
            filters: speechesDescriptor.toSqlParams(criteria),
            // whitelisted ORDER BY fragment spliced into the /* __ORDER_BY__ */ token.
            orderBy: resolveOrderBy(speechesDescriptor, criteria),
        },
    );
    return Response.json({ data, perf: performance.now() - start });
}



export default function Page() {

    const loaderData = useLoaderData()


    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const [params] = useSearchParams()

    const criteria = parseRaw(speechesDescriptor, params)
    const limit = resolveLimit(speechesDescriptor, criteria)
    const offset = parseOffsetParam(params.get('offset'), limit) ?? 0

    return (
        <PersonSpeeches
            agendas={loaderData?.data?.agendas?.items}
            persons={loaderData?.data?.persons}
            meetings={loaderData?.data?.meetings?.items}
            speeches={loaderData?.data?.speeches}
            identities={loaderData?.data?.person_identities?.items}
            bodies={loaderData?.data?.bodies?.items}
            affairs={loaderData?.data?.affairs?.items}
            loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
            offset={offset}
            limit={limit}
            //  className="inset_page_transition"
            variant="page"
        />
    )
}