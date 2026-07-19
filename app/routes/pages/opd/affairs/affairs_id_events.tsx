// routes/pages/affairs/affairs_id_events.tsx
//
// /affairs/:id/events — the lifecycle events of one affair (NS_AFFAIRS_EVENTS).
// PERSON family: runPersonPaginatedFiltered with $1 = the affair id, filters $9+.
// Rendered below <AffairBase /> via the affairs layout's <Outlet />.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/affairs_id_events";

import affair_events_sql from "~/server/db/sql/affairs/affair_events_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type AffairEventsResponse,
    type AffairEventsResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { affairEventsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";

import { AffairEvents } from "~/components/opd_views/affairs/AffairEvents";
import { affairDimensionMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_AFFAIRS_EVENTS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return affairDimensionMeta(ld?.data, "events", { lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(affairEventsDescriptor, url.searchParams);
    const limit = resolveLimit(affairEventsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<AffairEventsResult>>(
        affair_events_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the affair id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: affairEventsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(affairEventsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<AffairEventsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function AffairEventsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<AffairEventsResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <AffairEvents
            events={data.events}
            affairId={data.affair.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={affairEventsDescriptor.pageParam}
        />
    );
}
