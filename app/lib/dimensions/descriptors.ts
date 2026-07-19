// dimension_descriptors.ts
//
// One DimensionDescriptor per dimension. Only `interests` is wired for the
// prototype; the others follow the same shape (copy this block, swap the sorts /
// facets / SQL slot map, keep the slot ORDER in lockstep with the .sql header).
//
// The descriptor is the single source of truth shared by:
//   • <DimensionControls />        (renders the UI from `sorts` / `facets`)
//   • the route loader             (parseRaw → toSqlParams → resolveOrderBy)
//   • the WebMCP tools             (input enums + state read derive from it)
//
// ⚠ `toSqlParams` returns the values for SQL slots $9..$N in EXACT order. That
//    order is mirrored in person_interests_by_id.sql's header. Change one, change
//    both.

import {
    type DimensionDescriptor,
    type RawCriteria,
    boolFacet,
    isoToEpoch,
} from "./filters";

/* --------------------------------- interests ------------------------------ */
//
// SQL slot map (person_interests_by_id.sql):
//   $9  VARCHAR  search term            (NULL = no search)
//   $10 VARCHAR  payment   'paid'|'unpaid'  (NULL = any)
//   $11 BOOLEAN  ex_officio             (NULL = any)
//   $12 INTEGER  body_id                (NULL = any)
//   $13 DOUBLE   begin_date >= (epoch)  (NULL = open lower bound)
//   $14 DOUBLE   begin_date <= (epoch)  (NULL = open upper bound)

export const interestsDescriptor: DimensionDescriptor = {
    dimension: "interests",
    pageParam: "offset",
    defaultSort: { key: "begin_date", dir: "desc" },

    sorts: [
        { key: "begin_date", labelKey: "sort_begin_date", sqlExpr: "begin_date" },
        { key: "end_date", labelKey: "sort_end_date", sqlExpr: "end_date" },
        // localized name — same loc(...) expression used in the SELECT list.
        {
            key: "name",
            labelKey: "sort_name",
            sqlExpr:
                "loc(name_de, name_fr, name_it, NULL, NULL, $2, $3, $4, $5, $6)",
        },
    ],

    facets: [
        {
            kind: "select",
            param: "payment",
            labelKey: "facet_payment",
            allLabelKey: "facet_all",
            options: [
                { value: "paid", labelKey: "interest_paid" },
                { value: "unpaid", labelKey: "interest_unpaid" },
            ],
        },
        {
            kind: "boolean",
            param: "exofficio",
            labelKey: "interest_ex_officio",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        // body options are injected at runtime from the loaded `bodies` (see
        // PersonInterests) — declared empty here and filled by withBodyOptions().
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 5, options: [5, 10, 25, 50] },

    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "varchar", value: c.facets["payment"] ?? null }, // $10 payment
        { type: "boolean", value: boolFacet(c.facets["exofficio"]) }, // $11 ex_officio
        { type: "integer", value: c.facets["body"] ? Number(c.facets["body"]) : null }, // $12 body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $13 begin >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $14 begin <=
    ],
};

/* ----------------------------------- votes -------------------------------- */
//
// Each row is a vote JOINED to its voting (person_votes_by_id.sql flattens the
// voting columns to vt_* before filtering). Search/sort therefore reference the
// voting's title / affair title / date; the vote facet keys off the raw, stable
// `votes.vote` token (values: 'yes' | 'no' — no harmonized column exists).
//
// SQL slot map (person_votes_by_id.sql):
//   $9  VARCHAR  search term   (voting.title / voting.affair_title; NULL = none)
//   $10 VARCHAR  vote 'yes'|'no'                                    (NULL = any)
//   $11 INTEGER  body_id  (the vote's body)                        (NULL = any)
//   $12 DOUBLE   voting.date >= (epoch ms)            (NULL = open lower bound)
//   $13 DOUBLE   voting.date <= (epoch ms)            (NULL = open upper bound)

export const votesDescriptor: DimensionDescriptor = {
    dimension: "votes",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        // voting.date, flattened to vt_date in the query.
        { key: "date", labelKey: "sort_voting_date", sqlExpr: "vt_date" },
        // localized voting title — same loc(...) trio used in the SELECT.
        {
            key: "title",
            labelKey: "sort_voting_title",
            sqlExpr:
                "loc(vt_title_de, vt_title_fr, vt_title_it, NULL, NULL, $2, $3, $4, $5, $6)",
        },
    ],

    facets: [
        {
            kind: "select",
            param: "vote",
            labelKey: "facet_vote",
            allLabelKey: "facet_all",
            options: [
                { value: "yes", labelKey: "vote_yes" },
                { value: "no", labelKey: "vote_no" },
                { value: "abstention", labelKey: "vote_abstention" },
            ],
        },
        // body options injected at runtime from the response `bodies` (withBodyOptions).
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 5, options: [5, 10, 25, 50] },

    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "varchar", value: c.facets["vote"] ?? null }, // $10 vote 'yes'|'no'
        { type: "integer", value: c.facets["body"] ? Number(c.facets["body"]) : null }, // $11 body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $12 date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $13 date <=
    ],
};

/* ------------------------------- alignment -------------------------------- */
//
// Co-voting nearest neighbours. Each row is another member scored by agreement %
// over the ballots the two SHARED. Default order = agreement DESC ("votes most
// alike"); flip dir to ASC for "votes least alike". A `min_shared` floor keeps
// low-overlap pairs (noisy %) out. `party` is an OPEN select — options injected
// at runtime from the response `person_identities`/bodies party set.
//
// SQL slot map (person_alignment_by_id.sql):
//   $9  VARCHAR  search term   (neighbour fullname; NULL = no search)
//   $10 INTEGER  min_shared    (NULL = no floor; defaulted to 20)
//   $11 DOUBLE   voting.date >= epoch ms (NULL = open lower bound)
//   $12 DOUBLE   voting.date <= epoch ms (NULL = open upper bound)
export const alignmentDescriptor: DimensionDescriptor = {
    dimension: "alignment",
    pageParam: "offset",
    defaultSort: { key: "agreement", dir: "desc" },

    sorts: [
        { key: "agreement", labelKey: "sort_agreement", sqlExpr: "agreement" },
        { key: "shared", labelKey: "sort_shared", sqlExpr: "shared" },
        { key: "name", labelKey: "sort_name", sqlExpr: "np_fullname" },
    ],

    facets: [
        // reliability floor: least shared ballots for a pair to rank.
        {
            kind: "select",
            param: "min",
            labelKey: "facet_min_shared",
            allLabelKey: "facet_all",
            options: [
                { value: "10", labelKey: "min_shared_10" },
                { value: "20", labelKey: "min_shared_20" },
                { value: "50", labelKey: "min_shared_50" },
                { value: "100", labelKey: "min_shared_100" },
            ],
        },
        // window over voting.date — re-scopes the shared-ballot set for every pair.
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 10, options: [10, 25, 50, 100] },

    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search (fullname)
        // $10 min_shared — default 20 when unset so noisy low-overlap pairs are hidden.
        { type: "integer", value: c.facets["min"] ? Number(c.facets["min"]) : 20 },
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $11 date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $12 date <=
    ],
};

/* --------------------------------- images --------------------------------- */
//
// Versioned portrait set. NO searchable text (only URL renditions), so
// `searchable: false` hides the search box. valid_from/valid_to are DOUBLE epoch
// ms; `version` is an int; `latest` flags the current version.
//
// SQL slot map (person_images_by_id.sql) — note: no search slot:
//   $9  BOOLEAN  latest  (NULL = any)

export const imagesDescriptor: DimensionDescriptor = {
    dimension: "images",
    pageParam: "offset",
    searchable: false,
    defaultSort: { key: "valid_from", dir: "desc" },

    sorts: [
        { key: "valid_from", labelKey: "sort_valid_from", sqlExpr: "valid_from" },
        { key: "valid_to", labelKey: "sort_valid_to", sqlExpr: "valid_to" },
        { key: "version", labelKey: "sort_version", sqlExpr: "version" },
    ],

    facets: [
        {
            kind: "boolean",
            param: "latest",
            labelKey: "facet_latest",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
    ],

    dateRange: null,

    pageSize: { param: "limit", default: 5, options: [5, 10, 25, 50] },

    toSqlParams: (c) => [
        { type: "boolean", value: boolFacet(c.facets["latest"]) }, // $9 latest
    ],
};

/* ------------------------------ access badges ----------------------------- */
//
// Access badges (the "lobby" dimension): each row is a building-access badge the
// MP GRANTED to a guest (often a lobbyist). Search is over the two plain guest
// columns; the type facet keys off the stable `type_harmonized` code (options are
// injected at runtime via withTypeOptions, since the full code vocabulary is not
// known a priori — only "lobbyist" is documented). valid_from/valid_to are DOUBLE
// epoch ms.
//
// SQL slot map (person_access_badges_by_id.sql):
//   $9  VARCHAR  search  (beneficiary_person_fullname / beneficiary_group)  (NULL = none)
//   $10 VARCHAR  type_harmonized                                            (NULL = any)
//   $11 INTEGER  body_id                                                    (NULL = any)
//   $12 DOUBLE   valid_from >= (epoch ms)                          (NULL = open lower)
//   $13 DOUBLE   valid_from <= (epoch ms)                          (NULL = open upper)

export const accessBadgesDescriptor: DimensionDescriptor = {
    dimension: "access_badges",
    pageParam: "offset",
    defaultSort: { key: "valid_from", dir: "desc" },

    sorts: [
        { key: "valid_from", labelKey: "sort_valid_from", sqlExpr: "valid_from" },
        { key: "valid_to", labelKey: "sort_valid_to", sqlExpr: "valid_to" },
    ],

    facets: [
        // type → stable harmonized code. Options are runtime-injected from the loaded
        // badges (withTypeOptions); empty here = open set so parseRaw keeps the value.
        {
            kind: "select",
            param: "type",
            labelKey: "facet_type",
            allLabelKey: "facet_all",
            options: [],
        },
        // body options injected at runtime from the response `bodies` (withBodyOptions).
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 5, options: [5, 10, 25, 50] },

    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "varchar", value: c.facets["type"] ?? null }, // $10 type_harmonized
        { type: "integer", value: c.facets["body"] ? Number(c.facets["body"]) : null }, // $11 body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $12 valid_from >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $13 valid_from <=
    ],
};

