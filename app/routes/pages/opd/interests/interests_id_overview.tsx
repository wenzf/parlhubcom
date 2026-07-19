// routes/pages/interests/interests_id_overview.tsx
//
// Route module for /interests/:id — the interest overview (NS_INTERESTS_OVERVIEW).
// Loads ONE localized interest + its holder (persons, 0/1) + the holder's
// identity group (person_identities) + a bodies lookup (granting body ∪ holder
// chamber(s)) via interest_by_id.sql (runByIdLocalized) and renders
// <InterestFull />. <InterestBase /> is rendered by the interests layout
// (interests_result_layout); the Organization structured data is emitted as head
// JSON-LD by the leaf route meta(). Mirrors groups_id_overview.tsx.
//
// `handle.is_primary_data_match` is true so the layout/breadcrumbs read
// `data.interest` (leaf label + sidebar subtitle → `data.interest.name`).
//
// NOTE FOR REPO WIRING (reconcile against your real groups_id_overview.tsx):
//   • `./+types/interests_id_overview` Route types path + the `?raw` SQL alias.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/interests_id_overview";
import { useParams } from "react-router";

import interest_by_id_sql from "~/server/db/sql/interests/interest_by_id.sql?raw";
import { runByIdLocalized } from "~/server/db/core";
import {
    type InterestByIdResponse,
    type InterestByIdResult,
} from "@/types/opd_client";
import { bodyHref, peopleHref } from "~/lib/urls/hrefs";
import { PAGE_CONFIG } from "~/configs/site.config";

import { InterestFull } from "~/components/opd_views/interests/InterestFull";
import { interestMeta } from "~/lib/seo/metas";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_INTERESTS_OVERVIEW.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return interestMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}

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

export default function InterestOverviewPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<InterestByIdResult> };
    const interest = data.interest;

    const { lang } = useParams();
    const { loc, locale } = useDashboardLoc();

    // The holder (p.id = interest.person_id) + granting body (b.id = interest.body_id).
    const person = data.persons?.items?.[0];
    const body =
        data.bodies?.items?.find((b) => b.id === interest.body_id) ??
        data.bodies?.items?.[0];

    // Both have registered overview namespaces → localizedPath.
    const personHref =
        interest.person_id != null
            ? peopleHref(lang, interest.person_id)
            : null;
    const bodyLink =
        interest.body_id != null
            ? bodyHref(lang, interest.body_id)
            : null;

    return (
        <div className="space-y-6 inset_page_transition">
            {/* interest_details anchor — matches the sidebar overview hash "" */}
            <div className="scroll-mt-24">
                <InterestFull
                    interest={interest}
                    person={person}
                    body={body}
                    personHref={personHref}
                    bodyHref={bodyLink}
                    loc={loc}
                    locale={locale}
                />
            </div>
        </div>
    );
}