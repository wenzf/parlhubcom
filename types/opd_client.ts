// types/opd_client.ts
//
// TypeScript shape of the result returned by person_by_id.sql (and the other
// *_by_id.sql leaf queries).
//
// The query returns exactly one row (or zero rows if no person matches $1).
// Each related entity is a { total_count, items[] } struct whose item type is
// one of the *Client types already defined in opd_db.ts — reused here rather
// than redefined, so this stays in sync with the source types automatically.
//
// Verified field-for-field against person_by_id.sql:
//   • persons             → PersonClient (exact)
//   • membership_groups   → MembershipGroupClient (group blocks, roles nested)
//   • access_badges       → AccessBadgeClient
//   • person_identities   → IdentityClient
//   • person_images       → PersonImage         (no localized fields, so no Client variant)
//   • interests           → InterestClient
//   • contributors        → ContributorClient
//   • votes               → VoteClient + nested `voting`  (see VoteWithVoting)
//   • speeches            → SpeechClient
//   • affairs             → AffairClient
//   • groups              → GroupClient
//   • meetings            → MeetingClient
//   • agendas             → Agenda             (simple schema, no Client variant)
//   • bodies              → BodyClient

import type {
    PersonClient,
    MembershipClient,
    AccessBadgeClient,
    IdentityClient,
    InterestClient,
    ContributorClient,
    VoteClient,
    VotingClient,
    SpeechClient,
    AffairClient,
    GroupClient,
    MeetingClient,
    BodyClient,
    AgendaClient,
    EventClient,
    DocClient,
    TextClient,
    PersonImageClient,
} from "./opd_db";
import type { BodyChamber } from "./opd_paginated_client";

/**
 * A paginated related-entity list.
 *
 * `total_count` is the unpaginated row count for the entity; `items` is capped
 * at the query's per-list limit ($7). `items` is never null — the query
 * COALESCEs an empty match to `[]`.
 *
 * `total_count` is `count(*)` CAST to INTEGER in the query, so it arrives as a
 * JS number. (Without the cast it would be a DuckDB BIGINT, which the driver
 * serializes as a string.)
*/
export interface PaginatedList<T> {
    total_count: number;
    items: T[];
}

/**
 * A vote row with its joined voting dimension embedded.
 *
 * The query LEFT JOINs `votings`, building the `voting` struct inline. On a
 * join miss the struct is still present with all-null fields (DuckDB yields a
 * struct of nulls, not a null struct), so `voting` itself is non-nullable.
 */
export interface VoteWithVoting extends VoteClient {
    voting: VotingClient;
}

/**
 * A membership "group block": one group with every membership the person holds
 * in it, collected across their WHOLE history (not just the current page). The
 * membership queries paginate BY GROUP, so `roles` is the group's complete role
 * timeline. `group_id` is null for memberships with no group (each stays its own
 * block); `group_name` is the row's denormalized name, used when no `group_id`
 * resolves to a record in the response-scoped `groups`.
 *
 * Canonical definition (next to {@link VoteWithVoting}): person_by_id.sql
 * (overview snippet) and person_memberships_by_id.sql (dimension feed) both emit
 * this shape, so both responses use it. opd_paginated_client re-exports it rather
 * than redefining it.
 */
export interface MembershipGroupClient {
    group_id?: number | null;
    group_name?: string | null;
    roles: MembershipClient[];
}

/**
 * One row of person_by_id.sql — a person plus all related data, localized to
 * the requested language priority.
 */
export interface PersonByIdResponse {
    persons: PersonClient;
    membership_groups: PaginatedList<MembershipGroupClient>;
    access_badges: PaginatedList<AccessBadgeClient>;
    person_identities: PaginatedList<IdentityClient>;
    person_images: PaginatedList<PersonImageClient>;
    interests: PaginatedList<InterestClient>;
    contributors: PaginatedList<ContributorClient>;
    votes: PaginatedList<VoteWithVoting>;
    speeches: PaginatedList<SpeechClient>;
    affairs: PaginatedList<AffairClient>;
    groups: PaginatedList<GroupClient>;
    meetings: PaginatedList<MeetingClient>;
    agendas: PaginatedList<AgendaClient>;
    bodies: PaginatedList<BodyClient>;
}

/**
 * One row of body_by_id.sql — a single localized body. Self-contained: a body's
 * overview shows only its own fields, so (unlike PersonByIdResponse) there are no
 * related-entity lists. `body` is the single record (despite no plural, it is one
 * row), or the query yields zero rows when no body matches $1.
 */
