// routes/pages/texts/texts_index.tsx
//
// Route module for /texts — the top-level texts catalogue (NS_TEXTS_INDEX).
// LIST family: server-side full-text search / filter / sort via texts_list.sql +
// runListPaginatedFiltered. Analogue of votings_index.tsx / affairs_index.tsx.
//
// Big full-text table, so the query is DEFERRED (same pattern as speeches_index):
// the promise is returned UNRESOLVED, React Router streams the shell first and the
// list resolves under a <Suspense>/<Await> spinner.
//
// NOTE FOR REPO WIRING (reconcile against your real votings_index.tsx):
//   • `./+types/texts_index` Route types path.
//   • the `?raw` SQL import path + alias.
//   • `loc` (pages.person.labels) reaches the component from the dashboard
//     layout loader, same as every other page.

import * as React from "react";
import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/texts_index";
import { Await } from "react-router";

import texts_list_sql from "~/server/db/sql/texts/texts_list.sql?raw";
import { runListPaginatedFiltered } from "~/server/db/core";
import {
    type TextsListResponse,
    type TextsListResult,
} from "@/types/opd_paginated_client";
import {
    hasActiveCriteria,
    parseRaw,
    resolveLimit,
    resolveOrderBy,
} from "~/lib/dimensions/filters";
import { textsDescriptor } from "~/lib/dimensions/descriptors";

import { TextsList } from "~/components/opd_views/texts/TextsList";
import { FeedLoading } from "~/components/opd_views/_shared/feeds/FeedLoading";
import { PAGE_CONFIG } from "~/configs/site.config";
import { textsIndexMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_TEXTS_INDEX.handle;

/** Resolved shape of the deferred `data` promise. */
type TextsData = NonNullable<TextsListResult> & { limit: number; offset: number };

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    const criteria = parseRaw(textsDescriptor, new URLSearchParams(location.search))
    return textsIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(textsDescriptor, criteria),
    })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const criteria = parseRaw(textsDescriptor, url.searchParams);
    const limit = resolveLimit(textsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const langs = contentLangs(context, params.lang);
    const filters = textsDescriptor.toSqlParams(criteria);
    const orderBy = resolveOrderBy(textsDescriptor, criteria);

    // Deferred — returned UNRESOLVED so React Router streams the shell first and
    // the list resolves under the <Suspense> spinner (big full-text table).
    const data: Promise<TextsData> = Promise.resolve().then(async () => {
        const res = await runListPaginatedFiltered<NonNullable<TextsListResult>>(
            texts_list_sql,
            { langs, limit, offset, filters, orderBy },
        );
        const checked = typia.assert<TextsListResponse>(res);
        return { ...checked, limit, offset };
    });

    return { data };
}

export default function TextsIndexPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as unknown as { data: Promise<TextsData> };

    const { loc, locale } = useDashboardLoc();

    return (
        <React.Suspense fallback={<FeedLoading loc={loc} label="texts_loading" />}>
            <Await resolve={data}>
                {(resolved: TextsData) => (
                    <TextsList
                        texts={resolved.texts}
                        bodies={resolved.bodies?.items}
                        loc={loc}
                        locale={locale}
                        limit={resolved.limit}
                        offset={resolved.offset}
                        pageParam={textsDescriptor.pageParam}
                        exportConfig={{
                            segment: "texts",
                            datasetKey: "texts",
                            filenameBase: "texts",
                            subject: "all texts",
                        }}
                    />
                )}
            </Await>
        </React.Suspense>
    );
}