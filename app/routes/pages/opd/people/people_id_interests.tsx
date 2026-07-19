import {
    runPersonPaginatedFiltered,
    type PageParams,
} from "~/server/db/core"

import interestsSql from "~/server/db/sql/person/person_interests_by_id.sql?raw";

import type { PersonInterestsResult } from "@/types/opd_paginated_client";
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/people_id_interests";
import { parseOffsetParam } from "~/lib/urls/params";
import PersonInterests from "~/components/opd_views/person/PersonInterests";
import { PAGE_CONFIG } from "~/configs/site.config";

import { parseRaw, resolveOrderBy, resolveLimit } from "~/lib/dimensions/filters";
import { interestsDescriptor } from "~/lib/dimensions/descriptors";
import { personDimensionMeta } from "~/lib/seo/metas";
import { contentLangs } from "~/server/content_langs.server";
// import type { PageParams } from "~/server/db/person_paginated";


export const handle = PAGE_CONFIG.NS_PEOPLE_INTERESTS.handle


// Rich, data-driven <title>/<meta> for /people/:id/interests.
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PersonInterestsResult | null }
    return personDimensionMeta(ld?.data, "interests", { lang: params.lang, path: location.pathname, matches, params })
}






export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now();

    const base: Omit<PageParams, "limit" | "offset"> = {
        personId: Number(params.id),
        langs: contentLangs(context, params.lang),
    }

    // search / filter / sort / page-size, validated against the descriptor.
    const criteria = parseRaw(interestsDescriptor, url.searchParams);
    const limit = resolveLimit(interestsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get('offset'), limit) ?? 0

    const data = await runPersonPaginatedFiltered<NonNullable<PersonInterestsResult>>(
        interestsSql,
        {
            ...base,
            limit,
            offset,
            filters: interestsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(interestsDescriptor, criteria),
        },
    );
    return Response.json({ data, perf: performance.now() - start });
}



export default function Page() {

    const loaderData = useLoaderData()

    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const [params] = useSearchParams()
    const criteria = parseRaw(interestsDescriptor, params)
    const limit = resolveLimit(interestsDescriptor, criteria)
    const offset = parseOffsetParam(params.get('offset'), limit) ?? 0



    return (
        <PersonInterests
            persons={loaderData?.data?.persons}

            identities={loaderData?.data?.person_identities?.items}
            bodies={loaderData?.data?.bodies?.items}

            interests={loaderData?.data?.interests}

            loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
            offset={offset}
            limit={limit}
            // className="inset_page_transition"
            variant="page"
        />
    )
}