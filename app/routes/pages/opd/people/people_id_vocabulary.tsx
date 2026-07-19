// routes/pages/people/people_id_topics.tsx
//
// /people/:id/vocabulary — word-frequency treemap of a person's speeches.
//
// One localized query (person_topics_by_id.sql via runPersonTopics) returns the
// base block the shared people_result_layout validates + <PersonBase/> renders
// (persons / person_identities / bodies) AND the `topics` word data — same
// single-SQL shape as the other person sub-pages (person_votes_by_id.sql, …).
// The route is is_primary_data_match, so the layout reads data.persons /
// data.person_identities / data.bodies; the treemap reads data.topics.
//
// Default window is the person's whole record; ?from / ?to (ISO) narrow it.

import { contentLangs } from "~/server/content_langs.server";
import * as React from "react";
import { useLoaderData } from "react-router";
import type { Route } from "./+types/people_id_vocabulary";
import { runPersonTopics } from "~/server/db/analytics/person_vocabulary";
import { PAGE_CONFIG } from "~/configs/site.config";
import {
    PersonTopics,
    type PersonTopicsResult,
} from "~/components/opd_views/person/PersonTopics";
import { personDimensionMeta } from "~/lib/seo/metas";
import type { PersonClient, IdentityClient, BodyClient } from "@/types/opd_db";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
// Marks this route as the person's primary data match so people_result_layout
// renders <PersonBase/> + <Outlet/> (the loader returns the person base block
// the layout validates).
export const handle = PAGE_CONFIG.NS_PEOPLE_VOCABULARY.handle;


// Rich, data-driven <title>/<meta> for /people/:id/vocabulary (word-frequency).
// No paginated list here, so the description carries no count.
export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as {
        data?: {
            persons?: PersonClient | null;
            person_identities?: { items: IdentityClient[] };
            bodies?: { items: BodyClient[] };
        } | null;
    };
    return personDimensionMeta(ld?.data, "vocabulary", { lang: params.lang, path: location.pathname, matches, params });
}

// Ensure ?from/?to changes refetch even though the layout skips same-id revalidation.
export function shouldRevalidate() {
    return true;
}

/** ISO date → epoch-ms (or null). `end` snaps to end-of-day for inclusive upper bounds. */
function isoToMs(iso: string | null, end = false): number | null {
    if (!iso) return null;
    const ms = Date.parse(end ? `${iso}T23:59:59.999Z` : `${iso}T00:00:00.000Z`);
    return Number.isFinite(ms) ? ms : null;
}

export async function loader({ request, params, context }: Route.LoaderArgs) {

    const start = performance.now()

    const personId = Number(params.id);
    if (!Number.isFinite(personId)) {
        throw new Response("Not Found", { status: 404 });
    }

    const url = new URL(request.url);
    const fromMs = isoToMs(url.searchParams.get("from"));
    const toMs = isoToMs(url.searchParams.get("to"), true);
    const langs = contentLangs(context, params.lang);

    // One query: base block (persons / person_identities / bodies) + topics.
    const data = await runPersonTopics({
        personId,
        langs,
        fromMs,
        toMs,
        asOf: new Date().toISOString().slice(0, 10),
    });
    if (!data) throw new Response("Not Found", { status: 404 });

    // The layout reads data.persons / data.person_identities / data.bodies; the
    // treemap reads data.topics.

    const end = performance.now()

    return Response.json({ data, perf: end - start });
}

export default function PersonTopicsPage() {
    const loaderData = useLoaderData() as
        | { data: Record<string, unknown> & { topics: PersonTopicsResult } }
        | undefined;


    const { loc, locale } = useDashboardLoc();

    const topics = loaderData?.data?.topics;
    if (!topics) return null;

    return <PersonTopics result={topics} loc={loc} locale={locale} />;
}