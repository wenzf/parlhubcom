// routes/pages/interests/interests_index.tsx
//
// Route module for /interests — the top-level interests catalogue
// (NS_INTERESTS_INDEX). LIST family: server-side search / filter / sort via
// interests_list.sql + runListPaginatedFiltered. Analogue of votings_index.tsx.
//
// NOTE FOR REPO WIRING (reconcile against your real votings_index.tsx):
//   • `./+types/interests_index` Route types path.
//   • the `?raw` SQL import path + alias.
//   • `loc` (pages.person.labels) reaches the component from the dashboard
//     layout loader, same as every other page.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/interests_index";

import interests_list_sql from "~/server/db/sql/interests/interests_list.sql?raw";
import { runListPaginatedFiltered } from "~/server/db/core";
import {
    type InterestsListResponse,
    type InterestsListResult,
} from "@/types/opd_paginated_client";
import {
    hasActiveCriteria,
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { interestsCatalogDescriptor } from "~/lib/dimensions/descriptors";

import { InterestsList } from "~/components/opd_views/interests/InterestsList";
import { PAGE_CONFIG } from "~/configs/site.config";
import { interestsIndexMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_INTERESTS_INDEX.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    const criteria = parseRaw(interestsCatalogDescriptor, new URLSearchParams(location.search))
    return interestsIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(interestsCatalogDescriptor, criteria),
        offset: Number(new URLSearchParams(location.search).get(interestsCatalogDescriptor.pageParam)) || 0,
    })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const criteria = parseRaw(interestsCatalogDescriptor, url.searchParams);
    const limit = resolveLimit(interestsCatalogDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runListPaginatedFiltered<NonNullable<InterestsListResult>>(
        interests_list_sql,
        {
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: interestsCatalogDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(interestsCatalogDescriptor, criteria),
        },
    );

    typia.assert<InterestsListResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function InterestsIndexPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<InterestsListResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <InterestsList
            interests={data.interests}
            persons={data.persons?.items}
            bodies={data.bodies?.items}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={interestsCatalogDescriptor.pageParam}
            exportConfig={{
                segment: "interests",
                datasetKey: "interests",
                filenameBase: "interests",
                subject: "all interests",
            }}
        />
    );
}
