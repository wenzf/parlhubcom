// routes/layouts/groups_result_layout.tsx
//
// Shared layout for the group detail routes (/groups/:id and its feeds). Loads
// the group header (group + linked body) and renders <GroupBase /> once, with the
// overview/feed pages below via <Outlet /> — mirrors affairs_result_layout. The
// group's schema.org/Organization structured data is emitted as head JSON-LD by
// the route meta() (metas/group.ts → jsonld/group.ts); the Dataset blocks below
// reference it by `@id`.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/groups_result_layout";
import { Outlet, useMatches, useParams } from "react-router";

import group_by_id_sql from "~/server/db/sql/groups/group_by_id.sql?raw";
import { runByIdLocalized } from "~/server/db/core";
import {
    type GroupByIdResponse,
    type GroupByIdResult,
} from "@/types/opd_client";

import { GroupBase } from "~/components/opd_views/groups/GroupBase";
import * as React from "react";
import DataExport from "~/components/opd_views/_shared/DataExport";
import { makeEntityNotFoundBoundary } from "~/components/opd_views/_shared/EntityNotFound";
import { DataExportMcpTool } from "~/components/opd_views/_shared/DataExportMcpTool";
import {
    entityFieldsTable, rowsTable, bulkFromData, exportBaseHref, langExportConfig,
    feedView, viewInfoFromMatches,
    type ViewRowMap,
} from "~/components/opd_views/_shared/export_helpers";
import { GROUP_FEEDS } from "~/lib/seo/metas";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
/** The visible rows each group feed sub-page loaded (read off its own match, as
 *  the feed pages are not the primary data match here), so "this page" exports
 *  the DIMENSION shown; the overview falls back to the group's profile fields. */
const GROUP_VIEW_ROWS: ViewRowMap = {
    NS_GROUPS_CONTRIBUTIONS: feedView("contributions"),
    NS_GROUPS_MEETINGS: feedView("meetings"),
    NS_GROUPS_MEMBERSHIPS: feedView("memberships"),
    NS_GROUPS_VOTINGS: feedView("votings"),
};

export async function loader({ params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const data = await runByIdLocalized<GroupByIdResult>(group_by_id_sql, {
        id,
        langs: contentLangs(context, params.lang),
    });
    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<GroupByIdResponse>(data);
    return Response.json({ data });
}

// Unknown :id → the loader's 404 renders "Committee or group not found" inside the chrome.
export const ErrorBoundary = makeEntityNotFoundBoundary("group");

export default function GroupsResultLayout({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<GroupByIdResult> };
    const group = data.group;
    const body =
        data.bodies?.items?.find((b) => b.id === group.body_id) ??
        data.bodies?.items?.[0];

    const { lang } = useParams();
    const { loc, locale } = useDashboardLoc();

    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    const matches = useMatches();
    const viewInfo = viewInfoFromMatches(matches, GROUP_VIEW_ROWS);
    const exportTables = viewInfo?.rows && viewInfo.rows.length > 0
        ? [rowsTable(`group-${group.id}`, viewInfo.rows)]
        : [entityFieldsTable(`group-${group.id}`, group as unknown as Record<string, unknown>, loc)];
    const exportBulk = bulkFromData(data as unknown as Record<string, unknown>, {
        feeds: GROUP_FEEDS,
        baseHref: exportBaseHref(lang, "groups", group.id),
        loc,
    });

    return (
        <article className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <GroupBase group={group} body={body} loc={loc} locale={locale} />
                </div>
                <DataExport
                    filename={`group-${group.id}${viewInfo?.dataset ? `-${viewInfo.dataset}` : ""}`}
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
          meta() (metas/group.ts → makeDatasets). */}
            {mounted && exportBulk ? (
                <DataExportMcpTool
                    toolName="group_export"
                    baseHref={exportBulk.baseHref}
                    pageSize={exportBulk.pageSize}
                    datasets={exportBulk.datasets}
                    subject="this group's"
                />
            ) : null}
            <Outlet />
        </article>
    );
}