/* ------------------------------ contributors ------------------------------ */
//
// The person's contributions (their roles in affairs / sessions / news). Each row
// is a contributor record; the affair it belongs to is LEFT-JOINED in the SQL and
// flattened to af_* so search and sort can reach the affair's title + metadata.
// Contributions without an affair (session/news/meeting/group rows) survive the
// LEFT JOIN with null af_* — they sort NULLS LAST and don't match an affair-title
// search. Search + sort only (no facets); the date axis is the affair's begin_date.
//
// SQL slot map (person_contributors_by_id.sql):
//   $9  VARCHAR  search  (loc affairs.title / title_long / state_name + plain number)  (NULL = none)

export const contributorsDescriptor: DimensionDescriptor = {
    dimension: "contributors",
    pageParam: "offset",
    defaultSort: { key: "affair_date", dir: "desc" },

    sorts: [
        // affair begin_date (flattened af_begin_date) — the chronological default.
        { key: "affair_date", labelKey: "sort_affair_date", sqlExpr: "af_begin_date" },
        // contributor role, localized (same loc(...) trio used in the SELECT).
        {
            key: "role",
            labelKey: "sort_role",
            sqlExpr:
                "loc(role_harmonized_de, role_harmonized_fr, role_harmonized_it, role_harmonized_rm, role_harmonized_en, $2, $3, $4, $5, $6)",
        },
        // affair type, localized (flattened af_type_harmonized_*).
        {
            key: "affair_type",
            labelKey: "sort_affair_type",
            sqlExpr:
                "loc(af_type_harmonized_de, af_type_harmonized_fr, af_type_harmonized_it, af_type_harmonized_rm, af_type_harmonized_en, $2, $3, $4, $5, $6)",
        },
        // affair number (VARCHAR like "23.456" → lexical sort; fine for modern numbers).
        { key: "affair_number", labelKey: "sort_affair_number", sqlExpr: "af_number" },
    ],

    facets: [],

    dateRange: null,

    pageSize: { param: "limit", default: 5, options: [5, 10, 25, 50] },

    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9 search
    ],
};

/* -------------------------------- speeches -------------------------------- */
//
// Parliamentary speeches. Search is over the transcript (text_content), with its
// XML/HTML markup stripped in SQL so tags never match. The transcript, type, and
// role are localized; the `type` facet keys off the stable `type_external_id` code
// (options runtime-injected, label = localized type_external). `has_video` flags
// rows with a video_url. date_start/date_end are DOUBLE epoch ms.
//
// SQL slot map (person_speeches_by_id.sql):
//   $9  VARCHAR  search   (text_content, tag-stripped, localized)   (NULL = none)
//   $10 VARCHAR  type_external_id                                   (NULL = any)
//   $11 BOOLEAN  has_video  (video_url IS NOT NULL)                 (NULL = any)
//   $12 INTEGER  body_id                                           (NULL = any)
//   $13 DOUBLE   date_start >= (epoch ms)                  (NULL = open lower)
//   $14 DOUBLE   date_start <= (epoch ms)                  (NULL = open upper)

