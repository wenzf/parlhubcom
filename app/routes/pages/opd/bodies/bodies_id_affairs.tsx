import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/bodies_id_affairs"
import { PAGE_CONFIG } from "~/configs/site.config"

import { runPersonPaginatedFiltered } from "~/server/db/core"
import bodyAffairsSql from "~/server/db/sql/bodies/body_affairs_by_id.sql?raw"
import type { BodyAffairsResult } from "@/types/opd_paginated_client"
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router"
import { parseOffsetParam } from "~/lib/urls/params"

import { parseRaw, resolveOrderBy, resolveLimit } from "~/lib/dimensions/filters"
import { bodyAffairsDescriptor } from "~/lib/dimensions/descriptors"
import BodyAffairs from "~/components/opd_views/bodies/BodyAffairs"
import { bodyDimensionMeta } from "~/lib/seo/metas"

export const handle = PAGE_CONFIG.NS_BODIES_AFFAIRS.handle

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return bodyDimensionMeta(ld?.data, "affairs", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now()

    // SQL localization priority: the page language first, then the standard CH
    // fallbacks. loc() reads up to 5 slots ($2..$6); duplicates are harmless.
    const langs = contentLangs(context, params.lang)

    // URL → validated criteria (unknown sorts / facets / bad dates dropped).
    const criteria = parseRaw(bodyAffairsDescriptor, url.searchParams)
    const limit = resolveLimit(bodyAffairsDescriptor, criteria)
    const offset = parseOffsetParam(url.searchParams.get("offset") ?? 0, limit) ?? 0

    // PERSON family runner, but $1 is the BODY id (the scope slot); the descriptor
    // contributes $9..$13 (search / type / state / date-from / date-to).
    const data = await runPersonPaginatedFiltered<NonNullable<BodyAffairsResult>>(
        bodyAffairsSql,
        {
            personId: Number(params.id), // $1 = the body id (scope)
            langs,
            limit, // $7
            offset, // $8
            filters: bodyAffairsDescriptor.toSqlParams(criteria), // $9..$13
            orderBy: resolveOrderBy(bodyAffairsDescriptor, criteria),
        },
    )

    return Response.json({ data, perf: performance.now() - start })
}

export default function BodyAffairsPage() {
    const loaderData = useLoaderData()
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const [params] = useSearchParams()



    // Mirror the loader so the pager + page size match the server's slice.
    const limit = resolveLimit(bodyAffairsDescriptor, parseRaw(bodyAffairsDescriptor, params))
    const offset = parseOffsetParam(params.get("offset") ?? 0, limit) ?? 0

    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels as
        | Record<string, string>
        | undefined

    return (
        <BodyAffairs
            affairs={loaderData?.data?.affairs}
            loc={loc}
            offset={offset}
            limit={limit}
        />
    )
}