// routes/layouts/meetings_result_layout.tsx
//
// Shared layout for the meeting detail routes (/meetings/:id [+ any future
// feeds]). Loads the meeting header (meeting + group + body) and renders
// <MeetingBase /> once, with the overview (and any feed pages) below via
// <Outlet /> — mirrors interests_result_layout / groups_result_layout.
//
// A meeting is currently a LEAF (no sub-feeds); this layout gives it the same
// family shape so feed routes can drop under it later without restructuring. The
// meeting's schema.org/Event structured data is emitted as head JSON-LD by the
// route meta() (metas/meeting.ts → jsonld/meeting.ts); the Dataset blocks below
// reference it by `@id`. Like groups_result_layout, this layout carries NO PAGE_CONFIG
// namespace/handle: the section sidebar + breadcrumbs are driven by the matched
// child route (NS_MEETINGS_OVERVIEW).
//
// NOTE FOR REPO WIRING (reconcile against your real groups_result_layout.tsx):
//   • `./+types/meetings_result_layout` Route types path + the `?raw` SQL alias.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/meetings_result_layout";
import { Outlet, useMatches, useParams } from "react-router";

import meeting_by_id_sql from "~/server/db/sql/meetings/meeting_by_id.sql?raw";
import { runByIdLocalized } from "~/server/db/core";
import {
    type MeetingByIdResponse,
    type MeetingByIdResult,
} from "@/types/opd_client";

import { MeetingBase } from "~/components/opd_views/meetings/MeetingBase";
import * as React from "react";
import DataExport from "~/components/opd_views/_shared/DataExport";
import { makeEntityNotFoundBoundary } from "~/components/opd_views/_shared/EntityNotFound";
import { DataExportMcpTool } from "~/components/opd_views/_shared/DataExportMcpTool";
import {
    entityFieldsTable, rowsTable, bulkFromData, exportBaseHref, langExportConfig,
    feedView, viewInfoFromMatches,
    type ViewRowMap,
} from "~/components/opd_views/_shared/export_helpers";
import { MEETING_FEEDS } from "~/lib/seo/metas";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
/** The visible rows each meeting feed sub-page loaded (read off its own match, as
 *  the feed pages are not the primary data match here), so "this page" exports
 *  the DIMENSION shown; the overview falls back to the meeting's profile fields. */
const MEETING_VIEW_ROWS: ViewRowMap = {
    NS_MEETINGS_AGENDAS: feedView("agendas"),
    NS_MEETINGS_VOTINGS: feedView("votings"),
    NS_MEETINGS_SPEECHES: feedView("speeches"),
    NS_MEETINGS_DOCS: feedView("docs"),
    NS_MEETINGS_EVENTS: feedView("events"),
    NS_MEETINGS_CONTRIBUTORS: feedView("contributors"),
};

export async function loader({ params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const data = await runByIdLocalized<MeetingByIdResult>(meeting_by_id_sql, {
        id,
        langs: contentLangs(context, params.lang),
    });
    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<MeetingByIdResponse>(data);
    return Response.json({ data });
}

// Unknown :id → the loader's 404 renders "Meeting not found" inside the chrome.
export const ErrorBoundary = makeEntityNotFoundBoundary("meeting");

export default function MeetingsResultLayout({
    loaderData,
}: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<MeetingByIdResult> };
    const meeting = data.meeting;

    const group = data.groups?.items?.[0];
    const body =
        data.bodies?.items?.find((b) => b.id === meeting.body_id) ??
        data.bodies?.items?.[0];

    const { lang } = useParams();
    const { loc, locale } = useDashboardLoc();

    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    const matches = useMatches();
    const viewInfo = viewInfoFromMatches(matches, MEETING_VIEW_ROWS);
    const exportTables = viewInfo?.rows && viewInfo.rows.length > 0
        ? [rowsTable(`meeting-${meeting.id}`, viewInfo.rows)]
        : [entityFieldsTable(`meeting-${meeting.id}`, meeting as unknown as Record<string, unknown>, loc)];
    const exportBulk = bulkFromData(data as unknown as Record<string, unknown>, {
        feeds: MEETING_FEEDS,
        baseHref: exportBaseHref(lang, "meetings", meeting.id),
        loc,
    });

    return (
        <article className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <MeetingBase
                        meeting={meeting}
                        group={group}
                        body={body}
                        loc={loc}
                        locale={locale}
                    />
                </div>
                <DataExport
                    filename={`meeting-${meeting.id}${viewInfo?.dataset ? `-${viewInfo.dataset}` : ""}`}
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
          meta() (metas/meeting.ts → makeDatasets). */}
            {mounted && exportBulk ? (
                <DataExportMcpTool
                    toolName="meeting_export"
                    baseHref={exportBulk.baseHref}
                    pageSize={exportBulk.pageSize}
                    datasets={exportBulk.datasets}
                    subject="this meeting's"
                />
            ) : null}
            <Outlet />
        </article>
    );
}
