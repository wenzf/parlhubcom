// ingest/datasets.ts
//
// The dataset registry: which source files map to which DuckDB tables, plus the
// per-table clustering (sortBy) and ART index strategy the importer applies.
// This is IMPORT-TIME configuration only — the running app never reads it (it
// just opens the already-built data.duckdb). Consumed by ingest/run.ts.
//
// File paths are resolved relative to the process CWD, which is the repo root
// (`npm run import` runs from there): the raw data lives in ./ingest/openparldata.

import {
    assertAccessBadge, accessBadgeColumns,
    assertAffair, affairColumns,
    assertAgenda, agendaColumns,
    assertBody, bodyColumns,
    assertContributor, contributorColumns,
    assertDoc, docColumns,
    assertEvent, eventColumns,
    assertExternalLink, externalLinkColumns,
    assertGroup, groupColumns,
    assertIdentity, identityColumns,
    assertInterest, interestColumns,
    assertMeeting, meetingColumns,
    assertMembership, membershipColumns,
    assertPerson, personColumns,
    assertPersonImage, personImageColumns,
    assertSpeech, speechColumns,
    assertText, textColumns,
    assertVote, voteColumns,
    assertVoting, votingColumns,
    assertStopword, stopwordColumns,
} from "../types/opd_db";

export interface Dataset {
    table: string;
    /** A single ndjson(.gz) file, or a folder of them. */
    file: string;
    assertFn: (input: unknown) => unknown;
    columns: Record<string, any>;
    sortBy: string[];
    indexes: string[];
}

// ---------------------------------------------------------------------------
// Index / sort strategy for person_by_id.sql
//
// The query touches each related table in exactly one of two ways:
//
//   (a) Fact tables filtered by the person — access_badges, contributors,
//       interests, memberships, person_identities, person_images, votes.
//       Each is hit as `WHERE <person fk> = $1` plus a matching
//       `count(*) WHERE <person fk> = $1`. These need:
//         • a sort key starting with the person fk, so all of a person's rows
//           sit in a few contiguous row groups (zone-map pruning skips the
//           rest of the table), and
//         • a secondary sort key equal to the list's ORDER BY, so the
//           per-list `... ORDER BY <key> LIMIT $7` reads the first $7 rows of
//           that block with no re-sort, and
//         • an ART index on the person fk to back the point lookups.
//
//   (b) Dimension tables joined by primary key — affairs, bodies, groups,
//       meetings, votings. These are probed as `... = <dim>.id`, so they only
//       need an `id` index.
//
// Indexes that no longer appear: the previous config indexed several columns
// this query never filters on (contributors.group_id / meeting_id / body_id /
// affair_id, interests.body_id, memberships.group_id / body_id,
// person_identities.body_id, votes.voting_id). Each ART index is rebuilt on
// every import and costs build time + memory, so they are dropped here.
//
// ⚠ If ANOTHER query filters on one of those columns, re-add it for that
//   query's sake — the list below is tuned for person_by_id.sql specifically.
// ---------------------------------------------------------------------------

export const datasets: Dataset[] = [
    // ── Fact tables: person fk first in sortBy, list-order key second ──────────
    { table: "access_badges", file: "ingest/openparldata/access_badges.ndjson.gz", assertFn: assertAccessBadge, columns: accessBadgeColumns, sortBy: ["person_id", "valid_from DESC NULLS LAST"], indexes: ["person_id"] },
    { table: "contributors", file: "ingest/openparldata/contributors.ndjson.gz", assertFn: assertContributor, columns: contributorColumns, sortBy: ["person_id", "id DESC"], indexes: ["person_id"] },
    { table: "interests", file: "ingest/openparldata/interests.ndjson.gz", assertFn: assertInterest, columns: interestColumns, sortBy: ["person_id", "begin_date DESC NULLS LAST"], indexes: ["person_id"] },
    { table: "memberships", file: "ingest/openparldata/memberships.ndjson.gz", assertFn: assertMembership, columns: membershipColumns, sortBy: ["person_id", "begin_date DESC NULLS LAST"], indexes: ["person_id"] },
    { table: "person_identities", file: "ingest/openparldata/person_identities.ndjson.gz", assertFn: assertIdentity, columns: identityColumns, sortBy: ["identity_primary_id", "id"], indexes: ["identity_primary_id"] },
    { table: "person_images", file: "ingest/openparldata/person_images.ndjson.gz", assertFn: assertPersonImage, columns: personImageColumns, sortBy: ["person_id", "id"], indexes: ["person_id"] },
    { table: "votes", file: "ingest/openparldata/votes.ndjson.gz", assertFn: assertVote, columns: voteColumns, sortBy: ["person_id", "id DESC"], indexes: ["person_id"] },

    // ── Dimension tables: probed by primary key only ──────────────────────────
    { table: "affairs", file: "ingest/openparldata/affairs.ndjson.gz", assertFn: assertAffair, columns: affairColumns, sortBy: ["id"], indexes: ["id"] },
    { table: "bodies", file: "ingest/openparldata/bodies.ndjson.gz", assertFn: assertBody, columns: bodyColumns, sortBy: [], indexes: ["id"] },
    { table: "groups", file: "ingest/openparldata/groups.ndjson.gz", assertFn: assertGroup, columns: groupColumns, sortBy: [], indexes: ["id"] },
    { table: "meetings", file: "ingest/openparldata/meetings.ndjson.gz", assertFn: assertMeeting, columns: meetingColumns, sortBy: [], indexes: ["id"] },
    { table: "persons", file: "ingest/openparldata/persons.ndjson.gz", assertFn: assertPerson, columns: personColumns, sortBy: [], indexes: ["id"] },
    { table: "votings", file: "ingest/openparldata/votings.ndjson.gz", assertFn: assertVoting, columns: votingColumns, sortBy: [], indexes: ["id"] },

    // ── agendas: single file, now joined by person_by_id.sql (agendas.id = speeches.agenda_id)
    { table: "agendas", file: "ingest/openparldata/agendas.ndjson.gz", assertFn: assertAgenda, columns: agendaColumns, sortBy: ["id"], indexes: ["id"] },

    // ── Not referenced by person_by_id.sql (kept as-is, no tuning applied) ─────
    { table: "events", file: "ingest/openparldata/events.ndjson.gz", assertFn: assertEvent, columns: eventColumns, sortBy: [], indexes: [] },
    { table: "external_links", file: "ingest/openparldata/external_links.ndjson.gz", assertFn: assertExternalLink, columns: externalLinkColumns, sortBy: [], indexes: [] },

    // ── Folder datasets: `file` is a directory of *.ndjson(.gz) parts ─────────
    //    The importer expands each folder to all its ndjson files and loads them
    //    into the one table.
    //    speeches is filtered by person_id and paged by date_start DESC in
    //    person_by_id.sql → cluster on (person_id, date_start) + person_id index.
    { table: "speeches", file: "ingest/openparldata/speeches", assertFn: assertSpeech, columns: speechColumns, sortBy: ["person_id", "date_start DESC NULLS LAST"], indexes: ["person_id"] },
    { table: "docs", file: "ingest/openparldata/docs", assertFn: assertDoc, columns: docColumns, sortBy: [], indexes: [] },
    { table: "texts", file: "ingest/openparldata/texts", assertFn: assertText, columns: textColumns, sortBy: [], indexes: [] },
    // Ships with the repo (not part of the openparldata download / bucket).
    { table: "stopwords", file: "ingest/stopwords", assertFn: assertStopword, columns: stopwordColumns, sortBy: ["lang", "word"], indexes: ["word"] },
];
