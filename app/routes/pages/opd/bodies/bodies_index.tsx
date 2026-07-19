import { contentLangs } from "~/server/content_langs.server"
import type { Route } from "./+types/bodies_index"
// import { getStaticData } from "~/server/static/get_static_data.server"
import { PAGE_CONFIG, URL_PATH_SEGMENTS } from "~/configs/site.config"

import {
    runListPaginatedFiltered,
} from "~/server/db/core"
import bodiesSql from "~/server/db/sql/bodies/bodies_list.sql?raw"
import type { BodiesListResult } from "@/types/opd_paginated_client"
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router"
import { parseOffsetParam } from "~/lib/urls/params"

import { bodiesDescriptor } from "~/lib/dimensions/descriptors"
import { parseRaw, resolveOrderBy, resolveLimit, hasActiveCriteria } from "~/lib/dimensions/filters"
import BodiesList from "~/components/opd_views/bodies/BodiesList"
import { bodiesIndexMeta } from "~/lib/seo/metas"

export const handle = PAGE_CONFIG.NS_BODIES_INDEX.handle

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    const criteria = parseRaw(bodiesDescriptor, new URLSearchParams(location.search))
    return bodiesIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(bodiesDescriptor, criteria),
        offset: Number(new URLSearchParams(location.search).get(bodiesDescriptor.pageParam)) || 0,
    })
}

export const loader = async ({ url, params, context }: Route.LoaderArgs) => {
    const start = performance.now()

    // Content-language priority for loc(): the visitor's chosen data language
    // (settings cookie) first, else the page language; then canonical fallbacks.
    // Independent of the interface language. loc() reads up to 5 slots.
    const langs = contentLangs(context, params.lang)

    // URL → validated criteria (unknown sorts / out-of-set facets / bad input dropped).
    const criteria = parseRaw(bodiesDescriptor, url.searchParams)
    const limit = resolveLimit(bodiesDescriptor, criteria)
    const offset = parseOffsetParam(url.searchParams.get("offset") ?? 0, limit) ?? 0

    // loc (static) + the filtered page run in parallel.
    const [data] = await Promise.all([
        //        getStaticData(["loc_bodies_index"], lang_code),
        runListPaginatedFiltered<NonNullable<BodiesListResult>>(bodiesSql, {
            langs,
            limit,                                            // $6
            offset,                                           // $7
            filters: bodiesDescriptor.toSqlParams(criteria),  // $8..$11
            orderBy: resolveOrderBy(bodiesDescriptor, criteria),
        }),
    ])

    return Response.json({ data, perf: performance.now() - start })
}

export default function BodiesIndex() {
    const loaderData = useLoaderData()
    const [params] = useSearchParams()
    // Mirror the loader's limit/offset so the pager's page size matches the slice.
    const limit = resolveLimit(bodiesDescriptor, parseRaw(bodiesDescriptor, params))
    const offset = parseOffsetParam(params.get("offset") ?? 0, limit) ?? 0

    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')


    // Bodies labels live in the shared pages.person.labels map (the bodies_* keys
    // were merged in). Read there; fall back through the possible loc shapes.
    const loc = (layoutRouteLoaderData?.locs?.pages?.person?.labels
        ?? layoutRouteLoaderData?.locs?.loc_bodies_index?.pages?.person?.labels
        ?? layoutRouteLoaderData?.locs) as Record<string, string> | undefined

    return (
        <BodiesList
            bodies={loaderData?.data?.bodies}
            loc={loc}
            offset={offset}
            limit={limit}
            exportConfig={{
                // Served at the `parliaments` URL segment (datasetKey/filenameBase
                // stay "bodies" — those are the response key + download filename).
                segment: URL_PATH_SEGMENTS.BODIES,
                datasetKey: "bodies",
                filenameBase: "bodies",
                subject: "all institutions",
            }}
        />
    )
}