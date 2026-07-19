// interests_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /interests CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/interests/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { interestsCatalogDescriptor } from "~/lib/dimensions/descriptors";
import interestsSql from "~/server/db/sql/interests/interests_list.sql?raw";

const DATASETS: ExportRegistry = {
    interests: { sql: interestsSql, descriptor: interestsCatalogDescriptor, resultKey: "interests" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "interests", runner: "list" });
