// affairs_id_export.tsx — RESOURCE ROUTE (loader only). Bulk paginated export of an
// affair's list feeds. Same engine as every export (makeExportLoader, person runner).

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import {
    affairVotingsDescriptor, affairContributorsDescriptor, affairSpeechesDescriptor,
    affairDocsDescriptor, affairEventsDescriptor, affairTextsDescriptor,
} from "~/lib/dimensions/descriptors";
import votingsSql from "~/server/db/sql/affairs/affair_votings_by_id.sql?raw";
import contributorsSql from "~/server/db/sql/affairs/affair_contributors_by_id.sql?raw";
import speechesSql from "~/server/db/sql/affairs/affair_speeches_by_id.sql?raw";
import docsSql from "~/server/db/sql/affairs/affair_docs_by_id.sql?raw";
import eventsSql from "~/server/db/sql/affairs/affair_events_by_id.sql?raw";
import textsSql from "~/server/db/sql/affairs/affair_texts_by_id.sql?raw";

const DATASETS: ExportRegistry = {
    votings: { sql: votingsSql, descriptor: affairVotingsDescriptor, resultKey: "votings" },
    contributors: { sql: contributorsSql, descriptor: affairContributorsDescriptor, resultKey: "contributors" },
    speeches: { sql: speechesSql, descriptor: affairSpeechesDescriptor, resultKey: "speeches" },
    docs: { sql: docsSql, descriptor: affairDocsDescriptor, resultKey: "docs" },
    events: { sql: eventsSql, descriptor: affairEventsDescriptor, resultKey: "events" },
    texts: { sql: textsSql, descriptor: affairTextsDescriptor, resultKey: "texts" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "affair" });
