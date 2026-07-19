// routes/pages/organizations/organizations_id_overview.tsx
//
// /organizations/:id — ONE organization's detail (members across chambers). :id is
// base64url(org_key); we decode it and bind the normalized key as a VARCHAR ($1),
// so this can't use runByIdLocalized (integer key) — the query is prepared inline,
// like people_id_overview.tsx. is_primary_data_match → organizations_result_layout
// reads data.organization for <OrgBase/>; this page renders <OrgFull/> (members).

import { contentLangs } from "~/server/content_langs.server";
import { useLoaderData } from "react-router";
import { db } from "~/server/db/core";
import macro_loc_sql from "~/server/db/sql/macro_loc.sql?raw";
import organization_by_id from "~/server/db/sql/organizations/organization_by_id.sql?raw";
import { decodeOrgId } from "~/lib/urls/org_id";
import OrgFull from "~/components/opd_views/organizations/OrgFull";
import { makeEntityNotFoundBoundary } from "~/components/opd_views/_shared/EntityNotFound";
import { PAGE_CONFIG } from "~/configs/site.config";
import type { Route } from "./+types/organizations_id_overview";
import { organizationMeta } from "~/lib/seo/metas";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_ORGANIZATIONS_OVERVIEW.handle;

// Unknown / undecodable :id → the loader's 404 renders "Organization not
// found" inside the chrome (the result layout has no boundary of its own).
export const ErrorBoundary = makeEntityNotFoundBoundary("organization");

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return organizationMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ params, context }: Route.LoaderArgs) {
    const start = performance.now();

    let orgKey: string;
    try {
        orgKey = decodeOrgId(params.id ?? "");
    } catch {
        throw new Response("Not Found", { status: 404 });
    }

    await db.run(macro_loc_sql);
    const prepared = await db.prepare(organization_by_id);
    const l = contentLangs(context, params.lang);
    const langs = Array.from({ length: 5 }, (_, i) => l[i] ?? "");
    prepared.bindVarchar(1, orgKey); // $1 normalized key
    prepared.bindVarchar(2, langs[0]);
    prepared.bindVarchar(3, langs[1]);
    prepared.bindVarchar(4, langs[2]);
    prepared.bindVarchar(5, langs[3]);
    prepared.bindVarchar(6, langs[4]);

    const reader = await prepared.runAndReadAll();
    const rows = reader.getRowObjectsJson() as unknown as any[];
    const data = rows?.length ? rows[0] : null;
    if (!data) throw new Response("Not Found", { status: 404 });

    return Response.json({ data, perf: performance.now() - start });
}

export default function OrganizationOverview() {
    const loaderData = useLoaderData() as { data: any };
    const { loc, locale } = useDashboardLoc();

    return (
        <OrgFull
            organization={loaderData?.data?.organization}
            members={loaderData?.data?.members?.items ?? []}
            loc={loc}
            locale={locale}
        />
    );
}
