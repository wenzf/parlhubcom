-- ============================================================================
-- group_contributions_by_id.sql
--
-- Paginated, localized feed of the CONTRIBUTIONS recorded on ONE group:
-- contributors.group_id = $1. Each item is a contributor (a person in a role on
-- this group): name, role, party, plus the contribution's own body (resolved via
-- the response-scoped `bodies` lookup, b.id = contributors.body_id — which, for a
-- group's contributions, is the group's body). PERSON family ($1 = the group id
-- at the scope slot → runPersonPaginatedFiltered). No identity widening (the
-- scope is a group, not a person identity). Also returns the single localized
-- `group` (breadcrumb / sidebar subtitle / base header). Requires macro_loc.sql.
--
-- Parameters
--   $1     INTEGER  - the group id (scope; contributors.group_id = $1)
--   $2..$6 VARCHAR  - language priority codes
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror groupContributionsDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (fullname + lastname + localized role)  NULL = none
--   ORDER BY at c_lim + c_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   group         STRUCT  the single localized group. ZERO rows → undefined.
--   contributions STRUCT { total_count, items }  PaginatedList<ContributorClient>.
--   bodies        STRUCT { total_count, items }  PaginatedList<BodyClient> lookup
--                 (b.id = contributors.body_id of the page slice).
--   affairs       STRUCT { total_count, items }  PaginatedList<AffairClient> lookup
--                 (a.id = contributors.affair_id of the page slice; links to /affairs/:id).
-- ============================================================================

