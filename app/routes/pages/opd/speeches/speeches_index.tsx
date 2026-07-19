// routes/pages/speeches/speeches_index.tsx
//
// Route module for /speeches — the top-level speeches catalogue
// (NS_SPEECHES_INDEX). LIST family: server-side search / filter / sort via
// speeches_list.sql + runListPaginatedFiltered. Analogue of texts_index.tsx.
//
// /speeches is a big table, so the filtered query can take a few seconds. The
// loader therefore DEFERS it: the promise is returned UNRESOLVED so React Router
// streams the shell first — the route renders even before the data is in the
// client — and the list resolves under a <Suspense>/<Await> spinner (same
// pattern as /bodies/:id/lobby). This is what lets a home-page search jump to
// /speeches?q=… instantly and show the spinner while the query runs.

import * as React from "react";
import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/speeches_index";
import { Await } from "react-router";

import speeches_list_sql from "~/server/db/sql/speeches/speeches_list.sql?raw";
import { runListPaginatedFiltered } from "~/server/db/core";
import {
    type SpeechesListResponse,
    type SpeechesListResult,
} from "@/types/opd_paginated_client";
import { hasActiveCriteria, parseRaw, resolveLimit, resolveOrderBy } from "~/lib/dimensions/filters";
import { speechesCatalogDescriptor } from "~/lib/dimensions/descriptors";

import { SpeechesList } from "~/components/opd_views/speeches/SpeechesList";
import { FeedLoading } from "~/components/opd_views/_shared/feeds/FeedLoading";
import { PAGE_CONFIG } from "~/configs/site.config";
import { speechesIndexMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_SPEECHES_INDEX.handle;

/** Resolved shape of the deferred `data` promise. */
type SpeechesData = NonNullable<SpeechesListResult> & { limit: number; offset: number };

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    const criteria = parseRaw(speechesCatalogDescriptor, new URLSearchParams(location.search))
    return speechesIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(speechesCatalogDescriptor, criteria),
    })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const criteria = parseRaw(speechesCatalogDescriptor, url.searchParams);
    const limit = resolveLimit(speechesCatalogDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const langs = contentLangs(context, params.lang);
    const filters = speechesCatalogDescriptor.toSqlParams(criteria);
    const orderBy = resolveOrderBy(speechesCatalogDescriptor, criteria);

    // Deferred — returned UNRESOLVED so React Router streams the shell first and
    // the list resolves under the <Suspense> spinner (big table = slow query).
    const data: Promise<SpeechesData> = Promise.resolve().then(async () => {
        const res = await runListPaginatedFiltered<NonNullable<SpeechesListResult>>(
            speeches_list_sql,
            { langs, limit, offset, filters, orderBy },
        );
        const checked = typia.assert<SpeechesListResponse>(res);
        return { ...checked, limit, offset };
    });

    return { data };
}

export default function SpeechesIndexPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as unknown as { data: Promise<SpeechesData> };

    const { loc, locale } = useDashboardLoc();

    return (
        <React.Suspense fallback={<FeedLoading loc={loc} label="speeches_loading" />}>
            <Await resolve={data}>
                {(resolved: SpeechesData) => (
                    <SpeechesList
                        speeches={resolved.speeches}
                        persons={resolved.persons?.items}
                        bodies={resolved.bodies?.items}
                        loc={loc}
                        locale={locale}
                        limit={resolved.limit}
                        offset={resolved.offset}
                        pageParam={speechesCatalogDescriptor.pageParam}
                        exportConfig={{
                            segment: "speeches",
                            datasetKey: "speeches",
                            filenameBase: "speeches",
                            subject: "all speeches",
                        }}
                    />
                )}
            </Await>
        </React.Suspense>
    );
}
