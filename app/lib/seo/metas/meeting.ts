// /app/lib/seo/metas/meeting.ts
//
// Meta for /meetings — sittings of council and committees. Overview + catalog
// generated; 6 sub-routes via the dimension factory. SEO copy lives in the
// `metas` block of loc_data_dashboard (keys `meeting.*`); this file resolves
// facts + wires the export/JSON-LD feeds.

import { joinParts, yearRange } from "./core";
import {
    type EntityFacts,
    makeDimensionMeta,
    makeOverviewMeta,
    makeIndexMeta,
} from "./factory";
import type { MeetingClient } from "@/types/opd_db";
import { meetingNode } from "~/lib/seo/jsonld/meeting";
import { itemListJsonLd } from "~/lib/seo/jsonld/list";
import { makeDatasets } from "~/lib/seo/jsonld/dataset";
import { meetingNodeId } from "~/lib/seo/jsonld/ids";
import { URL_PATH_SEGMENTS } from "~/configs/site.config";
import type { ExportFeedSpec } from "~/components/opd_views/_shared/export_helpers";

type MeetingBaseData = { meeting?: MeetingClient | null };

/** The meeting export feeds — single source for <DataExport> and Dataset JSON-LD. */
export const MEETING_FEEDS: ExportFeedSpec[] = [
    { key: "agendas", labelKey: "export_ds_agendas" },
    { key: "votings", labelKey: "export_ds_votings" },
    { key: "speeches", labelKey: "export_ds_speeches" },
    { key: "docs", labelKey: "export_ds_docs" },
    { key: "events", labelKey: "export_ds_events" },
    { key: "contributors", labelKey: "export_ds_contributors" },
];

const resolveMeetingFacts = (data: MeetingBaseData | null | undefined): EntityFacts | null => {
    const m = data?.meeting;
    const label = m?.name ?? m?.abbreviation ?? null;
    if (!label) return null;
    return {
        label,
        ctx: joinParts([m?.type_external, yearRange(m?.begin_date, m?.end_date), m?.location]),
    };
};

/** Dataset JSON-LD for the meeting's bulk exports (head, one per feed with rows). */
const meetingDatasets = makeDatasets<MeetingBaseData>({
    feeds: MEETING_FEEDS,
    segment: URL_PATH_SEGMENTS.MEETINGS,
    idOf: (d) => d.meeting?.id,
    scopeOf: (d) => resolveMeetingFacts(d)?.label,
    aboutId: meetingNodeId,
});

/* Overview ----------------------------------------------------------------- */

export const meetingMeta = makeOverviewMeta<MeetingBaseData>({
    resolveFacts: resolveMeetingFacts,
    copyPrefix: "meeting",
    node: meetingNode,
    datasets: meetingDatasets,
});

/* Sub-routes --------------------------------------------------------------- */

export type MeetingDimension =
    | "agendas"
    | "votings"
    | "speeches"
    | "docs"
    | "events"
    | "contributors";

const MEETING_COUNT_KEY: Record<MeetingDimension, string | null> = {
    agendas: "agendas",
    votings: "votings",
    speeches: "speeches",
    docs: "docs",
    events: "events",
    contributors: "contributors",
};

export const meetingDimensionMeta = makeDimensionMeta<MeetingDimension, MeetingBaseData>({
    resolveFacts: resolveMeetingFacts,
    copyPrefix: "meeting.dim",
    countKey: MEETING_COUNT_KEY,
    node: meetingNode,
    datasets: meetingDatasets,
});

/* Catalog ------------------------------------------------------------------ */

export const meetingsIndexMeta = makeIndexMeta<{
    meetings?: { total_count?: number; items?: MeetingClient[] };
}>({
    copyPrefix: "meeting.index",
    countKey: "meetings",
    catalogueDataset: { segment: URL_PATH_SEGMENTS.MEETINGS, datasetKey: "meetings" },
    node: (data, lang, path) =>
        itemListJsonLd(data?.meetings?.items, (m) => meetingNode({ meeting: m }, lang, path)),
});
