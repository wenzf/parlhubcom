import { Outlet, useMatches, useParams, useRouteLoaderData, type ShouldRevalidateFunctionArgs } from "react-router";
import { PAGE_CONFIG, URL_PATH_SEGMENTS } from "~/configs/site.config";

import typia from "typia";
import { type RecordWithDataObject, type SiteUIMatch } from "../../../types/site";
import { type BodyByIdResponse } from "../../../types/opd_client";
import BodyBase from "~/components/opd_views/bodies/BodyBase";
import type { BodyClient } from "@/types/opd_db";
import * as React from "react";
import DataExport, { type ExportTable } from "~/components/opd_views/_shared/DataExport";
import EntityNotFound from "~/components/opd_views/_shared/EntityNotFound";
import { DataExportMcpTool } from "~/components/opd_views/_shared/DataExportMcpTool";
import {
    keyValueTable,
    rowsTable,
    bulkFromData,
    exportBaseHref,
    langExportConfig,
    feedView,
    viewInfoFromMatches,
    type ViewRowMap,
} from "~/components/opd_views/_shared/export_helpers";
import { makeT, bodyName } from "~/components/opd_views/opd_micros";
import { BODY_FEEDS } from "~/lib/seo/metas";


export const handle = PAGE_CONFIG.NS_BODIES_RESULT_LAYOUT.handle


// ── body-specific export config (the only per-entity part) ────────────────────

/** The visible rows each body feed sub-page loaded, so the "this page" export
 *  serializes the DIMENSION shown rather than the body's profile fields.
 *  Unmapped pages (overview + the analytics views) fall back to profile fields. */
const BODY_VIEW_ROWS: ViewRowMap = {
    NS_BODIES_PEOPLE: feedView("people"),
    NS_BODIES_VOTINGS: feedView("votings"),
    NS_BODIES_AFFAIRS: feedView("affairs"),
    NS_BODIES_DOCS: feedView("docs"),
    NS_BODIES_TEXTS: feedView("texts"),
    // Analytics views: the per-MP values table each computes (returned whole, no
    // bulk route). Lobby's ties are joined synchronously in its loader (the graph
    // positions stream separately), so the header export reaches them too.
    NS_BODIES_LOYALTY: feedView("loyalty"),
    NS_BODIES_ALIGNMENT: feedView("members", "alignment"),
    NS_BODIES_LOBBY: feedView("lobby"),
}

/** The body's profile as a Field/Value export table — the same facts
 *  <BodyBase>/<BodyFull> show, made downloadable. */
function bodyExportTables(body: BodyClient, loc: Record<string, string> | undefined): ExportTable[] {
    const t = makeT(loc ?? {})
    return [
        keyValueTable(
            bodyName(body, body.body_key) ?? `body-${body.id}`,
            [
                [t("facet_type"), body.type_name],
                [t("facet_country"), body.country_key],
                [t("sort_canton"), body.canton_key],
                [t("body_languages"), body.languages],
                [t("sort_population"), body.population],
                [t("body_seats_legislative"), body.legislative_seats],
                [t("body_executive"), body.executive_name],
                [t("body_seats_executive"), body.executive_seats],
                [t("body_key_label"), body.body_key],
                [t("wikidata"), body.wikidata_id],
            ],
            loc,
        ),
    ]
}


export function shouldRevalidate({
    currentParams,
    nextParams,
    defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
    // Body didn't change → keep the existing loaderData (same reference), skip the loader.
    if (currentParams.id === nextParams.id) return false;
    return defaultShouldRevalidate;
}


export default function BodiesLayout() {
    const matches = useMatches() as SiteUIMatch[]
    const params = useParams()

    // WebMCP tools call hooks unconditionally, so they must only mount on the
    // client after hydration (mirrors DimensionMcpTools' gating).
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => setMounted(true), [])

    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')

    const data_match = matches.find(
        (it) => it?.handle?.page_key && it?.handle?.is_primary_data_match)?.loaderData

    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels

    let bodyById
    if (typia.is<RecordWithDataObject>(data_match)) {
        const data_match_data = data_match.data as Partial<BodyByIdResponse>
        if (typia.is<BodyClient>(data_match_data?.body)) {
            bodyById = data_match.data as BodyByIdResponse
        }
    } else {
        // By-id lookup came back empty (or malformed) — unknown body id.
        return <EntityNotFound entity="body" loc={loc} />
    }

    if (!bodyById?.body) return <EntityNotFound entity="body" loc={loc} />
    const bulk = bulkFromData(bodyById as unknown as Record<string, unknown>, {
        feeds: BODY_FEEDS,
        // The bodies section is served at the `parliaments` URL segment, so the
        // export/download hrefs must use it too (not the literal "bodies").
        baseHref: exportBaseHref(params.lang, URL_PATH_SEGMENTS.BODIES, bodyById.body.id),
        loc,
    })
    // "This page" export = the dimension the current feed sub-page shows, or the
    // body's curated profile fields on the overview / analytics views.
    const viewInfo = viewInfoFromMatches(matches, BODY_VIEW_ROWS)
    const exportTables = viewInfo?.rows && viewInfo.rows.length > 0
        ? [rowsTable(`body-${bodyById.body.id}`, viewInfo.rows)]
        : bodyExportTables(bodyById.body, loc)

    return (
        <>
            {bodyById?.body ? (
                <div>
                    {/* grid with a minmax(0,1fr) track: the content column is hard-capped
                        at the container width and contributes zero min-width upward, so a
                        wide child (e.g. the lobby network / incidence table) can't stretch
                        the sidebar inset past the viewport. `gap-4` keeps the previous
                        vertical rhythm. */}
                    <div
                        className="grid min-w-0 gap-4 pt-0"
                        style={{ gridTemplateColumns: "minmax(0, 1fr)" }}
                    >
                        {/* Identity header + the uniform export control, top-right
                            aligned. `data-export-hide` marks chrome the print
                            stylesheet drops so a printout shows just the data. */}
                        <div className="flex items-start justify-between gap-4">
                            <BodyBase
                                body={bodyById.body}
                                loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                                className="min-w-0 flex-1"
                            />
                            <DataExport
                                filename={`body-${bodyById.body.id}${viewInfo?.dataset ? `-${viewInfo.dataset}` : ""}`}
                                tables={exportTables}
                                bulk={bulk}
                                langExport={langExportConfig(params.lang)}
                                jsonMeta={{
                                    dataset: viewInfo?.dataset ?? null,
                                    languages: langExportConfig(params.lang).initial,
                                    totalEntries: viewInfo?.total ?? null,
                                }}
                                loc={loc}
                                className="shrink-0 data-export-hide"
                            />
                        </div>

                        {/* Bulk-export Dataset JSON-LD now rides in the head
                            @graph, built in meta() (metas/body.ts → makeDatasets). */}

                        {/* Expose the bulk export to in-browser agents (WebMCP),
                            alongside the per-feed filter/query_state tools. */}
                        {mounted && bulk ? (
                            <DataExportMcpTool
                                toolName="body_export"
                                baseHref={bulk.baseHref}
                                pageSize={bulk.pageSize}
                                datasets={bulk.datasets}
                                subject="this institution's"
                            />
                        ) : null}

                        <Outlet />
                    </div>
                </div>
            ) : null}
        </>
    )
}