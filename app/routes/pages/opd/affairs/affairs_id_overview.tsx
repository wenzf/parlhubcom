// routes/affairs_id_overview.tsx
//
// Route module for /affairs/:id — the affair overview (NS_AFFAIRS_OVERVIEW).
// Analogue of the body overview route. Self-contained: loads ONE localized
// affair via affair_by_id.sql (runByIdLocalized) and renders the Legislation
// scope with <AffairBase /> + <AffairFull />.
//
// NOTE FOR REPO WIRING (no route-module template was in the snapshot, so the
// imports below follow the documented loader pattern — reconcile against your
// real bodies_id_overview.tsx):
//   • `./+types/affairs_id_overview` Route types — adjust to your typegen path.
//   • the `?raw` SQL import path + alias.
//   • how you resolve the language priority from the :lang param (resolveLangs
//     placeholder below) — mirror whatever bodies_id_overview.tsx does.
//   • register this module + NS_AFFAIRS_OVERVIEW (absolute_path /affairs/:id) in
//     the route table.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/affairs_id_overview";
import { useParams } from "react-router";

import affair_by_id_sql from "~/server/db/sql/affairs/affair_by_id.sql?raw";
import { runByIdLocalized } from "~/server/db/core";
import {
    type AffairByIdResponse,
    type AffairByIdResult,
} from "@/types/opd_client";
import { bodyHref } from "~/lib/urls/hrefs";
import { PAGE_CONFIG } from "~/configs/site.config";

import { AffairFull } from "~/components/opd_views/affairs/AffairFull";
import { AffairVotings } from "~/components/opd_views/affairs/AffairVotings";
import { AffairContributors } from "~/components/opd_views/affairs/AffairContributors";
import { AffairEvents } from "~/components/opd_views/affairs/AffairEvents";
import { AffairDocs } from "~/components/opd_views/affairs/AffairDocs";
import { AffairTexts } from "~/components/opd_views/affairs/AffairTexts";
import { makeT, AttributionFooter } from "~/components/opd_views/opd_micros";
import { affairMeta } from "~/lib/seo/metas";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_AFFAIRS_OVERVIEW.handle

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any };
    return affairMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params });
}

/** Language priority for loc(). Replace with the shared resolver used by the
 *  body/person overview loaders if one exists. */
export async function loader({ params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const data = await runByIdLocalized<AffairByIdResult>(affair_by_id_sql, {
        id,
        langs: contentLangs(context, params.lang),
    });

    // zero rows -> undefined: surface a 404 the same way the body overview does.
    if (!data) {
        throw new Response("Not Found", { status: 404 });
    }

    typia.assert<AffairByIdResponse>(data);
    return Response.json({ data });
}

export default function AffairOverviewPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<AffairByIdResult> };
    const affair = data.affair;

    const { lang } = useParams();

    // Same loc origin as every other page.
    const { loc, locale } = useDashboardLoc();
    const t = makeT(loc);

    // The affair's linked body (b.id = affair.body_id), resolved by the loader.
    const body =
        data.bodies?.items?.find((b) => b.id === affair.body_id) ??
        data.bodies?.items?.[0];
    const bodyLink = body
        ? bodyHref(lang, body.id)
        : undefined;

    // AffairBase + the schema.org/Legislation scope are owned by the affairs
    // layout (affairs_result_layout); this index renders the affair's profile body
    // plus the activity snippets (newest few, each linking to its full feed).
    const affairId = affair.id;
    const votings = data.votings;
    const contributors = data.contributors;
    const events = data.events;
    const docs = data.docs;
    const texts = data.texts;

    return (
        <div className="space-y-6 inset_page_transition">
            <AffairFull
                affair={affair}
                body={body}
                bodyHref={bodyLink}
                agendas={data.agendas?.items}
                loc={loc}
                locale={locale}
            />

            {/* Activity snippets — hidden when the affair has none. The id anchors back
          the sidebar overview hashes; scroll-mt clears the sticky header. */}
            {votings && votings.total_count > 0 ? (
                <div id="votings" className="scroll-mt-24">
                    <AffairVotings
                        votings={votings}
                        variant="snippet"
                        affairId={affairId}
                        loc={loc}
                        locale={locale}
                    />
                </div>
            ) : null}

            {contributors && contributors.total_count > 0 ? (
                <div id="contributors" className="scroll-mt-24">
                    <AffairContributors
                        contributors={contributors}
                        variant="snippet"
                        affairId={affairId}
                        loc={loc}
                        locale={locale}
                    />
                </div>
            ) : null}

            {events && events.total_count > 0 ? (
                <div id="events" className="scroll-mt-24">
                    <AffairEvents
                        events={events}
                        variant="snippet"
                        affairId={affairId}
                        loc={loc}
                        locale={locale}
                    />
                </div>
            ) : null}

            {docs && docs.total_count > 0 ? (
                <div id="docs" className="scroll-mt-24">
                    <AffairDocs
                        docs={docs}
                        variant="snippet"
                        affairId={affairId}
                        loc={loc}
                        locale={locale}
                    />
                </div>
            ) : null}

            {texts && texts.total_count > 0 ? (
                <div id="texts" className="scroll-mt-24">
                    <AffairTexts
                        texts={texts}
                        variant="snippet"
                        affairId={affairId}
                        loc={loc}
                        locale={locale}
                    />
                </div>
            ) : null}

            <AttributionFooter t={t} />
        </div>
    );
}