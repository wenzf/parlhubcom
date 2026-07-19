// routes/pages/affairs/affairs_id_speeches.tsx
//
// /affairs/:id/speeches — the speeches given on one affair (NS_AFFAIRS_SPEECHES).
// PERSON family: runPersonPaginatedFiltered with $1 = the affair id, filters $9+.
// Rendered below <AffairBase /> via the affairs layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/affairs_id_speeches";

import affair_speeches_sql from "~/server/db/sql/affairs/affair_speeches_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type AffairSpeechesResponse,
    type AffairSpeechesResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { affairSpeechesDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";

import { AffairSpeeches } from "~/components/opd_views/affairs/AffairSpeeches";
import { affairDimensionMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_AFFAIRS_SPEECHES.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return affairDimensionMeta(ld?.data, "speeches", { lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(affairSpeechesDescriptor, url.searchParams);
    const limit = resolveLimit(affairSpeechesDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<AffairSpeechesResult>>(
        affair_speeches_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the affair id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: affairSpeechesDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(affairSpeechesDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<AffairSpeechesResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function AffairSpeechesPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<AffairSpeechesResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <AffairSpeeches
            speeches={data.speeches}
            bodies={data.bodies?.items}
            persons={data.persons?.items}
            affairId={data.affair.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={affairSpeechesDescriptor.pageParam}
        />
    );
}
