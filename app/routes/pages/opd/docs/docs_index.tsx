// routes/pages/docs/docs_index.tsx
//
// Route module for /docs — the top-level docs catalogue (NS_DOCS_INDEX).
// LIST family: server-side search / filter / sort via docs_list.sql +
// runListPaginatedFiltered. Analogue of texts_index.tsx / votings_index.tsx.
//
// Big full-text table, so the query is DEFERRED (same pattern as speeches_index):
// the promise is returned UNRESOLVED, React Router streams the shell first and the
// list resolves under a <Suspense>/<Await> spinner.
//
// NOTE FOR REPO WIRING (reconcile against your real texts_index.tsx):
//   • `./+types/docs_index` Route types path.
//   • the `?raw` SQL import path + alias.
//   • `loc` (pages.person.labels) reaches the component from the dashboard
//     layout loader, same as every other page.

import * as React from "react";
import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/docs_index";
import { Await, useParams, useRouteLoaderData } from "react-router";

import docs_list_sql from "~/server/db/sql/docs/docs_list.sql?raw";
import { runListPaginatedFiltered } from "~/server/db/core";
import {
  type DocsListResponse,
  type DocsListResult,
} from "@/types/opd_paginated_client";
import {
  hasActiveCriteria,
  parseRaw,
  resolveLimit,
  resolveOrderBy,
} from "~/lib/dimensions/filters";
import { docsDescriptor } from "~/lib/dimensions/descriptors";

import { DocsList } from "~/components/opd_views/docs/DocsList";
import { FeedLoading } from "~/components/opd_views/_shared/feeds/FeedLoading";
import { PAGE_CONFIG } from "~/configs/site.config";
import { docsIndexMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

export const handle = PAGE_CONFIG.NS_DOCS_INDEX.handle;

/** Resolved shape of the deferred `data` promise. */
type DocsData = NonNullable<DocsListResult> & { limit: number; offset: number };

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
  const ld = loaderData as unknown as { data?: any }
  const criteria = parseRaw(docsDescriptor, new URLSearchParams(location.search))
  return docsIndexMeta(ld?.data, {
    lang: params.lang,
    path: location.pathname, matches, params,
    query: criteria.q,
    filtered: hasActiveCriteria(docsDescriptor, criteria),
  })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const criteria = parseRaw(docsDescriptor, url.searchParams);
  const limit = resolveLimit(docsDescriptor, criteria);
  const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

  const langs = contentLangs(context, params.lang);
  const filters = docsDescriptor.toSqlParams(criteria);
  const orderBy = resolveOrderBy(docsDescriptor, criteria);

  // Deferred — returned UNRESOLVED so React Router streams the shell first and
  // the list resolves under the <Suspense> spinner (big full-text table).
  const data: Promise<DocsData> = Promise.resolve().then(async () => {
    const res = await runListPaginatedFiltered<NonNullable<DocsListResult>>(
      docs_list_sql,
      { langs, limit, offset, filters, orderBy },
    );
    const checked = typia.assert<DocsListResponse>(res);
    return { ...checked, limit, offset };
  });

  return { data };
}

export default function DocsIndexPage({ loaderData }: Route.ComponentProps) {
  const { data } = loaderData as unknown as { data: Promise<DocsData> };

  const { lang } = useParams();
  const layoutRouteLoaderData = useRouteLoaderData(
    "routes/layouts/data_dashboard_layout",
  ) as
    | { locs?: { pages?: { person?: { labels?: Record<string, string> } } }; locale?: string }
    | undefined;
  const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels ?? {};
  const locale =
    layoutRouteLoaderData?.locale ?? (lang ? `${lang}-CH` : "de-CH");

  return (
    <React.Suspense fallback={<FeedLoading loc={loc} label="docs_loading" />}>
      <Await resolve={data}>
        {(resolved: DocsData) => (
          <DocsList
            docs={resolved.docs}
            bodies={resolved.bodies?.items}
            loc={loc}
            locale={locale}
            limit={resolved.limit}
            offset={resolved.offset}
            pageParam={docsDescriptor.pageParam}
            exportConfig={{
              segment: "docs",
              datasetKey: "docs",
              filenameBase: "docs",
              subject: "all documents",
            }}
          />
        )}
      </Await>
    </React.Suspense>
  );
}