export interface BodyByIdResponse {
    body: BodyClient;
    // Overview snippet slices: the newest 5 votings / affairs of this body, each
    // with the FULL total_count. Feed <BodyVotings variant="snippet"> /
    // <BodyAffairs variant="snippet">; the full feeds live at the sub-routes.
    votings: PaginatedList<VotingClient>;
    affairs: PaginatedList<AffairClient>;
    // texts slice — REQUIRES the texts table to be loaded (db.ts).
    texts: PaginatedList<TextClient>;
    // The body's voting chambers (chamber-list rule) with membership seat
    // counts; the overview renders chamber cards only when ≥ 2 (CH federal).
    chambers: BodyChamber[];
}

/** body_by_id.sql result: the matched body, or `undefined` when none matches. */
export type BodyByIdResult = BodyByIdResponse | undefined;

/**
 * One row of voting_by_id.sql — a single localized voting (a voting EVENT).
 * A leaf entity: just the voting plus a `bodies` lookup (its body, b.id =
 * voting.body_id; 0 or 1 item). The parent affair is denormalized on the voting
 * (affair_id + affair_title). Zero rows when no voting matches $1.
 */
export interface VotingByIdResponse {
    voting: VotingClient;
    bodies: PaginatedList<BodyClient>;
}

/** One row of text_by_id.sql — a single localized text (a row of the `texts`
 *  table). A leaf entity: the text + a `bodies` lookup (its institution, b.id =
 *  texts.body_id; 0 or 1 item) + an `affairs` lookup (its parent affair, a.id =
 *  texts.affair_id; 0 or 1 item) for the linked-affair item. Zero rows when no
 *  text matches $1. */
export interface TextByIdResponse {
    text: TextClient;
    bodies: PaginatedList<BodyClient>;
    affairs: PaginatedList<AffairClient>;
}

export type TextByIdResult = TextByIdResponse | undefined;

/** One row of speech_by_id.sql — a single localized speech. A leaf entity: the
 *  speech + FIVE 0/1 lookups for the linked entities (the speaker `persons`, the
 *  `bodies` chamber, the `affairs` affair, the `meetings` meeting, the `agendas`
 *  agenda item). Zero rows when no speech matches $1. */
export interface SpeechByIdResponse {
    speech: SpeechClient;
    persons: PaginatedList<PersonClient>;
    bodies: PaginatedList<BodyClient>;
    affairs: PaginatedList<AffairClient>;
    meetings: PaginatedList<MeetingClient>;
    agendas: PaginatedList<AgendaClient>;
}

export type SpeechByIdResult = SpeechByIdResponse | undefined;

/** One row of doc_by_id.sql — a single localized document (a row of the `docs`
 *  table). A leaf entity: the doc + FOUR 0/1 lookups for the linked entities (the
 *  `bodies` institution b.id = docs.body_id, the `affairs` affair a.id =
 *  docs.affair_id, the `meetings` meeting mt.id = docs.meeting_id, the `agendas`
 *  agenda item ag.id = docs.agenda_id). Zero rows when no doc matches $1. */
export interface DocByIdResponse {
    doc: DocClient;
    bodies: PaginatedList<BodyClient>;
    affairs: PaginatedList<AffairClient>;
    meetings: PaginatedList<MeetingClient>;
    agendas: PaginatedList<AgendaClient>;
}

export type DocByIdResult = DocByIdResponse | undefined;

export type VotingByIdResult = VotingByIdResponse | undefined;

/**
 * One row of meeting_by_id.sql — a single localized meeting (a row of the
 * `meetings` table). Rendered under meetings_result_layout: the meeting + its
 * group (`groups`, g.id = meeting.group_id; 0 or 1) + a `bodies` lookup (the
 * meeting's institution b.id = meeting.body_id, UNION the group's body). Zero
 * rows when no meeting matches $1.
 */
export interface MeetingByIdResponse {
    meeting: MeetingClient;
    // overview snippet slices (first 5 each; full totals) for the embedded feed
    // previews on /meetings/:id.
    agendas: PaginatedList<AgendaClient>;
    votings: PaginatedList<VotingClient>;
    speeches: PaginatedList<SpeechClient>;
    docs: PaginatedList<DocClient>;
    events: PaginatedList<EventClient>;
    contributors: PaginatedList<ContributorClient>;
    // response-scoped lookups: the meeting's group (0/1), the bodies referenced
    // (meeting + group + snippet rows), the speakers/contributors (persons), and
    // the affairs behind the votings/agendas/contributors/docs/events snippets.
    groups: PaginatedList<GroupClient>;
    bodies: PaginatedList<BodyClient>;
    persons: PaginatedList<PersonClient>;
    affairs: PaginatedList<AffairClient>;
}

