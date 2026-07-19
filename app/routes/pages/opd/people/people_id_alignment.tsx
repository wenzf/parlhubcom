import {
    runPersonPaginatedFiltered,
    type PageParams,
} from "~/server/db/core"

import alignmentSql from "~/server/db/sql/person/person_alignment_by_id.sql?raw";
import type { PersonAlignmentResult } from "../../../../../types/opd_paginated_client";
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router";

import PersonAlignment from "~/components/opd_views/person/PersonAlignment";
import type { Route } from "./+types/people_id_alignment";

import { parseOffsetParam } from "~/lib/urls/params";
import { PAGE_CONFIG } from "~/configs/site.config";
import { contentLangs } from "~/server/content_langs.server";

import { parseRaw, resolveOrderBy, resolveLimit } from "~/lib/dimensions/filters";
import { alignmentDescriptor } from "~/lib/dimensions/descriptors";
import { personDimensionMeta } from "~/lib/seo/metas";


export const handle = PAGE_CONFIG.NS_PEOPLE_ALIGNMENT.handle


// Rich, data-driven <title>/<meta> for /people/:id/alignment (co-voting neighbours).
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PersonAlignmentResult | null }
    return personDimensionMeta(ld?.data, "alignment", { lang: params.lang, path: location.pathname, matches, params })
}


export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now();

    const base: Omit<PageParams, "limit" | "offset"> = {
        personId: Number(params.id),
        langs: contentLangs(context, params.lang),
    }

    // search / filter / sort / page-size, validated against the descriptor.
    const criteria = parseRaw(alignmentDescriptor, url.searchParams);
    const limit = resolveLimit(alignmentDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get('offset'), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<PersonAlignmentResult>>(
        alignmentSql,
        {
            ...base,
            limit,
            offset,
            filters: alignmentDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(alignmentDescriptor, criteria),
        },
    );

    return Response.json({ data, perf: performance.now() - start });
}



export default function Page() {
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const loaderData = useLoaderData()
    const [params] = useSearchParams()

    // Mirror the loader so the pager + page-size match the server's slice.
    const criteria = parseRaw(alignmentDescriptor, params)
    const limit = resolveLimit(alignmentDescriptor, criteria)
    const offset = parseOffsetParam(params.get('offset'), limit) ?? 0

    return (
        <PersonAlignment
            persons={loaderData?.data?.persons}
            neighbours={loaderData?.data?.neighbours}
            identities={loaderData?.data?.person_identities?.items}
            bodies={loaderData?.data?.bodies?.items}
            loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
            offset={offset}
            limit={limit}
            className="inset_page_transition"
            variant="page"
        />
    )
}