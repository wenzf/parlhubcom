import { contentLangs } from "~/server/content_langs.server"
import type { Route } from "./+types/people_index"
import { PAGE_CONFIG } from "~/configs/site.config"

import {
    runListPaginatedFiltered,
} from "~/server/db/core"
import peopleSql from "~/server/db/sql/person/people_list.sql?raw"
import type { PeopleListResult } from "@/types/opd_paginated_client"
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router"
import { parseOffsetParam } from "~/lib/urls/params"

import { peopleDescriptor } from "~/lib/dimensions/descriptors"
import { parseRaw, resolveOrderBy, resolveLimit, hasActiveCriteria } from "~/lib/dimensions/filters"
import PeopleList from "~/components/opd_views/person/PeopleList"
import { peopleIndexMeta } from "~/lib/seo/metas"

export const handle = PAGE_CONFIG.NS_PEOPLE_INDEX.handle


// Rich, data-driven <title>/<meta> for the /people catalog. Reflects an active
// ?q search + total match count; filtered/search views are marked noindex.
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PeopleListResult | null }
    const criteria = parseRaw(peopleDescriptor, new URLSearchParams(location.search))
    return peopleIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(peopleDescriptor, criteria),
        offset: Number(new URLSearchParams(location.search).get(peopleDescriptor.pageParam)) || 0,
    })
}

export const loader = async ({ url, params, context }: Route.LoaderArgs) => {
    const start = performance.now()

    // Content-language priority for loc(): the visitor's chosen data language
    // (settings cookie) first, else the page language; then canonical fallbacks.
    // Independent of the interface language. loc() reads up to 5 slots.
    const langs = contentLangs(context, params.lang)

    // URL → validated criteria (unknown sorts / out-of-set facets / bad input dropped).
    const criteria = parseRaw(peopleDescriptor, url.searchParams)
    const limit = resolveLimit(peopleDescriptor, criteria)
    const offset = parseOffsetParam(url.searchParams.get("offset") ?? 0, limit) ?? 0

    // loc (static) + the filtered page run in parallel.
    const [data] = await Promise.all([
        //        getStaticData(["loc_people_index"], lang_code),
        runListPaginatedFiltered<NonNullable<PeopleListResult>>(peopleSql, {
            langs,
            limit,                                            // $6
            offset,                                           // $7
            filters: peopleDescriptor.toSqlParams(criteria),  // $8..$14
            orderBy: resolveOrderBy(peopleDescriptor, criteria),
        }),
    ])

    return Response.json({ data, perf: performance.now() - start })
}

export default function PeopleIndex() {
    const loaderData = useLoaderData()
    const [params] = useSearchParams()
    // Mirror the loader's limit/offset so the pager's page size matches the slice.
    const limit = resolveLimit(peopleDescriptor, parseRaw(peopleDescriptor, params))
    const offset = parseOffsetParam(params.get("offset") ?? 0, limit) ?? 0

    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')



    // All people labels now live in pages.person.labels (merged into the shared
    // map). Read there; fall back through the possible getStaticData shapes.
    const loc = (layoutRouteLoaderData?.locs?.pages?.person?.labels
        ?? layoutRouteLoaderData?.locs?.loc_people_index?.pages?.person?.labels
        ?? layoutRouteLoaderData?.locs) as Record<string, string> | undefined

    return (
        <PeopleList
            people={loaderData?.data?.people}
            identities={loaderData?.data?.person_identities?.items}
            bodies={loaderData?.data?.bodies?.items}
            loc={loc}
            offset={offset}
            limit={limit}
            exportConfig={{
                segment: "people",
                datasetKey: "people",
                filenameBase: "people",
                subject: "all people",
            }}
        />
    )
}