export const speechesDescriptor: DimensionDescriptor = {
    dimension: "speeches",
    pageParam: "offset",
    defaultSort: { key: "date_start", dir: "desc" },

    sorts: [
        { key: "date_start", labelKey: "sort_date_start", sqlExpr: "date_start" },
        { key: "date_end", labelKey: "sort_date_end", sqlExpr: "date_end" },
    ],

    facets: [
        // type → stable type_external_id code; options runtime-injected (withCodeOptions),
        // label = localized type_external.
        {
            kind: "select",
            param: "type",
            labelKey: "facet_type",
            allLabelKey: "facet_all",
            options: [],
        },
        // has video — rows that carry a video_url.
        {
            kind: "boolean",
            param: "video",
            labelKey: "facet_has_video",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        // body options injected at runtime from the response `bodies` (withBodyOptions).
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
        // Search option — match case (tri-state; All/false = case-insensitive).
        // Folds into the $9 regex pattern (no own SQL slot); mirrors the catalogue.
        {
            kind: "boolean",
            param: "case",
            labelKey: "facet_case",
            trueLabelKey: "facet_match_on",
            falseLabelKey: "facet_match_off",
            allLabelKey: "facet_all",
        },
        // Search option — whole word (tri-state; All/false = substring).
        {
            kind: "boolean",
            param: "word",
            labelKey: "facet_word",
            trueLabelKey: "facet_match_on",
            falseLabelKey: "facet_match_off",
            allLabelKey: "facet_all",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 5, options: [5, 10, 25, 50] },

    toSqlParams: (c) => [
        // $9 is now a REGEX PATTERN built from q + the case/word options (see
        // buildTextSearchPattern); person_speeches_by_id.sql matches it with
        // regexp_matches. The case/word booleans fold in here (no own slot).
        { type: "varchar", value: buildTextSearchPattern(c) }, // $9  search regex
        { type: "varchar", value: c.facets["type"] ?? null }, // $10 type_external_id
        { type: "boolean", value: boolFacet(c.facets["video"]) }, // $11 has_video
        { type: "integer", value: c.facets["body"] ? Number(c.facets["body"]) : null }, // $12 body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $13 date_start >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $14 date_start <=
    ],
};

/* ------------------------------- memberships ------------------------------ */
//
// The groups (commissions, factions, committees, delegations …) the person
// belongs/belonged to, COLLECTED BY GROUP. This dimension is the structural
// exception: it paginates by GROUP, not by row, so every sort `sqlExpr` is a
// GROUP-level column computed in the SQL's `mg` rollup (latest_begin / latest_end /
// any_active / group_name), NOT a raw membership column. Row-level filters
// (search / type / active / body / date) are applied in `mem_filtered`; a group is
// kept iff ≥1 of its memberships matches, and total_count counts matching GROUPS.
//
// The `type` facet keys off the stable bare `type_harmonized` code (options
// runtime-injected via withCodeOptions from each role's `type_harmonized_code`,
// label = the localized `type_harmonized`).
//
// SQL slot map (person_memberships_by_id.sql):
//   $9  VARCHAR  search  (group_name / role_name / type_harmonized, localized)  (NULL = none)
//   $10 VARCHAR  type_harmonized (bare code)                                    (NULL = any)
//   $11 BOOLEAN  active                                                         (NULL = any)
//   $12 INTEGER  body_id                                                        (NULL = any)
//   $13 DOUBLE   begin_date >= (epoch ms)                               (NULL = open lower)
//   $14 DOUBLE   begin_date <= (epoch ms)                               (NULL = open upper)

export const membershipsDescriptor: DimensionDescriptor = {
    dimension: "memberships",
    pageParam: "offset",
    defaultSort: { key: "begin", dir: "desc" },

    // All GROUP-level columns (see mg in person_memberships_by_id.sql). The token
    // ORDER BY at mg_lim + m_agg resolves against these.
    sorts: [
        { key: "begin", labelKey: "sort_begin", sqlExpr: "latest_begin" },
        { key: "end", labelKey: "sort_end", sqlExpr: "latest_end" },
        { key: "group_name", labelKey: "sort_group_name", sqlExpr: "group_name" },
        { key: "active", labelKey: "sort_active", sqlExpr: "any_active" },
    ],

    facets: [
        // type → stable bare `type_harmonized` code. Options runtime-injected from the
        // loaded roles (withCodeOptions); empty here = open set so parseRaw keeps the value.
        {
            kind: "select",
            param: "type",
            labelKey: "facet_type",
            allLabelKey: "facet_all",
            options: [],
        },
        // active — group is active if any role is (SQL: any_active / row-level `active`).
        {
            kind: "boolean",
            param: "active",
            labelKey: "facet_active",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        // body options injected at runtime from the response `bodies` (withBodyOptions).
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 5, options: [5, 10, 25, 50] },

    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "varchar", value: c.facets["type"] ?? null }, // $10 type_harmonized (bare code)
        { type: "boolean", value: boolFacet(c.facets["active"]) }, // $11 active
        { type: "integer", value: c.facets["body"] ? Number(c.facets["body"]) : null }, // $12 body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $13 begin_date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $14 begin_date <=
    ],
};

/* --------------------------------- people --------------------------------- */
//
// Top-level DIRECTORY of persons (the people listing page) — the
// `runListPaginatedFiltered` family, NOT person-scoped. The loader binds these with
// filterStartIndex 8, so toSqlParams maps the LIST slots $8..$12 (no $1 person id,
// no sibling widening). Search is over the plain name columns; party + group facets
// filter on STABLE code columns (party_harmonized_wikidata_id /
// parliamentary_group_external_id) with options runtime-injected via withCodeOptions
// (labels localized); body via withBodyOptions; active is a boolean. No date range.
//
// Reused as-is by a future lightweight "front-page name box": link to this route
// with just `?q=…` (no facets) and it hits the same query.
//
// SQL slot map (people_list.sql):
//   $8  VARCHAR  search (fullname / firstname / lastname / city / postal_code)  (NULL = none)
//   $9  VARCHAR  party abbreviation (curated; matched vs harmonized/raw party)  (NULL = any)
//   $10 VARCHAR  parliamentary_group_external_id                     (NULL = any)
//   $11 INTEGER  body_id                                             (NULL = any)
//   $12 BOOLEAN  active                                              (NULL = any)
//   $13 VARCHAR  gender                                              (NULL = any)
//   $14 BOOLEAN  deceased (deathday IS NOT NULL)                     (NULL = any)
//   $15 VARCHAR  country_key (via the person's body; 'CHE' | 'LIE')  (NULL = any)

export const peopleDescriptor: DimensionDescriptor = {
    dimension: "people",
    pageParam: "offset",
    defaultSort: { key: "name", dir: "asc" },

    sorts: [
        { key: "name", labelKey: "sort_name", sqlExpr: "lastname" },
        { key: "firstname", labelKey: "sort_firstname", sqlExpr: "firstname" },
        { key: "active", labelKey: "sort_active", sqlExpr: "active" },
    ],

    facets: [
        // party → sourced at runtime from persons/group_by/parties_harmonized (value =
        // wikidata id, else name). Open set so parseRaw keeps the value in the loader.
        {
            kind: "select",
            param: "party",
            labelKey: "facet_party",
            allLabelKey: "facet_all",
            options: [],
        },
        // parliamentary group filter removed (no stable faction endpoint to source
        // the options from; external_id did not match parliamentary_group_external_id).
        // SQL slot $10 is bound to NULL below to keep people_list.sql unchanged.
        // body / parliament options injected at runtime from the response `bodies`.
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        // active vs former.
        {
            kind: "boolean",
            param: "active",
            labelKey: "facet_active",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        // gender → stable `gender` code (f | m | d). Static, localized via loc keys.
        {
            kind: "select",
            param: "gender",
            labelKey: "facet_gender",
            allLabelKey: "facet_all",
            options: [
                { value: "f", labelKey: "gender_f" },
                { value: "m", labelKey: "gender_m" },
                { value: "d", labelKey: "gender_d" },
            ],
        },
        // deceased — has a deathday (true) vs still living (false).
        {
            kind: "boolean",
            param: "deceased",
            labelKey: "facet_deceased",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        // electoral district → matched against electoral_district_de/fr/it. Sourced from
        // persons/group_by/electoral_districts (value = district name). Open set.
        {
            kind: "select",
            param: "district",
            labelKey: "facet_electoral_district",
            allLabelKey: "facet_all",
            source: "electoral_districts",
            options: [],
        },
        // country → the person's body country_key (matched via `bodies` in SQL). Fixed
        // two-value set: Switzerland (CHE) and Liechtenstein (LIE).
        {
            kind: "select",
            param: "country",
            labelKey: "facet_country",
            allLabelKey: "facet_all",
            options: [
                { value: "CHE", labelKey: "country_che" },
                { value: "LIE", labelKey: "country_lie" },
            ],
        },
    ],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // LIST family: these bind to $8..$14 (the loader passes filterStartIndex 8).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $8  search
        { type: "varchar", value: c.facets["party"] ?? null }, // $9  party abbreviation
        { type: "varchar", value: null }, // $10 group (facet removed; slot kept NULL)
        { type: "integer", value: c.facets["body"] ? Number(c.facets["body"]) : null }, // $11 body_id
        { type: "boolean", value: boolFacet(c.facets["active"]) }, // $12 active
        { type: "varchar", value: c.facets["gender"] ?? null }, // $13 gender
        { type: "boolean", value: boolFacet(c.facets["deceased"]) }, // $14 deceased
        { type: "varchar", value: c.facets["country"] ?? null }, // $15 country_key
        { type: "varchar", value: c.facets["district"] ?? null }, // $16 electoral district
    ],
};

/* ---------------------------------- bodies -------------------------------- */
//
// Top-level bodies catalogue (browse all bodies: parliaments / cantons /
// communal institutions). LIST family — bound to SQL slots $8..$N (the list
// prelude is $1..$7: langs $1..$5, limit $6, offset $7), so the loader passes
// filterStartIndex 8 (runListPaginatedFiltered). Bodies are self-contained, so
// there are no runtime-injected facet options: `type` is sourced client-side
// (full vocabulary), country / has_parliament are static.
//
// SQL slot map (bodies_list.sql):
//   $8  VARCHAR  search  (name / legislative_name / executive_name + canton/body key)  NULL = none
//   $9  VARCHAR  type    (bodies.type code; sourced from `body_types`)                  NULL = any
//   $10 VARCHAR  country_key  ('CHE' | 'LIE')                                           NULL = any
//   $11 BOOLEAN  has_parliament                                                         NULL = any

export const bodiesDescriptor: DimensionDescriptor = {
    dimension: "bodies",
    pageParam: "offset",
    defaultSort: { key: "name", dir: "asc" },

    sorts: [
        // localized display name — LIST family langs are $1..$5 (no person id slot),
        // same loc(...) expression used in bodies_list.sql's SELECT.
        {
            key: "name",
            labelKey: "sort_name",
            sqlExpr:
                "loc(name_de, name_fr, name_it, NULL, name_en, $1, $2, $3, $4, $5)",
        },
        // stable canton code (e.g. "ZH"), a coarse geographic grouping.
        { key: "canton", labelKey: "sort_canton", sqlExpr: "canton_key" },
        // curated display order (lower = higher up; federal/cantonal/communal scale).
        { key: "position", labelKey: "sort_position", sqlExpr: "position" },
        // headcount of the body's constituency, where known.
        { key: "population", labelKey: "sort_population", sqlExpr: "population" },
    ],

    facets: [
        // type → stable `bodies.type` code. Sourced client-side from the full body-type
        // vocabulary (bodies/?indexed=true → distinct type/type_name); the filter VALUE
        // is the code, the LABEL is the localized type_name. Open set (options: []) so
        // the loader keeps the value before the fetch resolves.
        {
            kind: "select",
            param: "type",
            labelKey: "facet_type",
            allLabelKey: "facet_all",
            source: "body_types",
            options: [],
        },
        // country → the body's own country_key (matched directly in SQL). Fixed
        // two-value set: Switzerland (CHE) and Liechtenstein (LIE).
        {
            kind: "select",
            param: "country",
            labelKey: "facet_country",
            allLabelKey: "facet_all",
            options: [
                { value: "CHE", labelKey: "country_che" },
                { value: "LIE", labelKey: "country_lie" },
            ],
        },
        // has_parliament → bodies that have an elected legislative chamber.
        {
            kind: "boolean",
            param: "parliament",
            labelKey: "facet_has_parliament",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
    ],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // LIST family: these bind to $8..$11 (the loader passes filterStartIndex 8).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $8  search
        { type: "varchar", value: c.facets["type"] ?? null }, // $9  type code
        { type: "varchar", value: c.facets["country"] ?? null }, // $10 country_key
        { type: "boolean", value: boolFacet(c.facets["parliament"]) }, // $11 has_parliament
    ],
};

/* ------------------------------ body → people ----------------------------- */
//
// The people linked to ONE body (the /bodies/:id/people dimension), identity-aware
// (primary persons row OR a sibling identity with this body_id). PERSON family:
// $1 is the BODY id (the scope slot), so it runs through
// runPersonPaginatedFiltered (filterStartIndex 9) — the same runner the person
// dimensions use, just with the body id at $1. The body facet is fixed by the
// route (no body dropdown here); the UI offers search + active + gender + sort.
// `dimension: "people"` so the search placeholder/hint loc keys
// (controls_search_*_people) and the person sort labels are reused; the route
// passes namespace="body" to DimensionMcpTools so its tools don't collide with
// the people catalogue's.
//
// SQL slot map (body_people_by_id.sql):
//   $9   VARCHAR  search (fullname / firstname / lastname / city / postal_code)  (NULL = none)
//   $10  BOOLEAN  active (in this body)                                          (NULL = any)
//   $11  VARCHAR  gender                                                         (NULL = any)
//   $12  VARCHAR  party_harmonized_wikidata_id                                   (NULL = any)
//   $13  INTEGER  chamber (groups.id; membership in that chamber group)          (NULL = any)
//
// The `chamber` facet mirrors bodyVotingsDescriptor's: only meaningful for
// multi-chamber bodies (CH federal: NR/SR); options runtime-injected from the
// SQL's `chambers` output and the route DROPS the facet below 2 chambers. Here
// it matches `memberships` (who sits/sat in the chamber), NOT votings.

export const bodyPeopleDescriptor: DimensionDescriptor = {
    dimension: "people",
    pageParam: "offset",
    defaultSort: { key: "name", dir: "asc" },

    sorts: [
        { key: "name", labelKey: "sort_name", sqlExpr: "lastname" },
        { key: "firstname", labelKey: "sort_firstname", sqlExpr: "firstname" },
        { key: "active", labelKey: "sort_active", sqlExpr: "active" },
    ],

    facets: [
        // active vs former — within THIS body (matched on the body claim).
        {
            kind: "boolean",
            param: "active",
            labelKey: "facet_active",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        // gender → stable `gender` code (f | m | d), static + localized via loc keys.
        {
            kind: "select",
            param: "gender",
            labelKey: "facet_gender",
            allLabelKey: "facet_all",
            options: [
                { value: "f", labelKey: "gender_f" },
                { value: "m", labelKey: "gender_m" },
                { value: "d", labelKey: "gender_d" },
            ],
        },
        // party — auto-sourced by the `party` param convention (FULL vocabulary from
        // the API, not just parties on the current page). Value = stable
        // party_harmonized_wikidata_id; matched on the body claim in SQL.
        {
            kind: "select",
            param: "party",
            labelKey: "facet_party",
            allLabelKey: "facet_all",
            options: [],
        },
        // Chamber — stable value = the chamber's group id; options runtime-injected
        // (withCodeOptions) from the loaded `chambers` list. Matches memberships.
        {
            kind: "select",
            param: "chamber",
            labelKey: "facet_chamber",
            allLabelKey: "facet_all",
            options: [],
        },
    ],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: these bind to $9..$13 (the loader passes filterStartIndex 9,
    // with $1 = the body id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "boolean", value: boolFacet(c.facets["active"]) }, // $10 active
        { type: "varchar", value: c.facets["gender"] ?? null }, // $11 gender
        { type: "varchar", value: c.facets["party"] ?? null }, // $12 party_harmonized_wikidata_id
        { type: "integer", value: c.facets["chamber"] ? Number(c.facets["chamber"]) : null }, // $13 chamber group_id
    ],
};

/* ----------------------------- body → votings ----------------------------- */
//
// The votings (voting events) held in ONE body (the /bodies/:id/votings dimension):
// votings.body_id = $1. PERSON family: $1 is the BODY id (scope slot), so it runs
// through runPersonPaginatedFiltered (filterStartIndex 9). The voting `type` is
// localized free text (no stable code), so it is NOT a facet — the surface is
// search + date range, sorted by date (default) or title. `dimension: "votings"`
// drives the controls_search_*_votings loc keys; the route passes namespace="body".
//
// SQL slot map (body_votings_by_id.sql):
//   $9   VARCHAR  search (voting title + parent affair title)  (NULL = none)
//   $10  DOUBLE   date >= (epoch ms)                           (NULL = open lower bound)
//   $11  DOUBLE   date <= (epoch ms)                           (NULL = open upper bound)
//   $12  INTEGER  chamber (votings.group_id)                   (NULL = any)
//
// The `chamber` facet is only meaningful for multi-chamber bodies (CH federal:
// Nationalrat/Ständerat); options are runtime-injected from the SQL's `chambers`
// output and the component DROPS the facet when the body has < 2 chambers.

export const bodyVotingsDescriptor: DimensionDescriptor = {
    dimension: "votings",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_voting_date", sqlExpr: "date" },
        // localized title — same loc(...) expression used in the SELECT (langs $2..$6).
        {
            key: "title",
            labelKey: "sort_voting_title",
            sqlExpr:
                "loc(title_de, title_fr, title_it, NULL, NULL, $2, $3, $4, $5, $6)",
        },
    ],

    facets: [
        // Chamber — stable value = the chamber's group id; options runtime-injected
        // (withCodeOptions) from the loaded `chambers` list.
        {
            kind: "select",
            param: "chamber",
            labelKey: "facet_chamber",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: these bind to $9..$12 ($1 = the body id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $10 date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $11 date <=
        { type: "integer", value: c.facets["chamber"] ? Number(c.facets["chamber"]) : null }, // $12 chamber group_id
    ],
};

/* ----------------------------- body → affairs ----------------------------- */
//
// The affairs (parliamentary business) of ONE body (the /bodies/:id/affairs
// dimension): affairs.body_id = $1. PERSON family: $1 is the BODY id (scope slot),
// so it runs through runPersonPaginatedFiltered (filterStartIndex 9). Unlike
// votings, affairs DO have stable harmonized codes, so `type` and `state` are real
// sourced facets (full vocabulary fetched client-side from the affair_types /
// affair_states sources — their values are the *_harmonized_id integers, matching
// the columns filtered below). `dimension: "affairs"` drives the
// controls_search_*_affairs loc keys; the route passes namespace="body".
//
// SQL slot map (body_affairs_by_id.sql):
//   $9   VARCHAR  search (title / number)                       (NULL = none)
//   $10  INTEGER  type_harmonized_id      (source affair_types)  (NULL = any)
//   $11  INTEGER  state_name_harmonized_id (source affair_states)(NULL = any)
//   $12  DOUBLE   begin_date >= (epoch ms)                       (NULL = open lower)
//   $13  DOUBLE   begin_date <= (epoch ms)                       (NULL = open upper)

export const bodyAffairsDescriptor: DimensionDescriptor = {
    dimension: "affairs",
    pageParam: "offset",
    defaultSort: { key: "begin_date", dir: "desc" },

    sorts: [
        { key: "begin_date", labelKey: "sort_affair_date", sqlExpr: "begin_date" },
        // localized title — same loc(...) expression used in the SELECT (langs $2..$6).
        {
            key: "title",
            labelKey: "sort_affair_title",
            sqlExpr:
                "loc(title_de, title_fr, title_it, title_rm, NULL, $2, $3, $4, $5, $6)",
        },
        { key: "number", labelKey: "sort_affair_number", sqlExpr: "number" },
    ],

    facets: [
        // Affair type — stable harmonized code; full vocabulary sourced client-side.
        // Facet value = type_harmonized_id (integer), matching the filtered column.
        {
            kind: "select",
            param: "type",
            labelKey: "facet_type",
            allLabelKey: "facet_all",
            source: "affair_types",
            options: [],
        },
        // Affair state — stable harmonized id; sourced client-side.
        {
            kind: "select",
            param: "state",
            labelKey: "facet_state",
            allLabelKey: "facet_all",
            source: "affair_states",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: these bind to $9..$13 ($1 = the body id). Facet values arrive as
    // strings; the harmonized ids are integers, so coerce (empty → null = "any").
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        {
            type: "integer",
            value: c.facets["type"] != null ? Number(c.facets["type"]) : null,
        }, // $10 type_harmonized_id
        {
            type: "integer",
            value: c.facets["state"] != null ? Number(c.facets["state"]) : null,
        }, // $11 state_name_harmonized_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $12 begin_date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $13 begin_date <=
    ],
};

/** Return a copy of a descriptor with the `body` select's options filled from the
 *  bodies actually present in the response — value is the stable body `id` (the PK
 *  the interests' `body_id` joins on), label is the body's name. Generic enough to
 *  reuse verbatim for every other dimension that exposes a `body` facet. */
export function withBodyOptions(
    descriptor: DimensionDescriptor,
    bodies: { id: number; legislative_name?: string | null; name?: string | null }[],
): DimensionDescriptor {
    const seen = new Map<string, string>();
    for (const b of bodies) {
        if (b.id == null) continue;
        const value = String(b.id);
        if (seen.has(value)) continue;
        seen.set(value, b.legislative_name ?? b.name ?? value);
    }
    const facets = descriptor.facets.map((f) =>
        f.kind === "select" && f.param === "body"
            ? {
                ...f,
                options: [...seen.entries()].map(([value, label]) => ({
                    value,
                    // a concrete label wins over a loc key for body names (data-driven).
                    labelKey: "",
                    label,
                })),
            }
            : f,
    );
    return { ...descriptor, facets } as DimensionDescriptor;
}
/** Fill the `type` select's options at runtime from the loaded access badges.
 *  Mirrors withBodyOptions: the filter VALUE stays the stable `type_harmonized`
 *  code (handoff rule: never facet on a localized display string), while the
 *  LABEL is resolved by the caller (`labelFor`) — which surfaces "lobbyist" as a
 *  localized chip and otherwise falls back to the localized free-text `type`.
 *  Badges with a null/blank `type_harmonized` contribute no option (nothing
 *  stable to filter on). Options are derived from the page slice, so — like the
 *  body facet — they reflect the codes present on the loaded page. */
export function withTypeOptions(
    descriptor: DimensionDescriptor,
    badges: { type_harmonized?: string | null; type?: string | null }[],
    labelFor: (b: { type_harmonized?: string | null; type?: string | null }) => string,
): DimensionDescriptor {
    const seen = new Map<string, string>(); // code → label
    for (const b of badges) {
        const value = b.type_harmonized; // RAW code — must equal the SQL `= $10` value
        if (!value || !value.trim()) continue;
        if (seen.has(value)) continue;
        seen.set(value, labelFor(b));
    }
    const facets = descriptor.facets.map((f) =>
        f.kind === "select" && f.param === "type"
            ? {
                ...f,
                options: [...seen.entries()].map(([value, label]) => ({
                    value,
                    labelKey: "",
                    label,
                })),
            }
            : f,
    );
    return { ...descriptor, facets } as DimensionDescriptor;
}

/** Generic runtime option injector for a select facet whose stable filter VALUE
 *  is a code column and whose LABEL is derived per row (e.g. a localized display
 *  field). Mirrors withBodyOptions/withTypeOptions but parameterized by the facet
 *  `param`, the `codeKey` to read the value from, and a `labelFor` resolver. Rows
 *  with a null/blank code contribute no option. Options reflect the loaded page
 *  slice (same fidelity as the body facet). */
export function withCodeOptions(
    descriptor: DimensionDescriptor,
    param: string,
    rows: Record<string, unknown>[],
    codeKey: string,
    labelFor: (row: Record<string, unknown>) => string,
): DimensionDescriptor {
    const seen = new Map<string, string>(); // code → label
    for (const r of rows) {
        const raw = r[codeKey];
        if (raw == null || String(raw).trim() === "") continue;
        const value = String(raw);
        if (seen.has(value)) continue;
        seen.set(value, labelFor(r));
    }
    const facets = descriptor.facets.map((f) =>
        f.kind === "select" && f.param === param
            ? {
                ...f,
                options: [...seen.entries()].map(([value, label]) => ({
                    value,
                    labelKey: "",
                    label,
                })),
            }
            : f,
    );
    return { ...descriptor, facets } as DimensionDescriptor;
}
// ===========================================================================
// affairsDescriptor — the TOP-LEVEL affairs catalogue (browse all affairs).
// LIST family: bound to SQL slots $8..$13 (prelude $1..$7: langs $1..$5, limit
// $6, offset $7), so the loader passes filterStartIndex 8 (runListPaginatedFiltered).
//
// SQL slot map (affairs_list.sql) — keep IDENTICAL to toSqlParams order:
//   $8  VARCHAR  search (title / title_long localized + number)        NULL = none
//   $9  INTEGER  type_harmonized_id        (sourced `affair_types`)     NULL = any
//   $10 INTEGER  state_name_harmonized_id  (sourced `affair_states`)    NULL = any
//   $11 INTEGER  body_id                   (sourced `bodies` by conv.)  NULL = any
//   $12 DOUBLE   begin_date >=                                          NULL = open
//   $13 DOUBLE   begin_date <=                                          NULL = open
// ===========================================================================
export const affairsDescriptor: DimensionDescriptor = {
    dimension: "affairs",
    pageParam: "offset",
    defaultSort: { key: "begin_date", dir: "desc" },

    sorts: [
        { key: "begin_date", labelKey: "sort_affair_date", sqlExpr: "begin_date" },
        // localized title — LIST family langs are $1..$5 (no person id slot).
        {
            key: "title",
            labelKey: "sort_affair_title",
            sqlExpr:
                "loc(title_de, title_fr, title_it, title_rm, NULL, $1, $2, $3, $4, $5)",
        },
        { key: "number", labelKey: "sort_affair_number", sqlExpr: "number" },
    ],

    facets: [
        // Affair type — stable harmonized id; full vocabulary sourced client-side.
        {
            kind: "select",
            param: "type",
            labelKey: "facet_type",
            allLabelKey: "facet_all",
            source: "affair_types",
            options: [],
        },
        // Affair state — stable harmonized id; sourced client-side.
        {
            kind: "select",
            param: "state",
            labelKey: "facet_state",
            allLabelKey: "facet_all",
            source: "affair_states",
            options: [],
        },
        // Body — auto-sourced by the `body` param convention (full `bodies` list).
        // Value = body id (integer), matched against affairs.body_id.
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // LIST family: bind to $8..$13 (loader passes filterStartIndex 8). Facet values
    // arrive as strings; the harmonized ids / body id are integers → coerce.
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $8  search
        {
            type: "integer",
            value: c.facets["type"] != null ? Number(c.facets["type"]) : null,
        }, // $9  type_harmonized_id
        {
            type: "integer",
            value: c.facets["state"] != null ? Number(c.facets["state"]) : null,
        }, // $10 state_name_harmonized_id
        {
            type: "integer",
            value: c.facets["body"] != null ? Number(c.facets["body"]) : null,
        }, // $11 body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $12 begin_date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $13 begin_date <=
    ],
};

// ===========================================================================
// affairVotingsDescriptor — votings linked to ONE affair (/affairs/:id/votings).
// Mirrors bodyVotingsDescriptor. PERSON family: $1 = the affair id; filters bind
// to $9..$11. Slot order ≡ affair_votings_by_id.sql header.
// ===========================================================================
export const affairVotingsDescriptor: DimensionDescriptor = {
    dimension: "votings",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_voting_date", sqlExpr: "date" },
        {
            key: "title",
            labelKey: "sort_voting_title",
            sqlExpr:
                "loc(title_de, title_fr, title_it, NULL, NULL, $2, $3, $4, $5, $6)",
        },
    ],

    facets: [
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: bind to $9..$11 ($1 = the affair id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $10 date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $11 date <=
    ],
};

// ===========================================================================
// affairContributorsDescriptor — the contributors OF one affair
// (/affairs/:id/contributors). Inverse of the person `contributors` dimension:
// the affair is fixed, the people vary, so sorts/search are contributor-centric
// (not affair-date/type). PERSON family: $1 = the affair id; filters bind to $9.
// Slot order ≡ affair_contributors_by_id.sql header.
// ===========================================================================
export const affairContributorsDescriptor: DimensionDescriptor = {
    dimension: "contributors",
    pageParam: "offset",
    defaultSort: { key: "position", dir: "asc" },

    sorts: [
        // listed order (lower = first); the source's own ordering.
        { key: "position", labelKey: "sort_position", sqlExpr: "position" },
        // contributor surname.
        { key: "name", labelKey: "sort_name", sqlExpr: "lastname" },
        // contributor role, localized (same loc(...) used in the SELECT).
        {
            key: "role",
            labelKey: "sort_role",
            sqlExpr:
                "loc(role_harmonized_de, role_harmonized_fr, role_harmonized_it, role_harmonized_rm, role_harmonized_en, $2, $3, $4, $5, $6)",
        },
    ],

    facets: [],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: bind to $9 ($1 = the affair id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9 search
    ],
};

// ===========================================================================
// affairSpeechesDescriptor — speeches given on ONE affair (/affairs/:id/speeches).
// Mirrors speechesDescriptor (type / has-video / body / date-range facets). The
// `type` options are injected at runtime (withCodeOptions) and `body` from the
// response bodies (withBodyOptions). PERSON family: $1 = the affair id; filters
// bind to $9..$14. Slot order ≡ affair_speeches_by_id.sql header.
// ===========================================================================
export const affairSpeechesDescriptor: DimensionDescriptor = {
    dimension: "speeches",
    pageParam: "offset",
    defaultSort: { key: "date_start", dir: "desc" },

    sorts: [
        { key: "date_start", labelKey: "sort_date_start", sqlExpr: "date_start" },
        { key: "date_end", labelKey: "sort_date_end", sqlExpr: "date_end" },
    ],

    facets: [
        {
            kind: "select",
            param: "type",
            labelKey: "facet_type",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "boolean",
            param: "video",
            labelKey: "facet_has_video",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: bind to $9..$14 ($1 = the affair id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "varchar", value: c.facets["type"] ?? null }, // $10 type_external_id
        { type: "boolean", value: boolFacet(c.facets["video"]) }, // $11 has_video
        { type: "integer", value: c.facets["body"] ? Number(c.facets["body"]) : null }, // $12 body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $13 date_start >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $14 date_start <=
    ],
};

// ===========================================================================
// affairDocsDescriptor — documents attached to ONE affair (/affairs/:id/docs).
// `category` options injected at runtime from the page's category_harmonized
// codes (label = localized category); `format` from the format codes. No date
// range (docs.date is SQL DATE, not epoch). PERSON family: $1 = the affair id;
// filters bind to $9..$11. Slot order ≡ affair_docs_by_id.sql header.
// ===========================================================================
export const affairDocsDescriptor: DimensionDescriptor = {
    dimension: "docs",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_date_start", sqlExpr: "date" },
        { key: "name", labelKey: "sort_name", sqlExpr: "name" },
    ],

    facets: [
        {
            kind: "select",
            param: "category",
            labelKey: "facet_category",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "select",
            param: "format",
            labelKey: "facet_format",
            allLabelKey: "facet_all",
            options: [],
        },
    ],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: bind to $9..$11 ($1 = the affair id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "varchar", value: c.facets["category"] ?? null }, // $10 category_harmonized
        { type: "varchar", value: c.facets["format"] ?? null }, // $11 format
    ],
};

// ===========================================================================
// affairTextsDescriptor — texts attached to ONE affair (/affairs/:id/texts).
// `format` options injected at runtime from the page's text_format codes. No
// type facet (localized `type` has no stable code) and no date range
// (texts.text_date is SQL DATE, not epoch). PERSON family: $1 = the affair id;
// filters bind to $9..$10. Slot order ≡ affair_texts_by_id.sql header.
// ===========================================================================
export const affairTextsDescriptor: DimensionDescriptor = {
    dimension: "texts",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },
    sorts: [
        { key: "date", labelKey: "sort_date_start", sqlExpr: "text_date" },
        { key: "type", labelKey: "sort_type", sqlExpr: "type_en" },
    ],
    facets: [
        { kind: "select", param: "format", labelKey: "facet_format", allLabelKey: "facet_all", options: [] },
    ],
    dateRange: null,
    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },
    // PERSON family: bind to $9..$10 ($1 = the affair id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q },                        // $9  search
        { type: "varchar", value: c.facets["format"] ?? null }, // $10 text_format
    ],
};

// ===========================================================================
// bodyDocsDescriptor — documents attached to ONE body (/bodies/:id/docs).
// Same shape as affairDocsDescriptor (scope-agnostic); separate export to keep
// the per-context convention. PERSON family: $1 = the body id; filters $9..$11.
// ===========================================================================
export const bodyDocsDescriptor: DimensionDescriptor = {
    dimension: "docs",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },
    sorts: [
        { key: "date", labelKey: "sort_date_start", sqlExpr: "date" },
        { key: "name", labelKey: "sort_name", sqlExpr: "name" },
    ],
    facets: [
        { kind: "select", param: "category", labelKey: "facet_category", allLabelKey: "facet_all", options: [] },
        { kind: "select", param: "format", labelKey: "facet_format", allLabelKey: "facet_all", options: [] },
    ],
    dateRange: null,
    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },
    toSqlParams: (c) => [
        { type: "varchar", value: c.q },
        { type: "varchar", value: c.facets["category"] ?? null },
        { type: "varchar", value: c.facets["format"] ?? null },
    ],
};

