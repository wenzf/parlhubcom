// groups_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /groups CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/groups/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { groupsDescriptor } from "~/lib/dimensions/descriptors";
import groupsSql from "~/server/db/sql/groups/groups_list.sql?raw";

const DATASETS: ExportRegistry = {
    groups: { sql: groupsSql, descriptor: groupsDescriptor, resultKey: "groups" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "groups", runner: "list" });
