// meetings_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /meetings CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/meetings/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { meetingsCatalogDescriptor } from "~/lib/dimensions/descriptors";
import meetingsSql from "~/server/db/sql/meetings/meetings_list.sql?raw";

const DATASETS: ExportRegistry = {
    meetings: { sql: meetingsSql, descriptor: meetingsCatalogDescriptor, resultKey: "meetings" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "meetings", runner: "list" });