// ===========================================================================
// bodyTextsDescriptor — texts attached to ONE body (/bodies/:id/texts).
// Same shape as affairTextsDescriptor (scope-agnostic); separate export to keep
// the per-context convention. One `format` facet; no type facet (localized
// `type` has no stable code) and no date range (texts.text_date is SQL DATE).
// PERSON family: $1 = the body id; filters $9..$10.
// ===========================================================================
export const bodyTextsDescriptor: DimensionDescriptor = {
    dimension: "texts",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },
    sorts: [
        { key: "date", labelKey: "sort_date_start", sqlExpr: "text_date" },
        { key: "type", labelKey: "sort_type", sqlExpr: "type_en" },
    ],
    facets: [
        { kind: "select", param: "format", labelKey: "facet_format", allLabelKey: "facet_all", options: [] },
    ],
    dateRange: null,
    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },
    toSqlParams: (c) => [
        { type: "varchar", value: c.q },
        { type: "varchar", value: c.facets["format"] ?? null },
    ],
};

// ===========================================================================
// affairEventsDescriptor — lifecycle events of ONE affair (/affairs/:id/events).
// Timeline rows; one actor_type facet (runtime-injected) + search. No date range
// (events.date is SQL DATE). PERSON family: $1 = the affair id; filters $9..$10.
// Slot order ≡ affair_events_by_id.sql header.
// ===========================================================================
export const affairEventsDescriptor: DimensionDescriptor = {
    dimension: "events",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_date_start", sqlExpr: "date" },
        { key: "position", labelKey: "sort_position", sqlExpr: "position" },
    ],

    facets: [
        {
            kind: "select",
            param: "actor_type",
            labelKey: "facet_actor_type",
            allLabelKey: "facet_all",
            options: [],
        },
    ],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: bind to $9..$10 ($1 = the affair id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "varchar", value: c.facets["actor_type"] ?? null }, // $10 actor_type
    ],
};
/* --------------------------- votings (catalogue) -------------------------- */

