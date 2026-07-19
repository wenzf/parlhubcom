// docs_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /docs CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/docs/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { docsDescriptor } from "~/lib/dimensions/descriptors";
import docsSql from "~/server/db/sql/docs/docs_list.sql?raw";

const DATASETS: ExportRegistry = {
  docs: { sql: docsSql, descriptor: docsDescriptor, resultKey: "docs" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "docs", runner: "list" });
