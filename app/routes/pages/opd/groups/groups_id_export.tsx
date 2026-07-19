// groups_id_export.tsx — RESOURCE ROUTE (loader only). Bulk paginated export of a
// group's list feeds. Same engine as every export (makeExportLoader, person runner).

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import {
    groupContributionsDescriptor, groupMeetingsDescriptor,
    groupMembershipsDescriptor, groupVotingsDescriptor,
} from "~/lib/dimensions/descriptors";
import contributionsSql from "~/server/db/sql/groups/group_contributions_by_id.sql?raw";
import meetingsSql from "~/server/db/sql/groups/group_meetings_by_id.sql?raw";
import membershipsSql from "~/server/db/sql/groups/group_memberships_by_id.sql?raw";
import votingsSql from "~/server/db/sql/groups/group_votings_by_id.sql?raw";

const DATASETS: ExportRegistry = {
    contributions: { sql: contributionsSql, descriptor: groupContributionsDescriptor, resultKey: "contributions" },
    meetings: { sql: meetingsSql, descriptor: groupMeetingsDescriptor, resultKey: "meetings" },
    memberships: { sql: membershipsSql, descriptor: groupMembershipsDescriptor, resultKey: "memberships" },
    votings: { sql: votingsSql, descriptor: groupVotingsDescriptor, resultKey: "votings" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "group" });