// votingsDescriptor — the TOP-LEVEL votings catalogue (browse all votings, i.e.
// voting EVENTS — not per-person votes). LIST family: bound to SQL slots $8..$11
// (prelude $1..$7: langs $1..$5, limit $6, offset $7), so the loader passes
// filterStartIndex 8 (runListPaginatedFiltered). Mirrors affairsDescriptor.
//
// SQL slot map (votings_list.sql) — keep IDENTICAL to toSqlParams order:
//   $8  VARCHAR  search (voting title + parent affair title, localized)  NULL = none
//   $9  INTEGER  body_id   (sourced `bodies` by the `body` convention)   NULL = any
//   $10 DOUBLE   date >=                                                 NULL = open
//   $11 DOUBLE   date <=                                                 NULL = open
// The voting `type`/`decision` are localized free-text (no stable code) → no facet.
// `dimension: "votings"` drives the controls_search_*_votings loc keys; the route
// passes namespace="catalog". (Distinct from bodyVotingsDescriptor, the PERSON-
// family feed for /bodies/:id/votings — same dimension string, different context.)
// ===========================================================================
export const votingsDescriptor: DimensionDescriptor = {
    dimension: "votings",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_voting_date", sqlExpr: "date" },
        // localized title — LIST family langs are $1..$5 (no person id slot).
        {
            key: "title",
            labelKey: "sort_voting_title",
            sqlExpr:
                "loc(title_de, title_fr, title_it, NULL, NULL, $1, $2, $3, $4, $5)",
        },
    ],

    facets: [
        // Body — auto-sourced by the `body` param convention (full `bodies` list,
        // grouped by position). Value = body id (integer), matched on votings.body_id.
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // LIST family: bind to $8..$11 (loader passes filterStartIndex 8). Facet values
    // arrive as strings; the body id is an integer → coerce.
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $8  search
        {
            type: "integer",
            value: c.facets["body"] != null ? Number(c.facets["body"]) : null,
        }, // $9  body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $10 date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $11 date <=
    ],
};
// ===========================================================================
// texts search — regex pattern builder (shared by the SQL and the client-side
// result highlighter, so the two NEVER disagree). The keyword search supports two
// options exposed as boolean facets on textsDescriptor:
//   • `case` = true  → case-SENSITIVE   (default/All/false → case-insensitive)
//   • `word` = true  → WHOLE-WORD match (default/All/false → substring)
// texts_list.sql matches with regexp_matches($8, <haystack>) where $8 is the
// pattern this builds; the highlighter compiles the EQUIVALENT JS RegExp from the
// same (term, caseSensitive, wholeWord) triple (see buildTextHighlightRegex).
// ===========================================================================

