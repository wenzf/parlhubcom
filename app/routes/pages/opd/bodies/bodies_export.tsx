// bodies_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /bodies CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/bodies/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { bodiesDescriptor } from "~/lib/dimensions/descriptors";
import bodiesSql from "~/server/db/sql/bodies/bodies_list.sql?raw";

const DATASETS: ExportRegistry = {
    bodies: { sql: bodiesSql, descriptor: bodiesDescriptor, resultKey: "bodies" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "bodies", runner: "list" });
