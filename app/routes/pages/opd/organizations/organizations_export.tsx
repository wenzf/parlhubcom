// organizations_export.tsx  — RESOURCE ROUTE (loader only, no component)
//
// Bulk, paginated raw export of the /organizations CATALOGUE — the second tier behind the
// <DataExport> control in the list header. Same engine as every other export
// (makeExportLoader) with the top-level LIST runner (no entity id); the catalogue
// is a single dataset.
//
//   GET /:lang?/organizations/export/:dataset/:format?page=1[&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import { organizationsDescriptor } from "~/lib/dimensions/descriptors";
import organizationsSql from "~/server/db/sql/organizations/organizations_list.sql?raw";

const DATASETS: ExportRegistry = {
    organizations: { sql: organizationsSql, descriptor: organizationsDescriptor, resultKey: "organizations" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "organizations", runner: "list" });
