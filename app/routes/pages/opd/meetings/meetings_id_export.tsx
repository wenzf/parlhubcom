// meetings_id_export.tsx — RESOURCE ROUTE (loader only). Bulk paginated export of a
// meeting's list feeds. Same engine as every export (makeExportLoader, person runner).

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import {
    meetingAgendasDescriptor, meetingVotingsDescriptor, meetingSpeechesDescriptor,
    meetingDocsDescriptor, meetingEventsDescriptor, meetingContributorsDescriptor,
} from "~/lib/dimensions/descriptors";
import agendasSql from "~/server/db/sql/meetings/meeting_agendas_by_id.sql?raw";
import votingsSql from "~/server/db/sql/meetings/meeting_votings_by_id.sql?raw";
import speechesSql from "~/server/db/sql/meetings/meeting_speeches_by_id.sql?raw";
import docsSql from "~/server/db/sql/meetings/meeting_docs_by_id.sql?raw";
import eventsSql from "~/server/db/sql/meetings/meeting_events_by_id.sql?raw";
import contributorsSql from "~/server/db/sql/meetings/meeting_contributors_by_id.sql?raw";

const DATASETS: ExportRegistry = {
    agendas: { sql: agendasSql, descriptor: meetingAgendasDescriptor, resultKey: "agendas" },
    votings: { sql: votingsSql, descriptor: meetingVotingsDescriptor, resultKey: "votings" },
    speeches: { sql: speechesSql, descriptor: meetingSpeechesDescriptor, resultKey: "speeches" },
    docs: { sql: docsSql, descriptor: meetingDocsDescriptor, resultKey: "docs" },
    events: { sql: eventsSql, descriptor: meetingEventsDescriptor, resultKey: "events" },
    contributors: { sql: contributorsSql, descriptor: meetingContributorsDescriptor, resultKey: "contributors" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "meeting" });
