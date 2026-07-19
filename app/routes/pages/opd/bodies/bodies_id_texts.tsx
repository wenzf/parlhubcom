// routes/pages/bodies/bodies_id_texts.tsx
//
// /bodies/:id/texts — the texts attached to one body (NS_BODIES_TEXTS).
// PERSON family: runPersonPaginatedFiltered with $1 = the body id, filters $9+.
// Rendered below <BodyBase /> via the bodies layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/bodies_id_texts";

import body_texts_sql from "~/server/db/sql/bodies/body_texts_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type BodyTextsResponse,
    type BodyTextsResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { bodyTextsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";

import { BodyTexts } from "~/components/opd_views/bodies/BodyTexts";
import { bodyDimensionMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_BODIES_TEXTS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return bodyDimensionMeta(ld?.data, "texts", { lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(bodyTextsDescriptor, url.searchParams);
    const limit = resolveLimit(bodyTextsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<BodyTextsResult>>(
        body_texts_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the body id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: bodyTextsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(bodyTextsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<BodyTextsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function BodyTextsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<BodyTextsResult> & { limit: number; offset: number };
    };




    const { loc, locale } = useDashboardLoc();

    return (
        <BodyTexts
            texts={data.texts}
            bodyId={data.body.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={bodyTextsDescriptor.pageParam}
        />
    );
}