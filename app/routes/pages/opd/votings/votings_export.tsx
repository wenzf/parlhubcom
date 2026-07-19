// votings_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /votings CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/votings/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { votingsDescriptor } from "~/lib/dimensions/descriptors";
import votingsSql from "~/server/db/sql/votings/votings_list.sql?raw";

const DATASETS: ExportRegistry = {
    votings: { sql: votingsSql, descriptor: votingsDescriptor, resultKey: "votings" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "votings", runner: "list" });
