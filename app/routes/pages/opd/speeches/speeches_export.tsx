// speeches_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /speeches CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/speeches/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { speechesCatalogDescriptor } from "~/lib/dimensions/descriptors";
import speechesSql from "~/server/db/sql/speeches/speeches_list.sql?raw";

const DATASETS: ExportRegistry = {
    speeches: { sql: speechesSql, descriptor: speechesCatalogDescriptor, resultKey: "speeches" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "speeches", runner: "list" });
