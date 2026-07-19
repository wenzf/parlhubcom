// routes/layouts/organizations_result_layout.tsx
//
// Shared layout for /organizations/:id [+ any future feeds]. Like
// people_result_layout: it doesn't fetch — it reads the primary data-match child
// (the overview, is_primary_data_match) via useMatches and renders <OrgBase/> once
// with the child page below via <Outlet/>. Keeps the org detail in the same family
// shape as people/bodies so feed routes can be added without restructuring.

import {
    Outlet,
    useMatches,
    useRouteLoaderData,
    type ShouldRevalidateFunctionArgs,
} from "react-router";
import typia from "typia";
import { PAGE_CONFIG } from "~/configs/site.config";
import { type RecordWithDataObject, type SiteUIMatch } from "../../../types/site";
import OrgBase from "~/components/opd_views/organizations/OrgBase";
import DataExport from "~/components/opd_views/_shared/DataExport";
import EntityNotFound from "~/components/opd_views/_shared/EntityNotFound";
import { entityFieldsTable } from "~/components/opd_views/_shared/export_helpers";

export const handle = PAGE_CONFIG.NS_ORGANIZATIONS_RESULT_LAYOUT.handle;

export function shouldRevalidate({
    currentParams,
    nextParams,
    defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
    if (currentParams.id === nextParams.id) return false;
    return defaultShouldRevalidate;
}

export default function OrganizationsLayout() {
    const matches = useMatches() as SiteUIMatch[];
    const layoutRouteLoaderData = useRouteLoaderData(
        "routes/layouts/data_dashboard_layout",
    ) as { locs?: { pages?: { person?: { labels?: Record<string, string> } } }; locale?: string } | undefined;

    const data_match = matches.find(
        (it) => it?.handle?.page_key && it?.handle?.is_primary_data_match,
    )?.loaderData;

    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels ?? {};

    // By-id lookup came back empty (or malformed) — unknown organization id.
    if (!typia.is<RecordWithDataObject>(data_match))
        return <EntityNotFound entity="organization" loc={loc} />;
    const organization = (data_match.data as any)?.organization;
    if (!organization) return <EntityNotFound entity="organization" loc={loc} />;

    return (
        <div className="flex flex-1 flex-col gap-4 pt-0">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <OrgBase organization={organization} loc={loc} />
                </div>
                <DataExport
                    filename={`organization-${organization.key}`}
                    tables={[entityFieldsTable(`organization-${organization.key}`, organization as Record<string, unknown>, loc)]}
                    loc={loc}
                    className="shrink-0 data-export-hide"
                />
            </div>
            <Outlet />
        </div>
    );
}