/** Escape a literal string for safe use inside an RE2 / JS regular expression. */
export function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Read the two boolean search options off the criteria (tri-state → bool). */
export function textSearchOptions(c: RawCriteria): {
    caseSensitive: boolean;
    wholeWord: boolean;
} {
    return {
        caseSensitive: c.facets["case"] === "true",
        wholeWord: c.facets["word"] === "true",
    };
}

/** RE2 pattern for texts_list.sql's regexp_matches($8). NULL → search disabled.
 *  The term is escaped (matched literally), optionally fenced with \b…\b for
 *  whole-word, and prefixed with the inline (?i) flag unless case-sensitive.
 *  NOTE: \b is an ASCII word boundary in RE2 (and JS), so 'hanf' will NOT match
 *  inside 'Suchanfrage', which is the intended "unique word" behaviour. */
export function buildTextSearchPattern(c: RawCriteria): string | null {
    if (!c.q) return null;
    const { caseSensitive, wholeWord } = textSearchOptions(c);
    let pat = escapeRegExp(c.q);
    if (wholeWord) pat = `\\b${pat}\\b`;
    if (!caseSensitive) pat = `(?i)${pat}`;
    return pat;
}

/** The equivalent JS RegExp for the client-side highlighter (global, so all
 *  matches are wrapped). Mirrors buildTextSearchPattern exactly. Returns null
 *  when there is no search term (or the term is regex-empty). */
export function buildTextHighlightRegex(c: RawCriteria): RegExp | null {
    if (!c.q) return null;
    const { caseSensitive, wholeWord } = textSearchOptions(c);
    let body = escapeRegExp(c.q);
    if (wholeWord) body = `\\b${body}\\b`;
    try {
        return new RegExp(body, caseSensitive ? "g" : "gi");
    } catch {
        return null;
    }
}

// ===========================================================================
// textsDescriptor — the TOP-LEVEL texts catalogue (browse/search all texts in
// the `texts` table — independent of any affair or body). LIST family: bound to
// SQL slots $8..$11 (prelude $1..$7: langs $1..$5, limit $6, offset $7), so the
// loader passes filterStartIndex 8 (runListPaginatedFiltered). Mirrors
// votingsDescriptor / affairsDescriptor.
//
// SQL slot map (texts_list.sql) — keep IDENTICAL to toSqlParams order:
//   $8  VARCHAR  search REGEX PATTERN (built from q + the case/word options;
//                see buildTextSearchPattern). Matched with regexp_matches over
//                the localized text body + type heading + parent affair title.   NULL = none
//   $9  INTEGER  body_id   (sourced `bodies` by the `body` convention)           NULL = any
//   $10 VARCHAR  text_format code (e.g. 'plain', 'html')                         NULL = any
//   $11 VARCHAR  lang — the DISPLAYED language tag of the row's text
//                (loc_lang(text…) = $11; one of de|fr|it|rm)                     NULL = any
//
// Facets: `body` (sourced), `format` (page-slice via withCodeOptions), `lang`
// (static de|fr|it|rm — filters on the resolved/displayed text language, i.e. the
// `text_lang` the row returns), plus two boolean SEARCH OPTIONS `case` and `word`
// that DON'T own a SQL slot — they only shape the $8 regex pattern. The text
// `type` is localized free-text (no stable code) → NOT a facet; `text_date` is a
// SQL DATE → NO date range. `dimension: "texts"` drives the controls_search_*_texts
// loc keys; the route passes namespace="catalog".
// ===========================================================================
export const textsDescriptor: DimensionDescriptor = {
    dimension: "texts",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_date_start", sqlExpr: "text_date" },
        { key: "type", labelKey: "sort_type", sqlExpr: "type_en" },
    ],

    facets: [
        // Institution — auto-sourced by the `body` param convention (full `bodies`
        // list, grouped by position). Value = body id (integer), matched on texts.body_id.
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        // Format — page-slice options injected at runtime (withCodeOptions).
        {
            kind: "select",
            param: "format",
            labelKey: "facet_format",
            allLabelKey: "facet_all",
            options: [],
        },
        // Language — static set; filters on the DISPLAYED text language (loc_lang),
        // i.e. the `text_lang` each row returns. Endonym labels are language-neutral.
        {
            kind: "select",
            param: "lang",
            labelKey: "facet_lang",
            allLabelKey: "facet_all",
            options: [
                { value: "de", labelKey: "", label: "Deutsch" },
                { value: "fr", labelKey: "", label: "Français" },
                { value: "it", labelKey: "", label: "Italiano" },
                { value: "rm", labelKey: "", label: "Rumantsch" },
            ],
        },
        // Search option — match case (tri-state; All/false = case-insensitive).
        {
            kind: "boolean",
            param: "case",
            labelKey: "facet_case",
            trueLabelKey: "facet_match_on",
            falseLabelKey: "facet_match_off",
            allLabelKey: "facet_all",
        },
        // Search option — whole word (tri-state; All/false = substring).
        {
            kind: "boolean",
            param: "word",
            labelKey: "facet_word",
            trueLabelKey: "facet_match_on",
            falseLabelKey: "facet_match_off",
            allLabelKey: "facet_all",
        },
    ],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // LIST family: bind to $8..$11 (loader passes filterStartIndex 8). The `case`
    // and `word` booleans are folded into the $8 regex pattern (no own slot); the
    // body id is an integer → coerce.
    toSqlParams: (c) => [
        { type: "varchar", value: buildTextSearchPattern(c) }, // $8  search regex
        {
            type: "integer",
            value: c.facets["body"] != null ? Number(c.facets["body"]) : null,
        }, // $9  body_id
        { type: "varchar", value: c.facets["format"] ?? null }, // $10 text_format
        { type: "varchar", value: c.facets["lang"] ?? null }, // $11 text_lang (displayed)
    ],
};

// ===========================================================================
// docsDescriptor — the TOP-LEVEL docs catalogue (browse/search all documents in
// the `docs` table — independent of any affair, body or meeting). LIST family:
// bound to SQL slots $8..$11 (prelude $1..$7: langs $1..$5, limit $6, offset $7),
// so the loader passes filterStartIndex 8 (runListPaginatedFiltered). Mirrors
// textsDescriptor, but with a plain substring search (no case/word regex options)
// exactly like the affair/body docs feeds.
//
// SQL slot map (docs_list.sql) — keep IDENTICAL to toSqlParams order:
//   $8  VARCHAR  search (matched with contains() over the doc name + localized
//                category)                                                    NULL = none
//   $9  INTEGER  body_id  (sourced `bodies` by the `body` convention)         NULL = any
//   $10 VARCHAR  category_harmonized code                                     NULL = any
//   $11 VARCHAR  format code (e.g. 'pdf')                                     NULL = any
//
// Facets: `body` (sourced), `category` (page-slice via withCodeOptions; value =
// category_harmonized, label = localized category), `format` (page-slice). The
// doc `date` is a SQL DATE (not epoch-ms) → NO date-range facet. `dimension:
// "docs"` drives the controls_search_*_docs loc keys; the route passes
// namespace="catalog".
// ===========================================================================
export const docsDescriptor: DimensionDescriptor = {
    dimension: "docs",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_date_start", sqlExpr: "date" },
        { key: "name", labelKey: "sort_name", sqlExpr: "name" },
    ],

    facets: [
        // Institution — auto-sourced by the `body` param convention (full `bodies`
        // list, grouped by position). Value = body id (integer), matched on docs.body_id.
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        // Category — page-slice options injected at runtime (withCodeOptions): value =
        // category_harmonized code, label = localized category.
        {
            kind: "select",
            param: "category",
            labelKey: "facet_category",
            allLabelKey: "facet_all",
            options: [],
        },
        // Format — page-slice options injected at runtime (withCodeOptions).
        {
            kind: "select",
            param: "format",
            labelKey: "facet_format",
            allLabelKey: "facet_all",
            options: [],
        },
    ],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // LIST family: bind to $8..$11 (loader passes filterStartIndex 8). The body id
    // is an integer → coerce.
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $8  search (name + localized category)
        {
            type: "integer",
            value: c.facets["body"] != null ? Number(c.facets["body"]) : null,
        }, // $9  body_id
        { type: "varchar", value: c.facets["category"] ?? null }, // $10 category_harmonized
        { type: "varchar", value: c.facets["format"] ?? null }, // $11 format
    ],
};

