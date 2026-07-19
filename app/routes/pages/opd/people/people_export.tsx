// people_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /people CATALOGUE — the second tier behind
// the <DataExport> control in the list header. Same engine as the body export
// (makeExportLoader), but with the top-level LIST runner (no entity id): the
// catalogue is a single dataset, so the registry has one entry.
//
//   GET /:lang?/people/export/:dataset/:format?page=1[&<filters>]
//     :dataset = people  ·  :format ∈ json | csv | xlsx

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { peopleDescriptor } from "~/lib/dimensions/descriptors";
import peopleSql from "~/server/db/sql/person/people_list.sql?raw";

const DATASETS: ExportRegistry = {
    people: { sql: peopleSql, descriptor: peopleDescriptor, resultKey: "people" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "people", runner: "list" });