export type MeetingByIdResult = MeetingByIdResponse | undefined;

/**
 * One row of interest_by_id.sql — a single localized declared interest (a row of
 * the `interests` table). A leaf entity: the interest + its holder (`persons`,
 * p.id = interest.person_id; 0 or 1) + the holder's identity group
 * (`person_identities`, identity_primary_id = interest.person_id) + a `bodies`
 * lookup (the granting body b.id = interest.body_id, UNION the holder's body /
 * identity bodies). Zero rows when no interest matches $1.
 */
export interface InterestByIdResponse {
    interest: InterestClient;
    persons: PaginatedList<PersonClient>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
}

export type InterestByIdResult = InterestByIdResponse | undefined;

/**
 * voting_votes_by_id.sql — every individual vote cast in ONE voting, joined to
 * the voting person for the seat number + party, plus the body's seat total.
 * Feeds <VotingChart />. `party_key` is the stable (language-independent) colour
 * key; `party` is the localized display label. Not paginated (one vote/member).
 */
export interface VotingSeatVote {
    person_id?: number | null;
    fullname?: string | null;
    vote?: string | null;
    vote_display?: string | null;
    party?: string | null;
    party_key?: string | null;
    parliamentary_group?: string | null;
    parliament_seat?: number | null;
    parliament_sector?: string | null;
}

export interface VotingVotesResponse {
    votes: PaginatedList<VotingSeatVote>;
    legislative_seats?: number | null;
}

export type VotingVotesResult = VotingVotesResponse | undefined;

/**
 * One row of affair_by_id.sql — a single localized affair. Self-contained like
 * BodyByIdResponse: the affair overview shows only its own fields, so there are
 * no related-entity lists in this first cut. `affair` is the single record
 * (despite no plural, it is one row), or the query yields zero rows when no
 * affair matches $1. A /affairs/:id/votings feed can be added later, mirroring
 * the body feeds, by adding a `votings` list slice here.
 */
export interface AffairByIdResponse {
    affair: AffairClient;
    // response-scoped lookup: the affair's linked body (b.id = affair.body_id),
    // localized. 0 or 1 item. The overview resolves it to show the body's data.
    bodies: PaginatedList<BodyClient>;
    // agenda items linked to this affair (agendas.item_affair_id = affair.id).
    agendas: PaginatedList<AgendaClient>;
    // overview snippet slices (first 5 each; full totals) for the embedded
    // feed previews. Docs is NOT included here — that table is unloaded
    // (db.ts); the overview injects an empty docs list instead.
    votings: PaginatedList<VotingClient>;
    events: PaginatedList<EventClient>;
    contributors: PaginatedList<ContributorClient>;
    // docs slice — REQUIRES the docs table to be loaded (db.ts).
    docs: PaginatedList<DocClient>;
    // texts slice — REQUIRES the texts table to be loaded (db.ts).
    texts: PaginatedList<TextClient>;
}

export type AffairByIdResult = AffairByIdResponse | undefined;

/**
 * One row of group_by_id.sql — a single localized group (a parliamentary group /
 * faction / committee) plus the overview snippet slices and a response-scoped
 * `bodies` lookup. `group` is the single record (despite no plural, one row), or
 * the query yields zero rows when no group matches $1.
 */
export interface GroupByIdResponse {
    group: GroupClient;
    // overview snippet slices (first 5 each; full totals) for the embedded feed
    // previews on /groups/:id.
    contributions: PaginatedList<ContributorClient>;
    meetings: PaginatedList<MeetingClient>;
    memberships: PaginatedList<MembershipClient>;
    votings: PaginatedList<VotingClient>;
    // response-scoped lookup: the bodies referenced by the group + the snippet
    // rows (b.id = group.body_id / contributor.body_id / meeting.body_id),
    // localized. The overview/layout resolve each row's body by id.
    bodies: PaginatedList<BodyClient>;
    // response-scoped lookup: the affairs behind the contributions snippet
    // (a.id = contributor.affair_id) — each links to /affairs/:id.
    affairs: PaginatedList<AffairClient>;
}

export type GroupByIdResult = GroupByIdResponse | undefined;

/**
 * Convenience type for the query result: the single matched row, or
 * `undefined` when no person matches the requested id.
 */
export type PersonByIdResult = PersonByIdResponse | undefined;
