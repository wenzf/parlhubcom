// types/opd_paginated_client.ts
//
// TypeScript shapes for the paginated "person/route + one related list" queries.
//
//   person_memberships_by_id.sql   → PersonMembershipsResponse
//   person_access_badges_by_id.sql → PersonAccessBadgesResponse
//   person_interests_by_id.sql     → PersonInterestsResponse
//   person_contributors_by_id.sql  → PersonContributorsResponse
//   person_speeches_by_id.sql      → PersonSpeechesResponse
//   person_votes_by_id.sql         → PersonVotesResponse   (votes embed `voting`)
//   person_images_by_id.sql        → PersonImagesResponse  (versioned image set)
//   … plus the top-level list / group / meeting / affair / body feeds.
//
// Built the same way as opd_client.ts: each response is a plain interface reusing
// the *Client types from opd_db.ts so these stay in sync with the source types.
//
// Each query returns exactly one row (or zero rows when nothing matches $1). The
// row is the full record plus paginated `{ total_count, items[] }` lists:
//
//   • total_count is the UNPAGINATED count (count(*) CAST to INTEGER, a JS
//     number), independent of $7/$8.
//   • items is the page slice; never null — the query COALESCEs an empty match
//     to [].

import type {
    PersonClient,
    AccessBadgeClient,
    InterestClient,
    ContributorClient,
    MembershipClient,
    SpeechClient,
    IdentityClient,
    BodyClient,
    AffairClient,
    GroupClient,
    MeetingClient,
    AgendaClient,
    DocClient,
    EventClient,
    TextClient,
    PersonImageClient,
    VotingClient,
} from "./opd_db";

// Re-export the generic helper types + the canonical vote/membership shapes so
// consumers can import everything paginated from one module (same surface as
// before). These live canonically in opd_client.ts.
export type {
    PaginatedList,
    VoteWithVoting,
    MembershipGroupClient,
} from "./opd_client";
import type {
    PaginatedList,
    VoteWithVoting,
    MembershipGroupClient,
} from "./opd_client";

/** person_memberships_by_id.sql — paginated BY GROUP. `membership_groups.items`
 *  is one block per group (each carrying its full role timeline); `total_count`
 *  is the DISTINCT-GROUP count. `groups` is response-scoped: the distinct group
 *  records behind the blocks ON THIS PAGE. */
export interface PersonMembershipsResponse {
    persons: PersonClient;
    membership_groups: PaginatedList<MembershipGroupClient>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
    groups: PaginatedList<GroupClient>;
}

/** person_access_badges_by_id.sql */
export interface PersonAccessBadgesResponse {
    persons: PersonClient;
    access_badges: PaginatedList<AccessBadgeClient>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
}

/** person_interests_by_id.sql */
export interface PersonInterestsResponse {
    persons: PersonClient;
    interests: PaginatedList<InterestClient>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
}

/** person_contributors_by_id.sql — `affairs` / `groups` are response-scoped:
 *  the distinct affairs and groups behind the contributor rows ON THIS PAGE. */
export interface PersonContributorsResponse {
    persons: PersonClient;
    contributors: PaginatedList<ContributorClient>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
    affairs: PaginatedList<AffairClient>;
    groups: PaginatedList<GroupClient>;
}

/** person_speeches_by_id.sql — `affairs` / `meetings` / `agendas` are
 *  response-scoped: the distinct affairs, meetings, and agenda items behind the
 *  speech rows ON THIS PAGE. */
export interface PersonSpeechesResponse {
    persons: PersonClient;
    speeches: PaginatedList<SpeechClient>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
    affairs: PaginatedList<AffairClient>;
    meetings: PaginatedList<MeetingClient>;
    agendas: PaginatedList<AgendaClient>;
}

/** person_votes_by_id.sql — each vote carries its joined `voting` dimension.
 *  affairs / groups / meetings are the distinct votings.affair_id / group_id /
 *  meeting_id behind the votes ON THIS PAGE (response-scoped). */
export interface PersonVotesResponse {
    persons: PersonClient;
    votes: PaginatedList<VoteWithVoting>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
    affairs: PaginatedList<AffairClient>;
    groups: PaginatedList<GroupClient>;
    meetings: PaginatedList<MeetingClient>;
}

