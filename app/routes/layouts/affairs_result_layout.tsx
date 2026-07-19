// routes/layouts/affairs_result_layout.tsx
//
// Shared layout for the affair detail routes (/affairs/:id and its feeds). Loads
// the affair header (affair + linked body) and renders <AffairBase /> once, with
// the feed/overview pages below via <Outlet /> — mirrors bodies_result_layout.
// The affair's schema.org/Legislation structured data is emitted as head JSON-LD
// by the route meta() (metas/affair.ts → jsonld/affair.ts); the Dataset blocks
// below reference it by `@id`.
//
// NOTE FOR REPO WIRING (reconcile against bodies_result_layout.tsx):
//   • `./+types/affairs_result_layout` typegen path.
//   • the `?raw` SQL import path + alias.
//   • language priority resolution from the :lang param.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/affairs_result_layout";
import { Outlet, useMatches, useParams } from "react-router";

import affair_by_id_sql from "~/server/db/sql/affairs/affair_by_id.sql?raw";
import { runByIdLocalized } from "~/server/db/core";
import {
    type AffairByIdResponse,
    type AffairByIdResult,
} from "@/types/opd_client";

import { AffairBase } from "~/components/opd_views/affairs/AffairBase";
import * as React from "react";
import DataExport from "~/components/opd_views/_shared/DataExport";
import { makeEntityNotFoundBoundary } from "~/components/opd_views/_shared/EntityNotFound";
import { DataExportMcpTool } from "~/components/opd_views/_shared/DataExportMcpTool";
import {
    entityFieldsTable, rowsTable, bulkFromData, exportBaseHref, langExportConfig,
    feedView, viewInfoFromMatches,
    type ViewRowMap,
} from "~/components/opd_views/_shared/export_helpers";
import { AFFAIR_FEEDS } from "~/lib/seo/metas";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
/** The visible rows each affair feed sub-page loaded (read off its own match, as
 *  the feed pages are not the primary data match here), so "this page" exports
 *  the DIMENSION shown; the overview falls back to the affair's profile fields. */
const AFFAIR_VIEW_ROWS: ViewRowMap = {
    NS_AFFAIRS_VOTINGS: feedView("votings"),
    NS_AFFAIRS_CONTRIBUTORS: feedView("contributors"),
    NS_AFFAIRS_SPEECHES: feedView("speeches"),
    NS_AFFAIRS_DOCS: feedView("docs"),
    NS_AFFAIRS_EVENTS: feedView("events"),
    NS_AFFAIRS_TEXTS: feedView("texts"),
};

export async function loader({ params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const data = await runByIdLocalized<AffairByIdResult>(affair_by_id_sql, {
        id,
        langs: contentLangs(context, params.lang),
    });
    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<AffairByIdResponse>(data);
    return Response.json({ data });
}

// Unknown :id → the loader's 404 renders "Affair not found" inside the chrome.
export const ErrorBoundary = makeEntityNotFoundBoundary("affair");

export default function AffairsResultLayout({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<AffairByIdResult> };
    const affair = data.affair;
    const body =
        data.bodies?.items?.find((b) => b.id === affair.body_id) ??
        data.bodies?.items?.[0];

    const { lang } = useParams();
    const { loc, locale } = useDashboardLoc();

    // Export: the affair's own fields + its list feeds (bulk), same spot as bodies.
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    const matches = useMatches();
    const viewInfo = viewInfoFromMatches(matches, AFFAIR_VIEW_ROWS);
    const exportTables = viewInfo?.rows && viewInfo.rows.length > 0
        ? [rowsTable(`affair-${affair.id}`, viewInfo.rows)]
        : [entityFieldsTable(`affair-${affair.id}`, affair as unknown as Record<string, unknown>, loc)];
    const exportBulk = bulkFromData(data as unknown as Record<string, unknown>, {
        feeds: AFFAIR_FEEDS,
        baseHref: exportBaseHref(lang, "affairs", affair.id),
        loc,
    });

    return (
        <article className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <AffairBase affair={affair} body={body} loc={loc} locale={locale} />
                </div>
                <DataExport
                    filename={`affair-${affair.id}${viewInfo?.dataset ? `-${viewInfo.dataset}` : ""}`}
                    tables={exportTables}
                    bulk={exportBulk}
                    langExport={langExportConfig(lang)}
                    jsonMeta={{
                        dataset: viewInfo?.dataset ?? null,
                        languages: langExportConfig(lang).initial,
                        totalEntries: viewInfo?.total ?? null,
                    }}
                    loc={loc}
                    className="shrink-0 data-export-hide"
                />
            </div>
            {/* Bulk-export Dataset JSON-LD now rides in the head @graph, built in
          meta() (metas/affair.ts → makeDatasets). */}
            {mounted && exportBulk ? (
                <DataExportMcpTool
                    toolName="affair_export"
                    baseHref={exportBulk.baseHref}
                    pageSize={exportBulk.pageSize}
                    datasets={exportBulk.datasets}
                    subject="this affair's"
                />
            ) : null}
            <Outlet />
        </article>
    );
}
