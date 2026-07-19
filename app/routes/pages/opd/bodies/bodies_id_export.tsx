// bodies_id_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of a body's list datasets, delivered as a plain
// download link (the second tier behind <DataExport>: the menu's "Full dataset"
// links point here). The client-side export in <DataExport> only covers the
// visible slice; this streams the WHOLE dataset in fixed 500-row pages.
//
//   GET /:lang?/bodies/:id/export/:dataset/:format?page=1[&<filters>]
//     :dataset ∈ votings | affairs | texts | docs | people
//     :format  ∈ json | csv | xlsx
//
// All the shared machinery lives in makeExportLoader (~/server/export); this file
// is just the body REGISTRY + one call. Other entity families export the same way.

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import {
    bodyVotingsDescriptor,
    bodyAffairsDescriptor,
    bodyTextsDescriptor,
    bodyDocsDescriptor,
    bodyPeopleDescriptor,
} from "~/lib/dimensions/descriptors";

import bodyVotingsSql from "~/server/db/sql/bodies/body_votings_by_id.sql?raw";
import bodyAffairsSql from "~/server/db/sql/bodies/body_affairs_by_id.sql?raw";
import bodyTextsSql from "~/server/db/sql/bodies/body_texts_by_id.sql?raw";
import bodyDocsSql from "~/server/db/sql/bodies/body_docs_by_id.sql?raw";
import bodyPeopleSql from "~/server/db/sql/bodies/body_people_by_id.sql?raw";

/** dataset segment → SQL + descriptor + result key. Every entry is a PERSON-family
 *  paginated feed with $1 = the body id. */
const DATASETS: ExportRegistry = {
    votings: { sql: bodyVotingsSql, descriptor: bodyVotingsDescriptor, resultKey: "votings" },
    affairs: { sql: bodyAffairsSql, descriptor: bodyAffairsDescriptor, resultKey: "affairs" },
    texts: { sql: bodyTextsSql, descriptor: bodyTextsDescriptor, resultKey: "texts" },
    docs: { sql: bodyDocsSql, descriptor: bodyDocsDescriptor, resultKey: "docs" },
    people: { sql: bodyPeopleSql, descriptor: bodyPeopleDescriptor, resultKey: "people" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "body" });
