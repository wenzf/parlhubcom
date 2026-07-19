// routes/pages/meetings/meetings_id_docs.tsx
//
// /meetings/:id/docs — the docs of one meeting (NS_MEETINGS_DOCS).
// PERSON family: runPersonPaginatedFiltered with $1 = the meeting id, filters $9+.
// Rendered below <MeetingBase /> via the meetings layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/meetings_id_docs";

import feed_sql from "~/server/db/sql/meetings/meeting_docs_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import { type MeetingDocsResponse, type MeetingDocsResult } from "@/types/opd_paginated_client";
import { parseRaw, resolveLimit, resolveOrderBy } from "~/lib/dimensions/filters";
import { meetingDocsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";
import { meetingDimensionMeta } from "~/lib/seo/metas";

import { MeetingDocs } from "~/components/opd_views/meetings/MeetingFeeds";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_MEETINGS_DOCS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return meetingDimensionMeta(ld?.data, "docs", { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(meetingDocsDescriptor, url.searchParams);
    const limit = resolveLimit(meetingDocsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<MeetingDocsResult>>(feed_sql, {
        personId: id, // PERSON family scope slot ($1) = the meeting id
        langs: contentLangs(context, params.lang),
        limit,
        offset,
        filters: meetingDocsDescriptor.toSqlParams(criteria),
        orderBy: resolveOrderBy(meetingDocsDescriptor, criteria),
    });

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<MeetingDocsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function MeetingDocsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<MeetingDocsResult> & { limit: number; offset: number } };

    const { loc, locale } = useDashboardLoc();

    return (
        <MeetingDocs
            docs={data.docs}
            loc={loc}
            locale={locale}
            variant="page"
            limit={data.limit}
            offset={data.offset}
            pageParam={meetingDocsDescriptor.pageParam}
        />
    );
}
