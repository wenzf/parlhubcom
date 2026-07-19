// routes/pages/votings/votings_id_overview.tsx
//
// Route module for /votings/:id — the voting detail / overview (NS_VOTINGS_OVERVIEW).
// BY-ID family: runByIdLocalized + voting_by_id.sql returns the single localized
// voting plus its body lookup. A voting is a LEAF entity (no sub-feeds), so this
// route renders the whole detail surface itself (VotingBase + VotingFull) — no
// result layout is needed, unlike bodies/affairs.
//
// `handle.is_primary_data_match` is true so the layout/breadcrumbs read
// `data.voting`. The breadcrumb leaf + sidebar subtitle resolve to
// `data.voting.title` (see site.config.ts).
//
// NOTE FOR REPO WIRING (reconcile against your real bodies_id_overview.tsx):
//   • `./+types/votings_id_overview` Route types path + the `?raw` SQL alias.

import { langByParam } from "~/lib/lang";
import { contentLangs } from "~/server/content_langs.server";
import { affairHref, bodyHref } from "~/lib/urls/hrefs";
import type { Route } from "./+types/votings_id_overview";
import { PAGE_CONFIG } from "~/configs/site.config";

import { runByIdLocalized } from "~/server/db/core";
import votingSql from "~/server/db/sql/votings/voting_by_id.sql?raw";
import votingVotesSql from "~/server/db/sql/votings/voting_votes_by_id.sql?raw";
import type { VotingByIdResult } from "@/types/opd_client";
import type { VotingVotesResult } from "@/types/opd_client";
import { useLoaderData, useParams, useRouteLoaderData } from "react-router";

import EntityNotFound from "~/components/opd_views/_shared/EntityNotFound";
import VotingBase from "~/components/opd_views/votings/VotingBase";
import VotingFull from "~/components/opd_views/votings/VotingFull";
import VotingChart from "~/components/opd_views/votings/VotingChart";
import { makeT, AttributionFooter } from "~/components/opd_views/opd_micros";
import { votingMeta } from "~/lib/seo/metas";

export const handle = PAGE_CONFIG.NS_VOTINGS_OVERVIEW.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return votingMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ params, context }: Route.LoaderArgs) {
    const start = performance.now();
    const { lang_code } = langByParam(params.lang);

    // SQL localization priority: page language first, then the standard CH
    // fallbacks. loc() reads up to 5 slots ($2..$6); duplicates are harmless.
    const langs = contentLangs(context, params.lang);

    const id = Number(params.id);

    // Two by-id queries: the voting overview record, and every cast vote (joined
    // to person seat/party) for the <VotingChart />. Run in parallel.
    const [data, votesData] = await Promise.all([
        runByIdLocalized<NonNullable<VotingByIdResult>>(votingSql, { id, langs }),
        runByIdLocalized<NonNullable<VotingVotesResult>>(votingVotesSql, { id, langs }),
    ]);

    return Response.json(
        { data, votesData, perf: performance.now() - start },
        // Unknown voting id → still render (EntityNotFound below), but as a 404.
        { status: data ? 200 : 404 },
    );
}

export default function VotingOverview() {
    const layoutRouteLoaderData = useRouteLoaderData(
        "routes/layouts/data_dashboard_layout",
    );
    const loaderData = useLoaderData();
    const params = useParams();

    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels;
    const locale = layoutRouteLoaderData?.locale ?? (params.lang ? `${params.lang}-CH` : "de-CH");
    const t = makeT(loc ?? {});

    const voting = loaderData?.data?.voting;
    const body = loaderData?.data?.bodies?.items?.[0];
    const chartVotes = loaderData?.votesData?.votes?.items ?? [];
    const legislativeSeats = loaderData?.votesData?.legislative_seats ?? null;

    if (!voting) return <EntityNotFound entity="voting" loc={loc} />;

    // Parent affair + body both have registered overview namespaces → localizedPath.
    const affairLink =
        voting.affair_id != null
            ? affairHref(params.lang, voting.affair_id)
            : null;
    const bodyLink =
        voting.body_id != null
            ? bodyHref(params.lang, voting.body_id)
            : null;

    return (
        <div className="space-y-6 inset_page_transition">
            {/* personal_data anchor — matches the sidebar overview hash "" */}
            <div className="scroll-mt-24 space-y-6">
                <VotingBase voting={voting} body={body} loc={loc} locale={locale} />
                <VotingFull
                    voting={voting}
                    body={body}
                    affairHref={affairLink}
                    bodyHref={bodyLink}
                    loc={loc}
                    locale={locale}
                />
                <VotingChart
                    votes={chartVotes}
                    legislativeSeats={legislativeSeats}
                    title={voting.title}
                    affairTitle={voting.affair_title}
                    sectionIds={{ diagram: "voting-diagram", tally: "voting-tally" }}
                    loc={loc}
                    locale={locale}
                />
            </div>

            <AttributionFooter t={t} />
        </div>
    );
}