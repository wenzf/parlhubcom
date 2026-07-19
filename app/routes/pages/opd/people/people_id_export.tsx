// people_id_export.tsx — RESOURCE ROUTE (loader only). Bulk paginated export of a
// person's list feeds. Same engine as every export (makeExportLoader, person runner).
//   GET /:lang?/people/:id/export/:dataset/:format?page=1[&langs=…&<filters>]

import { makeExportLoader, type ExportRegistry } from "~/server/export/export_route.server";
import {
    votesDescriptor, accessBadgesDescriptor, contributorsDescriptor,
    interestsDescriptor, membershipsDescriptor, speechesDescriptor,
} from "~/lib/dimensions/descriptors";
import votesSql from "~/server/db/sql/person/person_votes_by_id.sql?raw";
import accessBadgesSql from "~/server/db/sql/person/person_access_badges_by_id.sql?raw";
import contributorsSql from "~/server/db/sql/person/person_contributors_by_id.sql?raw";
import interestsSql from "~/server/db/sql/person/person_interests_by_id.sql?raw";
import membershipsSql from "~/server/db/sql/person/person_memberships_by_id.sql?raw";
import speechesSql from "~/server/db/sql/person/person_speeches_by_id.sql?raw";

const DATASETS: ExportRegistry = {
    votes: { sql: votesSql, descriptor: votesDescriptor, resultKey: "votes" },
    access_badges: { sql: accessBadgesSql, descriptor: accessBadgesDescriptor, resultKey: "access_badges" },
    contributors: { sql: contributorsSql, descriptor: contributorsDescriptor, resultKey: "contributors" },
    interests: { sql: interestsSql, descriptor: interestsDescriptor, resultKey: "interests" },
    membership_groups: { sql: membershipsSql, descriptor: membershipsDescriptor, resultKey: "membership_groups" },
    speeches: { sql: speechesSql, descriptor: speechesDescriptor, resultKey: "speeches" },
};

export const loader = makeExportLoader(DATASETS, { filePrefix: "person" });