WITH
c_filtered AS (
    SELECT * FROM contributors c
    WHERE c.group_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(c.fullname, '')), lower($9))
            OR contains(lower(coalesce(c.lastname, '')), lower($9))
            OR contains(lower(coalesce(loc(c.role_harmonized_de, c.role_harmonized_fr, c.role_harmonized_it, c.role_harmonized_rm, c.role_harmonized_en, $2, $3, $4, $5, $6), '')), lower($9)))
),
c_lim AS (
    SELECT * FROM c_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
c_agg AS (
    SELECT
        (SELECT count(*) FROM c_filtered) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            affair_id:           affair_id,
            news_id:             news_id,
            person_id:           person_id,
            group_id:            group_id,
            meeting_id:          meeting_id,
            session_id:          session_id,
            "type":              type,
            role_external_id:    role_external_id,
            firstname:           firstname,
            lastname:            lastname,
            fullname:            fullname,
            party_wikidata_id:   party_wikidata_id,
            "position":          position,
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            role:             loc(role_de,             role_fr,             role_it,             role_rm,            NULL,               $2, $3, $4, $5, $6),
            role_harmonized:  loc(role_harmonized_de,  role_harmonized_fr,  role_harmonized_it,  role_harmonized_rm, role_harmonized_en, $2, $3, $4, $5, $6),
            party:            loc(party_de,            party_fr,            party_it,            party_rm,           NULL,               $2, $3, $4, $5, $6),
            party_harmonized: loc(party_harmonized_de, party_harmonized_fr, party_harmonized_it, NULL,               NULL,               $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM c_lim
),
-- The single route group (breadcrumb / sidebar subtitle / base header; langs $2..$6).
grp AS (
    SELECT
        {
            id:                        id,
            body_id:                   body_id,
            body_key:                  body_key,
            external_id:               external_id,
            external_alternative_id:   external_alternative_id,
            type_harmonized_id:        type_harmonized_id,
            type_harmonized_position:  type_harmonized_position,
            type_harmonized_wikidata_id: type_harmonized_wikidata_id,
            active:                    active,
            type_external_id:          type_external_id,
            begin_date:                begin_date,
            end_date:                  end_date,
            wikidata_id:               wikidata_id,
            parent_group_external_id:  parent_group_external_id,
            child_group_external_id:   child_group_external_id,
            parent_council_external_id: parent_council_external_id,
            contact:                   contact,
            created_at:                created_at,
            updated_at:                updated_at,
            updated_external_at:       updated_external_at,
            name:            loc(name_de,            name_fr,            name_it,            name_rm,            NULL,               $2, $3, $4, $5, $6),
            abbreviation:    loc(abbreviation_de,    abbreviation_fr,    abbreviation_it,    abbreviation_rm,    NULL,               $2, $3, $4, $5, $6),
            description:     loc(description_de,     description_fr,     description_it,     description_rm,     NULL,               $2, $3, $4, $5, $6),
            type_harmonized: loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $2, $3, $4, $5, $6),
            type_external:   loc(type_external_de,   type_external_fr,   type_external_it,   type_external_rm,   NULL,               $2, $3, $4, $5, $6),
            url_external:    loc(url_external_de,    url_external_fr,    url_external_it,    url_external_rm,    NULL,               $2, $3, $4, $5, $6)
        } AS "group"
    FROM groups WHERE id = $1
),
-- Response-scoped body lookup (b.id = contributors.body_id of the page slice).
b_ids AS (
    SELECT DISTINCT body_id AS id FROM c_lim WHERE body_id IS NOT NULL
),
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total
    FROM bodies b
    INNER JOIN b_ids ON b.id = b_ids.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
),
-- Response-scoped affair lookup (a.id = contributors.affair_id of the page slice).
-- The client keys it by id to label each row's affair + link to /affairs/:id.
a_ids AS (
    SELECT DISTINCT affair_id AS id FROM c_lim WHERE affair_id IS NOT NULL
),
a_src AS (
    SELECT a.*, COUNT(*) OVER () AS _total
    FROM affairs a
    INNER JOIN a_ids ON a.id = a_ids.id
),
a_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list({
            id:                          id,
            body_id:                     body_id,
            body_key:                    body_key,
            number:                      number,
            external_id:                 external_id,
            external_alternative_id:     external_alternative_id,
            type_harmonized_id:          type_harmonized_id,
            type_harmonized_wikidata_id: type_harmonized_wikidata_id,
            state_name_harmonized_id:    state_name_harmonized_id,
            active:                      active,
            type_external_id:            type_external_id,
            state_external_id:           state_external_id,
            begin_date:                  begin_date,
            end_date:                    end_date,
            created_at:                  created_at,
            updated_at:                  updated_at,
            updated_external_at:         updated_external_at,
            title:                 loc(title_de,                 title_fr,                 title_it,                 title_rm,                 NULL,               $2, $3, $4, $5, $6),
            title_long:            loc(title_long_de,            title_long_fr,            title_long_it,            title_long_rm,            NULL,               $2, $3, $4, $5, $6),
            type_harmonized:       loc(type_harmonized_de,       type_harmonized_fr,       type_harmonized_it,       type_harmonized_rm,       type_harmonized_en, $2, $3, $4, $5, $6),
            type_name:             loc(type_name_de,             type_name_fr,             type_name_it,             type_name_rm,             NULL,               $2, $3, $4, $5, $6),
            state_name_harmonized: loc(state_name_harmonized_de, state_name_harmonized_fr, state_name_harmonized_it, state_name_harmonized_rm, NULL,               $2, $3, $4, $5, $6),
            state_name:            loc(state_name_de,            state_name_fr,            state_name_it,            NULL,                     NULL,               $2, $3, $4, $5, $6),
            url_external:          loc(url_external_de,          url_external_fr,          url_external_it,          url_external_rm,          NULL,               $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM a_src
)
SELECT
    grp."group" AS "group",
    { total_count: CAST(c_agg.total_count AS INTEGER), items: COALESCE(c_agg.items, []) } AS contributions,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies,
    { total_count: CAST(a_agg.total_count AS INTEGER), items: COALESCE(a_agg.items, []) } AS affairs
FROM c_agg
CROSS JOIN grp
CROSS JOIN b_agg
CROSS JOIN a_agg;