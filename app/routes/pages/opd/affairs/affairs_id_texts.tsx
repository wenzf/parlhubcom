// routes/pages/affairs/affairs_id_texts.tsx
//
// /affairs/:id/texts — the texts attached to one affair (NS_AFFAIRS_TEXTS).
// PERSON family: runPersonPaginatedFiltered with $1 = the affair id, filters $9+.
// Rendered below <AffairBase /> via the affairs layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/affairs_id_texts";

import affair_texts_sql from "~/server/db/sql/affairs/affair_texts_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type AffairTextsResponse,
    type AffairTextsResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { affairTextsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";

import { AffairTexts } from "~/components/opd_views/affairs/AffairTexts";
import { affairDimensionMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_AFFAIRS_TEXTS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return affairDimensionMeta(ld?.data, "texts", { lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(affairTextsDescriptor, url.searchParams);
    const limit = resolveLimit(affairTextsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<AffairTextsResult>>(
        affair_texts_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the affair id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: affairTextsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(affairTextsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<AffairTextsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function AffairTextsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<AffairTextsResult> & { limit: number; offset: number };
    };




    const { loc, locale } = useDashboardLoc();

    return (
        <AffairTexts
            texts={data.texts}
            affairId={data.affair.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={affairTextsDescriptor.pageParam}
        />
    );
}