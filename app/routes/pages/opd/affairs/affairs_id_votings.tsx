// routes/pages/affairs/affairs_id_votings.tsx
//
// /affairs/:id/votings — the votings linked to one affair (NS_AFFAIRS_VOTINGS).
// PERSON family: runPersonPaginatedFiltered with $1 = the affair id, filters $9+.
// Rendered below <AffairBase /> via the affairs layout's <Outlet />.
//
// NOTE FOR REPO WIRING (reconcile against bodies_id_votings.tsx): `./+types/…`
// path, the `?raw` SQL alias, language priority resolution.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/affairs_id_votings";

import affair_votings_sql from "~/server/db/sql/affairs/affair_votings_by_id.sql?raw";
import { runPersonPaginatedFiltered } from "~/server/db/core";
import {
    type AffairVotingsResponse,
    type AffairVotingsResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { affairVotingsDescriptor } from "~/lib/dimensions/descriptors";
import { PAGE_CONFIG } from "~/configs/site.config";

import { AffairVotings } from "~/components/opd_views/affairs/AffairVotings";
import { affairDimensionMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_AFFAIRS_VOTINGS.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return affairDimensionMeta(ld?.data, "votings", { lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const url = new URL(request.url);
    const criteria = parseRaw(affairVotingsDescriptor, url.searchParams);
    const limit = resolveLimit(affairVotingsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runPersonPaginatedFiltered<NonNullable<AffairVotingsResult>>(
        affair_votings_sql,
        {
            personId: id, // PERSON family scope slot ($1) = the affair id
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: affairVotingsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(affairVotingsDescriptor, criteria),
        },
    );

    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<AffairVotingsResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function AffairVotingsPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<AffairVotingsResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <AffairVotings
            votings={data.votings}
            affairId={data.affair.id}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={affairVotingsDescriptor.pageParam}
        />
    );
}