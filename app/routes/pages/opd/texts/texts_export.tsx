// texts_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /texts CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/texts/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { textsDescriptor } from "~/lib/dimensions/descriptors";
import textsSql from "~/server/db/sql/texts/texts_list.sql?raw";

const DATASETS: ExportRegistry = {
    texts: { sql: textsSql, descriptor: textsDescriptor, resultKey: "texts" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "texts", runner: "list" });