/** person_alignment_by_id.sql — co-voting nearest neighbours. Each item is one
 *  other member scored over the ballots the two SHARED: `agreement` (agreed /
 *  shared, 0..1), `shared` (ballots both cast), `agreed` (of those, matches).
 *  `id` = the neighbour's person id (row key). No opd_db source type — this
 *  shape is produced only by the aggregate, so it's declared inline here. */
export interface AlignmentNeighbour {
    id: number;
    person_id: number;
    fullname?: string | null;
    party?: string | null;
    party_key?: string | null;
    parliamentary_group?: string | null;
    shared: number;
    agreed: number;
    agreement: number;
}

export interface PersonAlignmentResponse {
    persons: PersonClient;
    neighbours: PaginatedList<AlignmentNeighbour>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
}

/** person_images_by_id.sql — the person's VERSIONED image set. Each item is a
 *  PersonImageClient (one portrait version). No localized fields, and no
 *  response-scoped lookups — images carry no body_id. */
export interface PersonImagesResponse {
    persons: PersonClient;
    person_images: PaginatedList<PersonImageClient>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
}

/** people_list.sql — top-level person DIRECTORY. `people` is the filtered page
 *  slice + filtered total; `bodies` is response-scoped: the distinct parliaments
 *  behind the page slice. NOT person-scoped — no identities on rows. */
export interface PeopleListResponse {
    people: PaginatedList<PersonClient>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
}

/** bodies_list.sql — top-level body DIRECTORY. Bodies are self-contained, so —
 *  unlike the person/people responses — there are NO response-scoped lookups. */
export interface BodiesListResponse {
    bodies: PaginatedList<BodyClient>;
}

export interface AffairsListResponse {
    affairs: PaginatedList<AffairClient>;
    // response-scoped lookup: the bodies referenced by the page (b.id = affair.body_id)
    bodies: PaginatedList<BodyClient>;
}

/** groups_list.sql — top-level group DIRECTORY. `bodies` is the response-scoped
 *  lookup of the bodies referenced by the page (b.id = group.body_id). */
export interface GroupsListResponse {
    groups: PaginatedList<GroupClient>;
    bodies: PaginatedList<BodyClient>;
}

/** group_contributions_by_id.sql — the contributions of ONE group. */
export interface GroupContributionsResponse {
    group: GroupClient;
    contributions: PaginatedList<ContributorClient>;
    bodies: PaginatedList<BodyClient>;
    // response-scoped lookup: the affairs behind the contributor rows on this page
    // (a.id = contributor.affair_id), localized — each links to /affairs/:id.
    affairs: PaginatedList<AffairClient>;
}

/** group_meetings_by_id.sql — the meetings of ONE group. */
export interface GroupMeetingsResponse {
    group: GroupClient;
    meetings: PaginatedList<MeetingClient>;
    bodies: PaginatedList<BodyClient>;
}

/** group_memberships_by_id.sql — the memberships of ONE group. */
export interface GroupMembershipsResponse {
    group: GroupClient;
    memberships: PaginatedList<MembershipClient>;
    bodies: PaginatedList<BodyClient>;
}

/** group_votings_by_id.sql — the votings of ONE group. */
export interface GroupVotingsResponse {
    group: GroupClient;
    votings: PaginatedList<VotingClient>;
    bodies: PaginatedList<BodyClient>;
}

/** votings_list.sql — the top-level /votings catalogue. */
export interface VotingsListResponse {
    votings: PaginatedList<VotingClient>;
    bodies: PaginatedList<BodyClient>;
}

/** texts_list.sql — the top-level /texts catalogue. */
export interface TextsListResponse {
    texts: PaginatedList<TextClient>;
    bodies: PaginatedList<BodyClient>;
}

/** docs_list.sql — the top-level /docs catalogue. */
export interface DocsListResponse {
    docs: PaginatedList<DocClient>;
    bodies: PaginatedList<BodyClient>;
}

/** speeches_list.sql — the top-level /speeches catalogue. `persons` / `bodies`
 *  are response-scoped lookups of the speakers and chambers. */
