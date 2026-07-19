// routes/layouts/interests_result_layout.tsx
//
// Shared layout for the interest detail routes (/interests/:id [+ any future
// feeds]). Loads the interest header (interest + holder + granting body) and
// renders <InterestBase /> once, with the overview (and any feed pages) below
// via <Outlet /> — mirrors groups_result_layout / affairs_result_layout.
//
// An interest is currently a LEAF (no sub-feeds); this layout gives it the same
// family shape as groups so feed routes (e.g. a future /interests/:id/history)
// can be dropped under it without restructuring. The interest's
// schema.org/Organization structured data (holder modelled as an
// OrganizationRole member → Person) is emitted as head JSON-LD by the route
// meta() (metas/interest.ts → jsonld/interest.ts). Like groups_result_layout,
// this layout carries NO PAGE_CONFIG namespace/handle: the section sidebar +
// breadcrumbs are driven by the matched child route (NS_INTERESTS_OVERVIEW).
//
// NOTE FOR REPO WIRING (reconcile against your real groups_result_layout.tsx):
//   • `./+types/interests_result_layout` Route types path + the `?raw` SQL alias.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/interests_result_layout";
import { Outlet } from "react-router";

import interest_by_id_sql from "~/server/db/sql/interests/interest_by_id.sql?raw";
import { runByIdLocalized } from "~/server/db/core";
import {
    type InterestByIdResponse,
    type InterestByIdResult,
} from "@/types/opd_client";

import { InterestBase } from "~/components/opd_views/interests/InterestBase";
import DataExport from "~/components/opd_views/_shared/DataExport";
import { makeEntityNotFoundBoundary } from "~/components/opd_views/_shared/EntityNotFound";
import { entityFieldsTable } from "~/components/opd_views/_shared/export_helpers";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export async function loader({ params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const data = await runByIdLocalized<InterestByIdResult>(interest_by_id_sql, {
        id,
        langs: contentLangs(context, params.lang),
    });
    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<InterestByIdResponse>(data);
    return Response.json({ data });
}

// Unknown :id → the loader's 404 renders "Interest not found" inside the chrome.
export const ErrorBoundary = makeEntityNotFoundBoundary("interest");

export default function InterestsResultLayout({
    loaderData,
}: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<InterestByIdResult> };
    const interest = data.interest;

    // The holder (p.id = interest.person_id) + granting body (b.id = interest.body_id),
    // resolved by the loader for the header.
    const person = data.persons?.items?.[0];
    const body =
        data.bodies?.items?.find((b) => b.id === interest.body_id) ??
        data.bodies?.items?.[0];

    const { loc, locale } = useDashboardLoc();

    return (
        <article className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <InterestBase
                        interest={interest}
                        person={person}
                        body={body}
                        loc={loc}
                        locale={locale}
                    />
                </div>
                <DataExport
                    filename={`interest-${interest.id}`}
                    tables={[entityFieldsTable(`interest-${interest.id}`, interest as unknown as Record<string, unknown>, loc)]}
                    loc={loc}
                    className="shrink-0 data-export-hide"
                />
            </div>
            <Outlet />
        </article>
    );
}
