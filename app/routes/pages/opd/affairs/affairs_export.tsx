// affairs_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /affairs CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/affairs/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { affairsDescriptor } from "~/lib/dimensions/descriptors";
import affairsSql from "~/server/db/sql/affairs/affairs_list.sql?raw";

const DATASETS: ExportRegistry = {
    affairs: { sql: affairsSql, descriptor: affairsDescriptor, resultKey: "affairs" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "affairs", runner: "list" });
