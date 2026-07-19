// routes/pages/bodies/bodies_id_docs.tsx
//
// /bodies/:id/docs — the documents attached to one body (NS_BODIES_DOCS).
// PERSON family: runPersonPaginatedFiltered with $1 = the body id, filters $9+.
// Rendered below <BodyBase /> via the bodies layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/bodies_id_docs";

import body_docs_sql from "~/server/db/sql/bodies/body_docs_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type BodyDocsResponse,
    type BodyDocsResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { bodyDocsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";

import { BodyDocs } from "~/components/opd_views/bodies/BodyDocs";
import { bodyDimensionMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_BODIES_DOCS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return bodyDimensionMeta(ld?.data, "docs", { lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(bodyDocsDescriptor, url.searchParams);
    const limit = resolveLimit(bodyDocsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<BodyDocsResult>>(
        body_docs_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the body id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: bodyDocsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(bodyDocsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<BodyDocsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function BodyDocsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<BodyDocsResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <BodyDocs
            docs={data.docs}
            bodyId={data.body.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={bodyDocsDescriptor.pageParam}
        />
    );
}