// ===========================================================================
// speechesCatalogDescriptor — the TOP-LEVEL speeches catalogue (browse/search
// all speeches in the `speeches` table — independent of any person or affair).
// LIST family: bound to SQL slots $8..$14 (prelude $1..$7), so the loader passes
// filterStartIndex 8 (runListPaginatedFiltered). Reuses the texts search
// machinery (buildTextSearchPattern + the `case`/`word` options + the keyword
// highlighter), so the search options behave identically.
//
// SQL slot map (speeches_list.sql) — keep IDENTICAL to toSqlParams order:
//   $8  VARCHAR  search REGEX PATTERN over tag-stripped transcript + speaker name
//                + parent affair title (built from q + case/word options)     NULL = none
//   $9  INTEGER  body_id   (sourced `bodies` by the `body` convention)        NULL = any
//   $10 VARCHAR  type_external_id code (page-slice via withCodeOptions)        NULL = any
//   $11 BOOLEAN  has video (video_url IS NOT NULL)                             NULL = any
//   $12 VARCHAR  lang — the DISPLAYED transcript language (loc_lang = $12;
//                one of de|fr|it)                                              NULL = any
//   $13 DOUBLE   date_start >= (epoch ms)                                      NULL = open
//   $14 DOUBLE   date_start <= (epoch ms)                                      NULL = open
//
// (Distinct from `speechesDescriptor`, the PERSON-family feed for
// /people/:id/speeches — same dimension string, different context/base slot.)
// `dimension: "speeches"` drives the controls_search_*_speeches loc keys; the
// route passes namespace="catalog".
// ===========================================================================
export const speechesCatalogDescriptor: DimensionDescriptor = {
    dimension: "speeches",
    pageParam: "offset",
    defaultSort: { key: "date_start", dir: "desc" },

    sorts: [
        { key: "date_start", labelKey: "sort_date_start", sqlExpr: "date_start" },
        { key: "date_end", labelKey: "sort_date_end", sqlExpr: "date_end" },
    ],

    facets: [
        // Institution — auto-sourced by the `body` param convention.
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        // Type — stable type_external_id code; options page-slice injected
        // (withCodeOptions), label = localized type_external.
        {
            kind: "select",
            param: "type",
            labelKey: "facet_type",
            allLabelKey: "facet_all",
            options: [],
        },
        // Language — static de|fr|it (the speech transcript has no rm/en variant);
        // filters on the DISPLAYED transcript language (loc_lang = `speech_lang`).
        {
            kind: "select",
            param: "lang",
            labelKey: "facet_lang",
            allLabelKey: "facet_all",
            options: [
                { value: "de", labelKey: "", label: "Deutsch" },
                { value: "fr", labelKey: "", label: "Français" },
                { value: "it", labelKey: "", label: "Italiano" },
            ],
        },
        // Has video — rows that carry a video_url.
        {
            kind: "boolean",
            param: "video",
            labelKey: "facet_has_video",
            trueLabelKey: "facet_match_on",
            falseLabelKey: "facet_match_off",
            allLabelKey: "facet_all",
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
        // Search option — match case (tri-state; All/false = case-insensitive).
        {
            kind: "boolean",
            param: "case",
            labelKey: "facet_case",
            trueLabelKey: "facet_match_on",
            falseLabelKey: "facet_match_off",
            allLabelKey: "facet_all",
        },
        // Search option — whole word (tri-state; All/false = substring).
        {
            kind: "boolean",
            param: "word",
            labelKey: "facet_word",
            trueLabelKey: "facet_match_on",
            falseLabelKey: "facet_match_off",
            allLabelKey: "facet_all",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 10, options: [10, 25, 50] },

    // LIST family: bind to $8..$14 (loader passes filterStartIndex 8). The case/word
    // booleans fold into the $8 regex pattern (no own slot).
    toSqlParams: (c) => [
        { type: "varchar", value: buildTextSearchPattern(c) }, // $8  search regex
        {
            type: "integer",
            value: c.facets["body"] != null ? Number(c.facets["body"]) : null,
        }, // $9  body_id
        { type: "varchar", value: c.facets["type"] ?? null }, // $10 type_external_id
        { type: "boolean", value: boolFacet(c.facets["video"]) }, // $11 has_video
        { type: "varchar", value: c.facets["lang"] ?? null }, // $12 speech_lang (displayed)
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $13 date_start >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $14 date_start <=
    ],
};
// ===========================================================================
// groupsDescriptor — the TOP-LEVEL groups catalogue (browse all groups).
// LIST family: bound to SQL slots $8..$13 (prelude $1..$7: langs $1..$5, limit
// $6, offset $7), so the loader passes filterStartIndex 8 (runListPaginatedFiltered).
// Mirrors affairsDescriptor.
//
// SQL slot map (groups_list.sql) — keep IDENTICAL to toSqlParams order:
//   $8  VARCHAR  search (name / abbreviation / description localized)   NULL = none
//   $9  INTEGER  body_id                  (sourced `bodies` by conv.)    NULL = any
//   $10 INTEGER  type_harmonized_id       (page-slice via withCodeOptions) NULL = any
//   $11 BOOLEAN  active                                                  NULL = any
//   $12 DOUBLE   begin_date >=                                           NULL = open
//   $13 DOUBLE   begin_date <=                                           NULL = open
// ===========================================================================
export const groupsDescriptor: DimensionDescriptor = {
    dimension: "groups",
    pageParam: "offset",
    defaultSort: { key: "begin_date", dir: "desc" },

    sorts: [
        { key: "begin_date", labelKey: "sort_begin_date", sqlExpr: "begin_date" },
        // localized display name — LIST family langs are $1..$5 (no person id slot),
        // same loc(...) expression used in groups_list.sql's SELECT.
        {
            key: "name",
            labelKey: "sort_group_name",
            sqlExpr:
                "loc(name_de, name_fr, name_it, name_rm, NULL, $1, $2, $3, $4, $5)",
        },
        { key: "abbreviation", labelKey: "group_abbreviation", sqlExpr: "abbreviation_de" },
    ],

    facets: [
        // Group type — stable harmonized id; FULL vocabulary sourced from the API
        // (source: "group_types"), so every type is filterable — not just those on
        // the current page. value = type_harmonized_id, label = localized type_harmonized.
        {
            kind: "select",
            param: "type",
            labelKey: "facet_type",
            allLabelKey: "facet_all",
            source: "group_types",
            options: [],
        },
        // Body — auto-sourced by the `body` param convention (full `bodies` list).
        // Value = body id (integer), matched against groups.body_id.
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        // Active — tri-state (All / active / inactive).
        {
            kind: "boolean",
            param: "active",
            labelKey: "facet_active",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // LIST family: bind to $8..$13 (loader passes filterStartIndex 8). Facet values
    // arrive as strings; the body id / harmonized id are integers → coerce.
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $8  search
        {
            type: "integer",
            value: c.facets["body"] != null ? Number(c.facets["body"]) : null,
        }, // $9  body_id
        {
            type: "integer",
            value: c.facets["type"] != null ? Number(c.facets["type"]) : null,
        }, // $10 type_harmonized_id
        { type: "boolean", value: boolFacet(c.facets["active"]) }, // $11 active
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $12 begin_date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $13 begin_date <=
    ],
};

// ===========================================================================
// groupContributionsDescriptor — the contributions OF one group
// (/groups/:id/contributions). Inverse of the person `contributors` dimension:
// the group is fixed, the people vary, so sorts/search are contributor-centric.
// PERSON family: $1 = the group id; filters bind to $9. Slot order ≡
// group_contributions_by_id.sql header. Mirrors affairContributorsDescriptor.
// ===========================================================================
export const groupContributionsDescriptor: DimensionDescriptor = {
    dimension: "contributors",
    pageParam: "offset",
    defaultSort: { key: "position", dir: "asc" },

    sorts: [
        { key: "position", labelKey: "sort_position", sqlExpr: "position" },
        { key: "name", labelKey: "sort_name", sqlExpr: "lastname" },
        {
            key: "role",
            labelKey: "sort_role",
            sqlExpr:
                "loc(role_harmonized_de, role_harmonized_fr, role_harmonized_it, role_harmonized_rm, role_harmonized_en, $2, $3, $4, $5, $6)",
        },
    ],

    facets: [],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: bind to $9 ($1 = the group id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9 search
    ],
};

// ===========================================================================
// groupMeetingsDescriptor — the meetings OF one group (/groups/:id/meetings).
// PERSON family: $1 = the group id; filters bind to $9..$11. Slot order ≡
// group_meetings_by_id.sql header.
// ===========================================================================
export const groupMeetingsDescriptor: DimensionDescriptor = {
    dimension: "meetings",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_begin_date", sqlExpr: "begin_date" },
        {
            key: "name",
            labelKey: "sort_name",
            sqlExpr:
                "loc(name_de, name_fr, name_it, name_rm, NULL, $2, $3, $4, $5, $6)",
        },
    ],

    facets: [
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: bind to $9..$11 ($1 = the group id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $10 begin_date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $11 begin_date <=
    ],
};

// ===========================================================================
// groupMembershipsDescriptor — the memberships OF one group
// (/groups/:id/memberships). PERSON family: $1 = the group id; filters bind to
// $9..$11. Slot order ≡ group_memberships_by_id.sql header.
// ===========================================================================
export const groupMembershipsDescriptor: DimensionDescriptor = {
    dimension: "memberships",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_begin_date", sqlExpr: "begin_date" },
        { key: "name", labelKey: "sort_name", sqlExpr: "person_fullname" },
    ],

    facets: [
        // Active — tri-state (All / active / former) on membership.active.
        {
            kind: "boolean",
            param: "active",
            labelKey: "facet_active",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        // Party — auto-sourced by the `party` param convention (FULL vocabulary from
        // the API). value = party_harmonized_wikidata_id (else name), matched in SQL.
        {
            kind: "select",
            param: "party",
            labelKey: "facet_party",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: bind to $9..$13 ($1 = the group id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $10 begin_date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $11 begin_date <=
        { type: "boolean", value: boolFacet(c.facets["active"]) }, // $12 active
        { type: "varchar", value: c.facets["party"] ?? null }, // $13 party
    ],
};

// ===========================================================================
// groupVotingsDescriptor — the votings OF one group (/groups/:id/votings).
// Mirrors bodyVotingsDescriptor. PERSON family: $1 = the group id; filters bind
// to $9..$11. Slot order ≡ group_votings_by_id.sql header.
// ===========================================================================
export const groupVotingsDescriptor: DimensionDescriptor = {
    dimension: "votings",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },

    sorts: [
        { key: "date", labelKey: "sort_voting_date", sqlExpr: "date" },
        {
            key: "title",
            labelKey: "sort_voting_title",
            sqlExpr:
                "loc(title_de, title_fr, title_it, NULL, NULL, $2, $3, $4, $5, $6)",
        },
    ],

    facets: [
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // PERSON family: bind to $9..$11 ($1 = the group id).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $10 date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $11 date <=
    ],
};

// ===========================================================================
// interestsCatalogDescriptor — the TOP-LEVEL interests catalogue (browse/search
// ALL declared interests, independent of any one person). LIST family: bound to
// SQL slots $8..$13 (prelude $1..$7: langs $1..$5, limit $6, offset $7), so the
// loader passes filterStartIndex 8 (runListPaginatedFiltered). Mirrors
// votingsDescriptor. Distinct from `interestsDescriptor` above — the PERSON-
// family feed for /people/:id/interests (same dimension string "interests",
// different context, base $9). Same facet vocabulary as that feed, re-slotted.
//
// SQL slot map (interests_list.sql) — keep IDENTICAL to toSqlParams order:
//   $8  VARCHAR  search (name/short/abbrev/role/group + place, localized)  NULL = none
//   $9  VARCHAR  payment 'paid'|'unpaid' (harmonized classifier)          NULL = any
//   $10 BOOLEAN  ex_officio                                               NULL = any
//   $11 INTEGER  body_id  (granting body; sourced `body` convention)      NULL = any
//   $12 DOUBLE   begin_date >=                                            NULL = open
//   $13 DOUBLE   begin_date <=                                            NULL = open
// The interest `type` is localized free-text (no stable code) → NOT a facet.
// ===========================================================================
export const interestsCatalogDescriptor: DimensionDescriptor = {
    dimension: "interests",
    pageParam: "offset",
    defaultSort: { key: "begin_date", dir: "desc" },

    sorts: [
        { key: "begin_date", labelKey: "sort_begin_date", sqlExpr: "begin_date" },
        { key: "end_date", labelKey: "sort_end_date", sqlExpr: "end_date" },
        // localized name — LIST family langs are $1..$5 (no person id slot).
        {
            key: "name",
            labelKey: "sort_name",
            sqlExpr:
                "loc(name_de, name_fr, name_it, NULL, NULL, $1, $2, $3, $4, $5)",
        },
    ],

    facets: [
        {
            kind: "select",
            param: "payment",
            labelKey: "facet_payment",
            allLabelKey: "facet_all",
            options: [
                { value: "paid", labelKey: "interest_paid" },
                { value: "unpaid", labelKey: "interest_unpaid" },
            ],
        },
        {
            kind: "boolean",
            param: "exofficio",
            labelKey: "interest_ex_officio",
            trueLabelKey: "facet_yes",
            falseLabelKey: "facet_no",
            allLabelKey: "facet_all",
        },
        // Body — auto-sourced by the `body` param convention (full `bodies` list,
        // grouped by position). Value = body id (integer), matched on interests.body_id.
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // LIST family: bind to $8..$13 (loader passes filterStartIndex 8). Facet values
    // arrive as strings; the body id is an integer → coerce.
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $8  search
        { type: "varchar", value: c.facets["payment"] ?? null }, // $9  payment
        { type: "boolean", value: boolFacet(c.facets["exofficio"]) }, // $10 ex_officio
        {
            type: "integer",
            value: c.facets["body"] != null ? Number(c.facets["body"]) : null,
        }, // $11 body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $12 begin >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $13 begin <=
    ],
};


// ===========================================================================
// meetingsCatalogDescriptor — the TOP-LEVEL meetings catalogue (browse/search
// ALL meetings/sessions, independent of any one group or body). LIST family:
// bound to SQL slots $8..$12 (prelude $1..$7: langs $1..$5, limit $6, offset $7),
// so the loader passes filterStartIndex 8 (runListPaginatedFiltered). Mirrors
// votingsDescriptor.
//
// SQL slot map (meetings_list.sql) — keep IDENTICAL to toSqlParams order:
//   $8  VARCHAR  search (name/abbreviation/location/description, localized)  NULL = none
//   $9  INTEGER  group_id  (SOURCED via the `groups` facet source)          NULL = any
//   $10 INTEGER  body_id   (sourced `bodies` by the `body` convention)      NULL = any
//   $11 DOUBLE   begin_date >=                                              NULL = open
//   $12 DOUBLE   begin_date <=                                             NULL = open
//   $13 VARCHAR  time: 'upcoming' | 'past' (vs now())                      NULL = any
// The meeting `type`/`state`/`type_external` are free-text (no stable code) → no facet.
// ===========================================================================
export const meetingsCatalogDescriptor: DimensionDescriptor = {
    dimension: "meetings",
    pageParam: "offset",
    defaultSort: { key: "begin_date", dir: "desc" },

    sorts: [
        { key: "begin_date", labelKey: "sort_begin_date", sqlExpr: "begin_date" },
        { key: "end_date", labelKey: "sort_end_date", sqlExpr: "end_date" },
        {
            key: "name",
            labelKey: "sort_name",
            sqlExpr:
                "loc(name_de, name_fr, name_it, name_rm, NULL, $1, $2, $3, $4, $5)",
        },
    ],

    facets: [
        // Group — SOURCED from the OpenParlData `groups/?indexed=true` endpoint
        // (explicit `source: "groups"`, the same mechanism as the Parliament/body
        // facet on /people). Value = group id (integer), matched on meetings.group_id.
        {
            kind: "select",
            param: "group",
            labelKey: "facet_group",
            allLabelKey: "facet_all",
            source: "groups",
            options: [],
        },
        // Body — auto-sourced by the `body` param convention.
        {
            kind: "select",
            param: "body",
            labelKey: "facet_body",
            allLabelKey: "facet_all",
            options: [],
        },
        // Upcoming vs past — begin_date compared to now() in SQL.
        {
            kind: "select",
            param: "time",
            labelKey: "facet_time",
            allLabelKey: "facet_all",
            options: [
                { value: "upcoming", labelKey: "facet_upcoming" },
                { value: "past", labelKey: "facet_past" },
            ],
        },
        {
            kind: "dateRange",
            fromParam: "from",
            toParam: "to",
            fromLabelKey: "facet_date_from",
            toLabelKey: "facet_date_to",
        },
    ],

    dateRange: { fromParam: "from", toParam: "to" },

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    // LIST family: bind to $8..$13 (loader passes filterStartIndex 8).
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $8  search
        {
            type: "integer",
            value: c.facets["group"] != null ? Number(c.facets["group"]) : null,
        }, // $9  group_id
        {
            type: "integer",
            value: c.facets["body"] != null ? Number(c.facets["body"]) : null,
        }, // $10 body_id
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $11 begin >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $12 begin <=
        { type: "varchar", value: c.facets["time"] ?? null }, // $13 upcoming|past
    ],
};


// ===========================================================================
// Meeting sub-feed descriptors (PERSON family; $1 = the meeting id, filters $9+).
// One per /meetings/:id/<feed>. Each pairs 1:1 with its meeting_<feed>_by_id.sql
// slot map. Kept intentionally lean: search ($9) + a date range where the child
// carries an epoch column. dimension strings reuse existing controls/sort loc keys.
// ===========================================================================
export const meetingAgendasDescriptor: DimensionDescriptor = {
    dimension: "agendas",
    pageParam: "offset",
    defaultSort: { key: "item_date", dir: "desc" },
    sorts: [
        { key: "item_date", labelKey: "sort_begin_date", sqlExpr: "item_date" },
        { key: "item_number", labelKey: "sort_number", sqlExpr: "item_number" },
    ],
    facets: [
        { kind: "dateRange", fromParam: "from", toParam: "to", fromLabelKey: "facet_date_from", toLabelKey: "facet_date_to" },
    ],
    dateRange: { fromParam: "from", toParam: "to" },
    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $10 item_date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $11 item_date <=
    ],
};

export const meetingVotingsDescriptor: DimensionDescriptor = {
    dimension: "votings",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },
    sorts: [
        { key: "date", labelKey: "sort_voting_date", sqlExpr: "date" },
        { key: "title", labelKey: "sort_voting_title", sqlExpr: "loc(title_de, title_fr, title_it, NULL, NULL, $2, $3, $4, $5, $6)" },
    ],
    facets: [
        { kind: "dateRange", fromParam: "from", toParam: "to", fromLabelKey: "facet_date_from", toLabelKey: "facet_date_to" },
    ],
    dateRange: { fromParam: "from", toParam: "to" },
    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $10 date >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $11 date <=
    ],
};

