import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/bodies_id_votings"
import { PAGE_CONFIG } from "~/configs/site.config"

import { runPersonPaginatedFiltered } from "~/server/db/core"
import bodyVotingsSql from "~/server/db/sql/bodies/body_votings_by_id.sql?raw"
import type { BodyVotingsResult } from "@/types/opd_paginated_client"
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router"
import { parseOffsetParam } from "~/lib/urls/params"

import { parseRaw, resolveOrderBy, resolveLimit } from "~/lib/dimensions/filters"
import { bodyVotingsDescriptor } from "~/lib/dimensions/descriptors"
import BodyVotings from "~/components/opd_views/bodies/BodyVotings"
import { bodyDimensionMeta } from "~/lib/seo/metas"

export const handle = PAGE_CONFIG.NS_BODIES_VOTINGS.handle

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return bodyDimensionMeta(ld?.data, "votings", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now()

    // SQL localization priority: the page language first, then the standard CH
    // fallbacks. loc() reads up to 5 slots ($2..$6); duplicates are harmless.
    const langs = contentLangs(context, params.lang)

    // URL → validated criteria (unknown sorts / bad dates dropped).
    const criteria = parseRaw(bodyVotingsDescriptor, url.searchParams)
    const limit = resolveLimit(bodyVotingsDescriptor, criteria)
    const offset = parseOffsetParam(url.searchParams.get("offset") ?? 0, limit) ?? 0

    // PERSON family runner, but $1 is the BODY id (the scope slot); the descriptor
    // contributes $9..$12 (search / date-from / date-to / chamber).
    const data = await runPersonPaginatedFiltered<NonNullable<BodyVotingsResult>>(
        bodyVotingsSql,
        {
            personId: Number(params.id), // $1 = the body id (scope)
            langs,
            limit, // $7
            offset, // $8
            filters: bodyVotingsDescriptor.toSqlParams(criteria), // $9..$11
            orderBy: resolveOrderBy(bodyVotingsDescriptor, criteria),
        },
    )

    return Response.json({ data, perf: performance.now() - start })
}

export default function BodyVotingsPage() {
    const loaderData = useLoaderData()
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const [params] = useSearchParams()


    // Mirror the loader so the pager + page size match the server's slice.
    const limit = resolveLimit(bodyVotingsDescriptor, parseRaw(bodyVotingsDescriptor, params))
    const offset = parseOffsetParam(params.get("offset") ?? 0, limit) ?? 0

    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels as
        | Record<string, string>
        | undefined

    return (
        <BodyVotings
            votings={loaderData?.data?.votings}
            chambers={loaderData?.data?.chambers}
            loc={loc}
            offset={offset}
            limit={limit}
        />
    )
}