export interface SpeechesListResponse {
    speeches: PaginatedList<SpeechClient>;
    bodies: PaginatedList<BodyClient>;
    persons: PaginatedList<PersonClient>;
}

/** meetings_list.sql — the top-level /meetings catalogue. `groups` / `bodies`
 *  are response-scoped lookups. */
export interface MeetingsListResponse {
    meetings: PaginatedList<MeetingClient>;
    groups: PaginatedList<GroupClient>;
    bodies: PaginatedList<BodyClient>;
}

/* ----- /meetings/:id sub-feeds (PERSON family; $1 = meeting id) ----------- */
export interface MeetingAgendasResponse {
    meeting: MeetingClient;
    agendas: PaginatedList<AgendaClient>;
    affairs: PaginatedList<AffairClient>;
}
export interface MeetingVotingsResponse {
    meeting: MeetingClient;
    votings: PaginatedList<VotingClient>;
    bodies: PaginatedList<BodyClient>;
}
export interface MeetingSpeechesResponse {
    meeting: MeetingClient;
    speeches: PaginatedList<SpeechClient>;
    bodies: PaginatedList<BodyClient>;
    persons: PaginatedList<PersonClient>;
}
export interface MeetingDocsResponse {
    meeting: MeetingClient;
    docs: PaginatedList<DocClient>;
}
export interface MeetingEventsResponse {
    meeting: MeetingClient;
    events: PaginatedList<EventClient>;
}
export interface MeetingContributorsResponse {
    meeting: MeetingClient;
    contributors: PaginatedList<ContributorClient>;
    persons: PaginatedList<PersonClient>;
    affairs: PaginatedList<AffairClient>;
}

/** interests_list.sql — the top-level /interests catalogue. `persons` / `bodies`
 *  are response-scoped lookups of the holders and granting bodies. */
export interface InterestsListResponse {
    interests: PaginatedList<InterestClient>;
    persons: PaginatedList<PersonClient>;
    bodies: PaginatedList<BodyClient>;
}

export interface AffairVotingsResponse {
    affair: AffairClient;
    votings: PaginatedList<VotingClient>;
}

export interface AffairContributorsResponse {
    affair: AffairClient;
    contributors: PaginatedList<ContributorClient>;
}

export interface AffairSpeechesResponse {
    affair: AffairClient;
    speeches: PaginatedList<SpeechClient>;
    bodies: PaginatedList<BodyClient>;
    persons: PaginatedList<PersonClient>;
}

export interface AffairDocsResponse {
    affair: AffairClient;
    docs: PaginatedList<DocClient>;
}

export interface AffairTextsResponse {
    affair: AffairClient;
    texts: PaginatedList<TextClient>;
}

export interface AffairEventsResponse {
    affair: AffairClient;
    events: PaginatedList<EventClient>;
}

/** body_people_by_id.sql — the people linked to ONE body (/bodies/:id/people),
 *  identity-aware. Same people / person_identities / bodies triplet as
 *  people_list.sql, PLUS the route `body` itself and a `members` seat list. */
/** A single active member of a body, minimal shape for the seat diagram
 *  (VotingHemicycle in no-vote mode). All chart fields are optional. */
export interface BodyMemberSeat {
    id?: number | null;
    fullname?: string | null;
    party?: string | null;
    party_harmonized_wikidata_id?: string | null;
    parliamentary_group_name?: string | null;
    parliament_seat?: number | null;
    parliament_sector?: string | null;
}

/** A chamber roster entry (body_people_by_id.sql `chamber_members`): one active
 *  member of ONE chamber, resolved via `memberships`. Multi-chamber bodies only. */
export interface BodyChamberMember extends BodyMemberSeat {
    /** The chamber (groups.id) this seat belongs to. */
    chamber_id: number;
}

export interface BodyPeopleResponse {
    body: BodyClient;
    people: PaginatedList<PersonClient>;
    person_identities: PaginatedList<IdentityClient>;
    bodies: PaginatedList<BodyClient>;
    /** Jurisdiction-wide active roster — single-chamber bodies only (else empty). */
    members: PaginatedList<BodyMemberSeat>;
    /** The body's voting chambers (chamber-list rule), with membership seat counts. */
    chambers: BodyChamber[];
    /** Per-chamber active rosters — multi-chamber bodies only (else empty). */
    chamber_members: PaginatedList<BodyChamberMember>;
    /** Active executive councils with active members (CH: Bundesrat · 7). */
    executives: BodyChamber[];
}

