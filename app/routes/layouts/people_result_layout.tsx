import { Outlet, useMatches, useParams, useRouteLoaderData, type ShouldRevalidateFunctionArgs } from "react-router";
import { PAGE_CONFIG } from "~/configs/site.config";
import typia from "typia";
import * as React from "react";
import { type RecordWithDataObject, type SiteUIMatch } from "../../../types/site";
import { type PersonByIdResponse } from "../../../types/opd_client";
import PersonBase from "~/components/opd_views/person/PersonBase";
import type { BodyClient, IdentityClient, PersonClient } from "@/types/opd_db";
import DataExport from "~/components/opd_views/_shared/DataExport";
import EntityNotFound from "~/components/opd_views/_shared/EntityNotFound";
import { DataExportMcpTool } from "~/components/opd_views/_shared/DataExportMcpTool";
import {
    bulkFromData, exportBaseHref, langExportConfig,
    feedView, viewInfoFromMatches, viewTables,
    type ViewRowMap,
} from "~/components/opd_views/_shared/export_helpers";
import { PERSON_FEEDS } from "~/lib/seo/metas";


export const handle = PAGE_CONFIG.NS_PEOPLE_RESULT_LAYOUT.handle


/** The visible rows each person sub-page loaded, so the "this page" export
 *  serializes the DIMENSION shown (votes, interests, co-voting neighbours, …)
 *  rather than the person's profile fields. Unmapped pages (the overview) fall
 *  back to profile fields. */
const PERSON_VIEW_ROWS: ViewRowMap = {
    NS_PEOPLE_VOTES: feedView("votes"),
    NS_PEOPLE_ALIGNMENT: feedView("neighbours", "alignment"),
    NS_PEOPLE_ACCESS_BADGES: feedView("access_badges", "lobby"),
    NS_PEOPLE_CONTRIBUTORS: feedView("contributors", "contributions"),
    NS_PEOPLE_INTERESTS: feedView("interests"),
    NS_PEOPLE_MEMBERSHIPS: feedView("membership_groups", "memberships"),
    NS_PEOPLE_SPEECHES: feedView("speeches"),
    NS_PEOPLE_IMAGES: feedView("person_images", "images"),
    NS_PEOPLE_VOCABULARY: {
        dataset: "vocabulary",
        rows: (d) => (d?.topics as { words?: Record<string, unknown>[] } | undefined)?.words,
        total: (d) => (d?.topics as { words?: unknown[] } | undefined)?.words?.length,
    },
}


export function shouldRevalidate({
    currentParams,
    nextParams,
    defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
    // Person didn't change → keep the existing loaderData (same reference), skip the loader.
    if (currentParams.id === nextParams.id) return false;
    return defaultShouldRevalidate;
}


export default function PeopleLayout() {
    const matches = useMatches() as SiteUIMatch[]
    const params = useParams()
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => setMounted(true), [])

    const layoutRouteLoaderData = useRouteLoaderData('routes/layouts/data_dashboard_layout')


    const data_match = matches.find(
        (it) => it?.handle?.page_key && it?.handle?.is_primary_data_match)?.loaderData

    const loc_labels = layoutRouteLoaderData?.locs?.pages?.person?.labels

    let personById
    if (typia.is<RecordWithDataObject>(data_match)) {
        const data_match_data = data_match.data as Partial<PersonByIdResponse>
        if (
            typia.is<PersonClient>(data_match_data?.persons)
            && (data_match_data?.person_identities?.items ?? []).every(
                (it) => typia.is<IdentityClient>(it))
            && (data_match_data?.bodies?.items ?? []).every(
                (it) => typia.is<BodyClient>(it))
        ) {
            personById = data_match.data as PersonByIdResponse
        }
    } else {
        // By-id lookup came back empty (or malformed) — unknown person id.
        return <EntityNotFound entity="person" loc={loc_labels} />
    }
    if (!personById) return <EntityNotFound entity="person" loc={loc_labels} />

    const loc = loc_labels
    const personId = personById?.persons?.id
    const personBaseHref = personId != null ? exportBaseHref(params.lang, "people", personId) : ""
    const personBulk = personId != null
        ? bulkFromData(personById as unknown as Record<string, unknown>, { feeds: PERSON_FEEDS, baseHref: personBaseHref, loc })
        : undefined
    // "This page" export = the dimension the current sub-page shows (or the
    // person's profile fields on the overview).
    const viewInfo = viewInfoFromMatches(matches, PERSON_VIEW_ROWS)

    return (
        <>
            {personById?.persons && personById.person_identities ? (
                <div>
                    <div className="flex flex-1 flex-col gap-4  pt-0">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <PersonBase
                                    persons={personById.persons}
                                    identities={personById?.person_identities?.items}
                                    bodies={personById.bodies?.items}
                                    loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                                />
                            </div>
                            <DataExport
                                filename={`person-${personById.persons.id}${viewInfo?.dataset ? `-${viewInfo.dataset}` : ""}`}
                                tables={viewTables({
                                    rows: viewInfo?.rows,
                                    name: `person-${personById.persons.id}`,
                                    entity: personById.persons as unknown as Record<string, unknown>,
                                    loc,
                                })}
                                bulk={personBulk}
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
                            @graph, built in meta() (metas/person.ts → makeDatasets). */}
                        {mounted && personBulk ? (
                            <DataExportMcpTool
                                toolName="person_export"
                                baseHref={personBulk.baseHref}
                                pageSize={personBulk.pageSize}
                                datasets={personBulk.datasets}
                                subject="this person's"
                            />
                        ) : null}
                        <Outlet />


                    </div>
                </div>
            ) : null}


        </>

    )
}