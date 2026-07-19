// NOTE: reconstructed from the votes/interests loader template — the original
// people_id_images.tsx wasn't in the project. Diff against your actual file:
// keep your import paths / handle / base personId; the loader + Page wiring below
// is the part that changes (descriptor-driven filter/sort/page).

import {
    runPersonPaginatedFiltered,
    type PageParams,
} from "~/server/db/core"

import imagesSql from "~/server/db/sql/person/person_images_by_id.sql?raw";
import type { PersonImagesResult } from "@/types/opd_paginated_client";
import { useLoaderData, useRouteLoaderData, useSearchParams } from "react-router";

import PersonImages from "~/components/opd_views/person/PersonImages";
import type { Route } from "./+types/people_id_images";

import { parseOffsetParam } from "~/lib/urls/params";
import { PAGE_CONFIG } from "~/configs/site.config";

import { parseRaw, resolveOrderBy, resolveLimit } from "~/lib/dimensions/filters";
import { imagesDescriptor } from "~/lib/dimensions/descriptors";
import { personDimensionMeta } from "~/lib/seo/metas";
import { contentLangs } from "~/server/content_langs.server";


export const handle = PAGE_CONFIG.NS_PEOPLE_IMAGES.handle


// Rich, data-driven <title>/<meta> for /people/:id/images.
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: PersonImagesResult | null }
    return personDimensionMeta(ld?.data, "images", { lang: params.lang, path: location.pathname, matches, params })
}




export async function loader({ url, params, context }: Route.LoaderArgs) {
    const start = performance.now();


    const base: Omit<PageParams, "limit" | "offset"> = {
        personId: Number(params.id),
        langs: contentLangs(context, params.lang),
    }

    // filter / sort / page-size, validated against the descriptor (no search:
    // imagesDescriptor.searchable === false, so `q` is ignored).
    const criteria = parseRaw(imagesDescriptor, url.searchParams);
    const limit = resolveLimit(imagesDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get('offset'), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<PersonImagesResult>>(
        imagesSql,
        {
            ...base,
            limit,
            offset,
            filters: imagesDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(imagesDescriptor, criteria),
        },
    );

    return Response.json({ data, perf: performance.now() - start });
}



export default function Page() {
    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')
    const loaderData = useLoaderData()
    const [params] = useSearchParams()

    // Mirror the loader so the pager + page-size match the server's slice.
    const criteria = parseRaw(imagesDescriptor, params)
    const limit = resolveLimit(imagesDescriptor, criteria)
    const offset = parseOffsetParam(params.get('offset'), limit) ?? 0

    return (
        <PersonImages
            persons={loaderData?.data?.persons}
            person_images={loaderData?.data?.person_images}
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