/** A voting chamber of a body: an active `council_legislative` group that
 *  appears on votings (CH federal: Nationalrat/Ständerat). Feeds the chamber
 *  facet; < 2 entries means the facet is hidden. body_people_by_id.sql also
 *  fills `seats` (active membership headcount) and reuses this shape for its
 *  `executives` list (there the group is a `council_executive` instead). */
export interface BodyChamber {
    id: number;
    name?: string | null;
    abbreviation?: string | null;
    seats?: number | null;
}

/** body_votings_by_id.sql — the votings held in ONE body (/bodies/:id/votings). */
export interface BodyVotingsResponse {
    body: BodyClient;
    votings: PaginatedList<VotingClient>;
    chambers: BodyChamber[];
}

export interface BodyDocsResponse {
    body: BodyClient;
    docs: PaginatedList<DocClient>;
}

export interface BodyTextsResponse {
    body: BodyClient;
    texts: PaginatedList<TextClient>;
}

/** body_affairs_by_id.sql — the affairs (parliamentary business) of ONE body. */
export interface BodyAffairsResponse {
    body: BodyClient;
    affairs: PaginatedList<AffairClient>;
}

// `undefined` when nothing matches the requested id (zero rows).
export type PersonMembershipsResult = PersonMembershipsResponse | undefined;
export type PersonAccessBadgesResult = PersonAccessBadgesResponse | undefined;
export type PersonInterestsResult = PersonInterestsResponse | undefined;
export type PersonContributorsResult = PersonContributorsResponse | undefined;
export type PersonSpeechesResult = PersonSpeechesResponse | undefined;
export type PersonVotesResult = PersonVotesResponse | undefined;
export type PersonAlignmentResult = PersonAlignmentResponse | undefined;
export type PersonImagesResult = PersonImagesResponse | undefined;

export type PeopleListResult = PeopleListResponse | undefined;
export type BodiesListResult = BodiesListResponse | undefined;
export type AffairsListResult = AffairsListResponse | undefined;
export type GroupsListResult = GroupsListResponse | undefined;
export type GroupContributionsResult = GroupContributionsResponse | undefined;
export type GroupMeetingsResult = GroupMeetingsResponse | undefined;
export type GroupMembershipsResult = GroupMembershipsResponse | undefined;
export type GroupVotingsResult = GroupVotingsResponse | undefined;
export type VotingsListResult = VotingsListResponse | undefined;
export type TextsListResult = TextsListResponse | undefined;
export type DocsListResult = DocsListResponse | undefined;
export type SpeechesListResult = SpeechesListResponse | undefined;
export type MeetingsListResult = MeetingsListResponse | undefined;
export type MeetingAgendasResult = MeetingAgendasResponse | undefined;
export type MeetingVotingsResult = MeetingVotingsResponse | undefined;
export type MeetingSpeechesResult = MeetingSpeechesResponse | undefined;
export type MeetingDocsResult = MeetingDocsResponse | undefined;
export type MeetingEventsResult = MeetingEventsResponse | undefined;
export type MeetingContributorsResult = MeetingContributorsResponse | undefined;
export type InterestsListResult = InterestsListResponse | undefined;
export type AffairVotingsResult = AffairVotingsResponse | undefined;
export type AffairContributorsResult = AffairContributorsResponse | undefined;
export type AffairSpeechesResult = AffairSpeechesResponse | undefined;
export type AffairDocsResult = AffairDocsResponse | undefined;
export type AffairEventsResult = AffairEventsResponse | undefined;
export type AffairTextsResult = AffairTextsResponse | undefined;
export type BodyPeopleResult = BodyPeopleResponse | undefined;
export type BodyVotingsResult = BodyVotingsResponse | undefined;
export type BodyDocsResult = BodyDocsResponse | undefined;
export type BodyTextsResult = BodyTextsResponse | undefined;
export type BodyAffairsResult = BodyAffairsResponse | undefined;