export const meetingSpeechesDescriptor: DimensionDescriptor = {
    dimension: "speeches",
    pageParam: "offset",
    defaultSort: { key: "date_start", dir: "desc" },
    sorts: [
        { key: "date_start", labelKey: "sort_begin_date", sqlExpr: "date_start" },
    ],
    facets: [
        { kind: "dateRange", fromParam: "from", toParam: "to", fromLabelKey: "facet_date_from", toLabelKey: "facet_date_to" },
    ],
    dateRange: { fromParam: "from", toParam: "to" },
    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9  search
        { type: "double", value: isoToEpoch(c.dateFrom, "start") }, // $10 date_start >=
        { type: "double", value: isoToEpoch(c.dateTo, "end") }, // $11 date_start <=
    ],
};

export const meetingDocsDescriptor: DimensionDescriptor = {
    dimension: "docs",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },
    sorts: [
        { key: "date", labelKey: "sort_begin_date", sqlExpr: "date" },
        { key: "name", labelKey: "sort_name", sqlExpr: "name" },
    ],
    facets: [],
    dateRange: null,
    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9 search
    ],
};

export const meetingEventsDescriptor: DimensionDescriptor = {
    dimension: "events",
    pageParam: "offset",
    defaultSort: { key: "date", dir: "desc" },
    sorts: [
        { key: "date", labelKey: "sort_begin_date", sqlExpr: "date" },
    ],
    facets: [],
    dateRange: null,
    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9 search
    ],
};

export const meetingContributorsDescriptor: DimensionDescriptor = {
    dimension: "contributors",
    pageParam: "offset",
    defaultSort: { key: "position", dir: "asc" },
    sorts: [
        { key: "position", labelKey: "sort_position", sqlExpr: "\"position\"" },
        { key: "lastname", labelKey: "sort_name", sqlExpr: "lastname" },
    ],
    facets: [],
    dateRange: null,
    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },
    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $9 search
    ],
};
// ===========================================================================
// organizationsDescriptor — the TOP-LEVEL organizations catalogue (browse/search
// the register-of-interests entries grouped by normalized organization name).
// LIST family: bound to SQL slots $8 (prelude $1..$7: langs $1..$5, limit $6,
// offset $7), so the loader passes filterStartIndex 8 (runListPaginatedFiltered).
// Search only (no facets — organizations are derived aggregates). Sorts reference
// the grouped roll-up columns in organizations_list.sql.
//
// SQL slot map (organizations_list.sql):
//   $8  VARCHAR  search over the organization name  (NULL = none)
// ===========================================================================
export const organizationsDescriptor: DimensionDescriptor = {
    dimension: "organizations",
    pageParam: "offset",
    defaultSort: { key: "members", dir: "desc" },

    sorts: [
        { key: "members", labelKey: "sort_members", sqlExpr: "n_members" },
        { key: "mandates", labelKey: "sort_mandates", sqlExpr: "n_mandates" },
        { key: "name", labelKey: "sort_name", sqlExpr: "name" },
    ],

    facets: [],

    dateRange: null,

    pageSize: { param: "limit", default: 20, options: [20, 50, 100] },

    toSqlParams: (c) => [
        { type: "varchar", value: c.q }, // $8 search
    ],
};