// routes/pages/meetings/meetings_id_overview.tsx
//
// /meetings/:id — the meeting overview (NS_MEETINGS_OVERVIEW). Loads ONE meeting
// + first-5 snippet slices of all SIX feeds + lookups (groups/bodies/persons/
// affairs) via meeting_by_id.sql (runByIdLocalized). Renders <MeetingFull /> then
// a variant="snippet" preview of each non-empty feed. <MeetingBase /> is rendered
// by meetings_result_layout; the Event structured data is emitted as head JSON-LD
// by the leaf route meta(). Mirrors groups_id_overview.tsx.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/meetings_id_overview";
import { useParams } from "react-router";

import meeting_by_id_sql from "~/server/db/sql/meetings/meeting_by_id.sql?raw";
import { runByIdLocalized } from "~/server/db/core";
import {
    type MeetingByIdResponse,
    type MeetingByIdResult,
} from "@/types/opd_client";
import { bodyHref, groupHref } from "~/lib/urls/hrefs";
import { PAGE_CONFIG } from "~/configs/site.config";
import { meetingMeta } from "~/lib/seo/metas";

import { MeetingFull } from "~/components/opd_views/meetings/MeetingFull";
import {
    MeetingAgendas,
    MeetingVotings,
    MeetingSpeeches,
    MeetingDocs,
    MeetingEvents,
    MeetingContributors,
} from "~/components/opd_views/meetings/MeetingFeeds";
import { makeT, AttributionFooter } from "~/components/opd_views/opd_micros";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_MEETINGS_OVERVIEW.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return meetingMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const data = await runByIdLocalized<MeetingByIdResult>(meeting_by_id_sql, {
        id,
        langs: contentLangs(context, params.lang),
    });
    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<MeetingByIdResponse>(data);
    return Response.json({ data });
}

export default function MeetingOverviewPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<MeetingByIdResult> };
    const meeting = data.meeting;

    const { lang } = useParams();
    const { loc, locale } = useDashboardLoc();
    const t = makeT(loc);

    const group = data.groups?.items?.[0];
    const body =
        data.bodies?.items?.find((b) => b.id === meeting.body_id) ??
        data.bodies?.items?.[0];

    const groupLink =
        meeting.group_id != null
            ? groupHref(lang, meeting.group_id)
            : null;
    const bodyLink =
        meeting.body_id != null
            ? bodyHref(lang, meeting.body_id)
            : null;

    const has = (n?: number) => (n ?? 0) > 0;

    return (
        <div className="space-y-6 inset_page_transition">
            <div className="scroll-mt-24">
                <MeetingFull
                    meeting={meeting}
                    group={group}
                    body={body}
                    groupHref={groupLink}
                    bodyHref={bodyLink}
                    loc={loc}
                    locale={locale}
                />
            </div>

            {has(data.agendas?.total_count) ? (
                <div id="agendas" className="scroll-mt-24">
                    <MeetingAgendas agendas={data.agendas} affairs={data.affairs?.items} loc={loc} locale={locale} variant="snippet" />
                </div>
            ) : null}

            {has(data.votings?.total_count) ? (
                <div id="votings" className="scroll-mt-24">
                    <MeetingVotings votings={data.votings} bodies={data.bodies?.items} loc={loc} locale={locale} variant="snippet" />
                </div>
            ) : null}

            {has(data.speeches?.total_count) ? (
                <div id="speeches" className="scroll-mt-24">
                    <MeetingSpeeches speeches={data.speeches} persons={data.persons?.items} bodies={data.bodies?.items} loc={loc} locale={locale} variant="snippet" />
                </div>
            ) : null}

            {has(data.docs?.total_count) ? (
                <div id="docs" className="scroll-mt-24">
                    <MeetingDocs docs={data.docs} loc={loc} locale={locale} variant="snippet" />
                </div>
            ) : null}

            {has(data.events?.total_count) ? (
                <div id="events" className="scroll-mt-24">
                    <MeetingEvents events={data.events} loc={loc} locale={locale} variant="snippet" />
                </div>
            ) : null}

            {has(data.contributors?.total_count) ? (
                <div id="contributors" className="scroll-mt-24">
                    <MeetingContributors contributors={data.contributors} persons={data.persons?.items} affairs={data.affairs?.items} loc={loc} locale={locale} variant="snippet" />
                </div>
            ) : null}

            <AttributionFooter t={t} />
        </div>
    );
}