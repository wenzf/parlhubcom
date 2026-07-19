// routes/pages/votings/votings_index.tsx
//
// Route module for /votings — the top-level votings catalogue (NS_VOTINGS_INDEX).
// LIST family: server-side search / filter / sort via votings_list.sql +
// runListPaginatedFiltered. Analogue of affairs_index.tsx / bodies_index.tsx.
//
// NOTE FOR REPO WIRING (reconcile against your real affairs_index.tsx):
//   • `./+types/votings_index` Route types path.
//   • the `?raw` SQL import path + alias.
//   • `loc` (pages.person.labels) reaches the component from the dashboard
//     layout loader, same as every other page.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/votings_index";

import votings_list_sql from "~/server/db/sql/votings/votings_list.sql?raw";
import { runListPaginatedFiltered } from "~/server/db/core";
import {
    type VotingsListResponse,
    type VotingsListResult,
} from "@/types/opd_paginated_client";
import {
    hasActiveCriteria,
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { votingsDescriptor } from "~/lib/dimensions/descriptors";

import { VotingsList } from "~/components/opd_views/votings/VotingsList";
import { PAGE_CONFIG } from "~/configs/site.config";
import { votingsIndexMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_VOTINGS_INDEX.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    const criteria = parseRaw(votingsDescriptor, new URLSearchParams(location.search))
    return votingsIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(votingsDescriptor, criteria),
    })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const criteria = parseRaw(votingsDescriptor, url.searchParams);
    const limit = resolveLimit(votingsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runListPaginatedFiltered<NonNullable<VotingsListResult>>(
        votings_list_sql,
        {
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: votingsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(votingsDescriptor, criteria),
        },
    );

    typia.assert<VotingsListResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function VotingsIndexPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<VotingsListResult> & { limit: number; offset: number };
    };

    const { loc, locale } = useDashboardLoc();

    return (
        <VotingsList
            votings={data.votings}
            bodies={data.bodies?.items}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={votingsDescriptor.pageParam}
            exportConfig={{
                segment: "votings",
                datasetKey: "votings",
                filenameBase: "votings",
                subject: "all votings",
            }}
        />
    );
}
