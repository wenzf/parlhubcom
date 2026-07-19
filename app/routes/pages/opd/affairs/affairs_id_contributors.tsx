// routes/pages/affairs/affairs_id_contributors.tsx
//
// /affairs/:id/contributors — the contributors of one affair (NS_AFFAIRS_CONTRIBUTORS).
// PERSON family: runPersonPaginatedFiltered with $1 = the affair id, filters $9+.
// Rendered below <AffairBase /> via the affairs layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/affairs_id_contributors";

import affair_contributors_sql from "~/server/db/sql/affairs/affair_contributors_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type AffairContributorsResponse,
    type AffairContributorsResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { affairContributorsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";

import { AffairContributors } from "~/components/opd_views/affairs/AffairContributors";
import { affairDimensionMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_AFFAIRS_CONTRIBUTORS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return affairDimensionMeta(ld?.data, "contributors", { lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(affairContributorsDescriptor, url.searchParams);
    const limit = resolveLimit(affairContributorsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<AffairContributorsResult>>(
        affair_contributors_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the affair id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: affairContributorsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(affairContributorsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<AffairContributorsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function AffairContributorsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<AffairContributorsResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <AffairContributors
            contributors={data.contributors}
            affairId={data.affair.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={affairContributorsDescriptor.pageParam}
        />
    );
}
