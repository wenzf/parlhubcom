// routes/affairs_index.tsx
//
// Route module for /affairs — the top-level affairs catalogue (NS_AFFAIRS_INDEX).
// LIST family: server-side search / filter / sort via affairs_list.sql +
// runListPaginatedFiltered. Analogue of the bodies catalogue route.
//
// NOTE FOR REPO WIRING (no list route-module template was in the snapshot — the
// shape below follows CATEGORIES_HANDOFF §3.4; reconcile against your real
// bodies_index.tsx):
//   • `./+types/affairs_index` Route types path.
//   • the `?raw` SQL import path + alias.
//   • language priority resolution from the :lang param.
//   • how `loc` (pages.person.labels) reaches the component — bodies_index pulls
//     it from the dashboard layout; mirror that (placeholder: loc omitted → the
//     English fallbacks render).

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/affairs_index";
import { useParams } from "react-router";

import affairs_list_sql from "~/server/db/sql/affairs/affairs_list.sql?raw";
import { runListPaginatedFiltered } from "~/server/db/core";
import {
    type AffairsListResponse,
    type AffairsListResult,
} from "@/types/opd_paginated_client";
import {
    parseRaw,
    resolveLimit,
    resolveOrderBy,
    hasActiveCriteria,
} from "~/lib/dimensions/filters";
import { affairsDescriptor } from "~/lib/dimensions/descriptors";

import { AffairsList } from "~/components/opd_views/affairs/AffairsList";
import { PAGE_CONFIG } from "~/configs/site.config";
import { affairsIndexMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_AFFAIRS_INDEX.handle

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    const criteria = parseRaw(affairsDescriptor, new URLSearchParams(location.search));
    return affairsIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(affairsDescriptor, criteria),
        offset: Number(new URLSearchParams(location.search).get(affairsDescriptor.pageParam)) || 0,
    });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const criteria = parseRaw(affairsDescriptor, url.searchParams);
    const limit = resolveLimit(affairsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runListPaginatedFiltered<NonNullable<AffairsListResult>>(
        affairs_list_sql,
        {
            langs: contentLangs(context, params.lang),
            limit,
            offset,
            filters: affairsDescriptor.toSqlParams(criteria),
            orderBy: resolveOrderBy(affairsDescriptor, criteria),
        },
    );

    typia.assert<AffairsListResponse>(data);
    return Response.json({ data: { ...data, limit, offset } });
}

export default function AffairsIndexPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as {
        data: NonNullable<AffairsListResult> & { limit: number; offset: number };
    };

    // The controls (sort / facet / search labels) localize via this `loc` map
    // (pages.person.labels) — without it makeT() falls back to English. Same loc
    // origin as every other page.
    const { lang } = useParams();
    const { loc, locale } = useDashboardLoc();



    return (
        <AffairsList
            affairs={data.affairs}
            bodies={data.bodies?.items}
            loc={loc}
            locale={locale}
            limit={data.limit}
            offset={data.offset}
            pageParam={affairsDescriptor.pageParam}
            exportConfig={{
                segment: "affairs",
                datasetKey: "affairs",
                filenameBase: "affairs",
                subject: "all affairs",
            }}
        />
    );
}