// routes/pages/affairs/affairs_id_docs.tsx
//
// /affairs/:id/docs — the documents attached to one affair (NS_AFFAIRS_DOCS).
// PERSON family: runPersonPaginatedFiltered with $1 = the affair id, filters $9+.
// Rendered below <AffairBase /> via the affairs layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/affairs_id_docs";

import affair_docs_sql from "~/server/db/sql/affairs/affair_docs_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type AffairDocsResponse,
    type AffairDocsResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { affairDocsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";

import { AffairDocs } from "~/components/opd_views/affairs/AffairDocs";
import { affairDimensionMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_AFFAIRS_DOCS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return affairDimensionMeta(ld?.data, "docs", { lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(affairDocsDescriptor, url.searchParams);
    const limit = resolveLimit(affairDocsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<AffairDocsResult>>(
        affair_docs_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the affair id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: affairDocsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(affairDocsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<AffairDocsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function AffairDocsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<AffairDocsResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <AffairDocs
            docs={data.docs}
            affairId={data.affair.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={affairDocsDescriptor.pageParam}
        />
    );
}
