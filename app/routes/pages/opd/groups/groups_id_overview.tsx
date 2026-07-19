// routes/pages/groups/groups_id_overview.tsx
//
// Route module for /groups/:id — the group overview (NS_GROUPS_OVERVIEW). Loads
// ONE localized group + overview snippet slices (contributions + meetings) +
// a bodies lookup via group_by_id.sql (runByIdLocalized) and renders
// <GroupFull /> plus the snippet embeds. <GroupBase /> + the Organization scope
// are owned by the groups layout (groups_result_layout). Mirrors
// affairs_id_overview.tsx.

import typia from "typia";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/groups_id_overview";
import { useParams } from "react-router";

import group_by_id_sql from "~/server/db/sql/groups/group_by_id.sql?raw";
import { runByIdLocalized } from "~/server/db/core";
import {
    type GroupByIdResponse,
    type GroupByIdResult,
} from "@/types/opd_client";
import { bodyHref } from "~/lib/urls/hrefs";
import { PAGE_CONFIG } from "~/configs/site.config";
import { groupMeta } from "~/lib/seo/metas";

import { GroupFull } from "~/components/opd_views/groups/GroupFull";
import { GroupContributions } from "~/components/opd_views/groups/GroupContributions";
import { GroupMeetings } from "~/components/opd_views/groups/GroupMeetings";
import { GroupMemberships } from "~/components/opd_views/groups/GroupMemberships";
import { GroupVotings } from "~/components/opd_views/groups/GroupVotings";
import { makeT, AttributionFooter } from "~/components/opd_views/opd_micros";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_GROUPS_OVERVIEW.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return groupMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ params, context }: Route.LoaderArgs) {
    const id = Number(params.id);
    const data = await runByIdLocalized<GroupByIdResult>(group_by_id_sql, {
        id,
        langs: contentLangs(context, params.lang),
    });
    if (!data) throw new Response("Not Found", { status: 404 });
    typia.assert<GroupByIdResponse>(data);
    return Response.json({ data });
}

export default function GroupOverviewPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: NonNullable<GroupByIdResult> };
    const group = data.group;

    const { lang } = useParams();
    const { loc, locale } = useDashboardLoc();
    const t = makeT(loc);

    // The group's linked body (b.id = group.body_id), resolved by the loader.
    const body =
        data.bodies?.items?.find((b) => b.id === group.body_id) ??
        data.bodies?.items?.[0];
    const bodyLink = body
        ? bodyHref(lang, body.id)
        : undefined;

    const groupId = group.id;
    const contributions = data.contributions;
    const meetings = data.meetings;
    const memberships = data.memberships;
    const votings = data.votings;
    const bodies = data.bodies?.items;

    return (
        <div className="space-y-6 inset_page_transition">
            <GroupFull
                group={group}
                body={body}
                bodyHref={bodyLink}
                loc={loc}
                locale={locale}
            />

            {/* Activity snippets — hidden when the group has none. The id anchors back
          the sidebar overview hashes; scroll-mt clears the sticky header. */}
            {contributions && contributions.total_count > 0 ? (
                <div id="contributions" className="scroll-mt-24">
                    <GroupContributions
                        contributions={contributions}
                        bodies={bodies}
                        affairs={data.affairs?.items}
                        variant="snippet"
                        groupId={groupId}
                        loc={loc}
                        locale={locale}
                    />
                </div>
            ) : null}

            {meetings && meetings.total_count > 0 ? (
                <div id="meetings" className="scroll-mt-24">
                    <GroupMeetings
                        meetings={meetings}
                        bodies={bodies}
                        variant="snippet"
                        groupId={groupId}
                        loc={loc}
                        locale={locale}
                    />
                </div>
            ) : null}

            {memberships && memberships.total_count > 0 ? (
                <div id="memberships" className="scroll-mt-24">
                    <GroupMemberships
                        memberships={memberships}
                        bodies={bodies}
                        variant="snippet"
                        groupId={groupId}
                        loc={loc}
                        locale={locale}
                    />
                </div>
            ) : null}

            {votings && votings.total_count > 0 ? (
                <div id="votings" className="scroll-mt-24">
                    <GroupVotings
                        votings={votings}
                        bodies={bodies}
                        variant="snippet"
                        groupId={groupId}
                        loc={loc}
                        locale={locale}
                    />
                </div>
            ) : null}

            <AttributionFooter t={t} />
        </div>
    );
}