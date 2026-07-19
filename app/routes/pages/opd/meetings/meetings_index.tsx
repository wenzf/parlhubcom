// routes/pages/meetings/meetings_index.tsx
//
// Route module for /meetings — the top-level meetings catalogue
// (NS_MEETINGS_INDEX). LIST family: server-side search / filter / sort via
// meetings_list.sql + runListPaginatedFiltered. Analogue of votings_index.tsx.
// The `group` facet is SOURCED from the OpenParlData groups endpoint (see
// opd_facet_sources.ts) — `sourced` on <DimensionControls> triggers the fetch.
//
// NOTE FOR REPO WIRING (reconcile against your real votings_index.tsx):
//   • `./+types/meetings_index` Route types path + the `?raw` SQL import alias.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/meetings_index";

import meetings_list_sql from "~/server/db/sql/meetings/meetings_list.sql?raw";
import { runListPaginatedFiltered } from "~/server/db/core";
import {
    type MeetingsListResponse,
    type MeetingsListResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
    hasActiveCriteria,
} from "~/lib/dimensions/filters";
import { meetingsCatalogDescriptor } from "~/lib/dimensions/descriptors";

import { MeetingsList } from "~/components/opd_views/meetings/MeetingsList";
import { PAGE_CONFIG } from "~/configs/site.config";
import { meetingsIndexMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_MEETINGS_INDEX.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    const criteria = parseRaw(meetingsCatalogDescriptor, new URLSearchParams(location.search))
    return meetingsIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(meetingsCatalogDescriptor, criteria),
        offset: Number(new URLSearchParams(location.search).get(meetingsCatalogDescriptor.pageParam)) || 0,
    })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const criteria = parseRaw(meetingsCatalogDescriptor, url.searchParams);
    const limit = resolveLimit(meetingsCatalogDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runListPaginatedFiltered<NonNullable<MeetingsListResult>>(
        meetings_list_sql,
        {
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: meetingsCatalogDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(meetingsCatalogDescriptor, criteria),
        },
    );

    typia.assert<MeetingsListResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function MeetingsIndexPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<MeetingsListResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <MeetingsList
            meetings={data.meetings}
            groups={data.groups?.items}
            bodies={data.bodies?.items}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={meetingsCatalogDescriptor.pageParam}
            exportConfig={{
                segment: "meetings",
                datasetKey: "meetings",
                filenameBase: "meetings",
                subject: "all meetings",
            }}
        />
    );
}
