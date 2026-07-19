-- ============================================================================
-- group_memberships_by_id.sql
--
-- Paginated, localized feed of the MEMBERSHIPS of ONE group: memberships.group_id
-- = $1. Each item is a membership (a person holding a role in this group over a
-- period): person, role, type, span. The person is denormalized on the row
-- (person_id + person_fullname → links to /people/:id) and the membership itself
-- links to /memberships/:id. PERSON family ($1 = the group id at the scope slot →
-- runPersonPaginatedFiltered). Also returns the single localized `group` (header)
-- and a response-scoped `bodies` lookup (b.id = membership.body_id). Requires
-- macro_loc.sql.
--
-- Parameters
--   $1     INTEGER  - the group id (scope; memberships.group_id = $1)
--   $2..$6 VARCHAR  - language priority codes
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror groupMembershipsDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (person_fullname + localized role_name)  NULL = none
--   $10  DOUBLE   - begin_date >=  (epoch-ms)                       NULL = open
--   $11  DOUBLE   - begin_date <=  (epoch-ms)                       NULL = open
--   $12  BOOLEAN  - active (membership.active)                      NULL = any
--   $13  VARCHAR  - party (persons.party_harmonized_wikidata_id, or
--                  matched by harmonized/raw party name)            NULL = any
--   ORDER BY at m_lim + m_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   group       STRUCT  the single localized group. ZERO rows → undefined.
--   memberships STRUCT { total_count, items }  PaginatedList<MembershipClient>.
--   bodies      STRUCT { total_count, items }  PaginatedList<BodyClient> lookup
--               (b.id = memberships.body_id of the page slice).
-- ============================================================================

WITH
m_filtered AS (
    -- LEFT JOIN persons only to reach the member's harmonized party for the $13
    -- filter; SELECT m.* so the output shape (and m_agg below) is unchanged.
    SELECT m.* FROM memberships m
    LEFT JOIN persons p ON p.id = m.person_id
    WHERE m.group_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(m.person_fullname, '')), lower($9))
            OR contains(lower(coalesce(loc(m.role_name_de, m.role_name_fr, m.role_name_it, NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(loc(m.type_harmonized_de, m.type_harmonized_fr, m.type_harmonized_it, m.type_harmonized_rm, m.type_harmonized_en, $2, $3, $4, $5, $6), '')), lower($9)))
      AND ($10 IS NULL OR m.begin_date >= $10)
      AND ($11 IS NULL OR m.begin_date <= $11)
      -- active state of the membership
      AND ($12 IS NULL OR m.active = $12)
      -- party: stable wikidata id, else match the harmonized/raw party name
      -- (mirrors people_list.sql so the same facet value works everywhere).
      AND ($13 IS NULL OR p.party_harmonized_wikidata_id = $13
            OR upper($13) IN (
                 upper(coalesce(p.party_harmonized_de, '')),
                 upper(coalesce(p.party_harmonized_en, '')),
                 upper(coalesce(p.party_de,            '')),
                 upper(coalesce(p.party_fr,            '')),
                 upper(coalesce(p.party_it,            ''))))
),
m_lim AS (
    SELECT * FROM m_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
m_agg AS (
    SELECT
        (SELECT count(*) FROM m_filtered) AS total_count,
        list({
            id:                       id,
            body_id:                  body_id,
            body_key:                 body_key,
            person_id:                person_id,
            person_fullname:          person_fullname,
            group_id:                 group_id,
            external_id:              external_id,
            begin_date:               begin_date,
            end_date:                 end_date,
            active:                   active,
            type_harmonized_oparl_id: type_harmonized_oparl_id,
            created_at:               created_at,
            updated_at:               updated_at,
            updated_external_at:      updated_external_at,
            -- localized label + bare harmonized CODE (for a `type` facet, if added)
            type_harmonized:      loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $2, $3, $4, $5, $6),
            type_harmonized_code: type_harmonized,
            group_name:    loc(group_name_de,    group_name_fr,    group_name_it,    NULL, NULL, $2, $3, $4, $5, $6),
            role_name:     loc(role_name_de,     role_name_fr,     role_name_it,     NULL, NULL, $2, $3, $4, $5, $6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM m_lim
),
-- The single route group (header; langs $2..$6).
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
-- Response-scoped body lookup (b.id = memberships.body_id of the page slice).
b_ids AS (
    SELECT DISTINCT body_id AS id FROM m_lim WHERE body_id IS NOT NULL
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
)
SELECT
    grp."group" AS "group",
    { total_count: CAST(m_agg.total_count AS INTEGER), items: COALESCE(m_agg.items, []) } AS memberships,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM m_agg
CROSS JOIN grp
CROSS JOIN b_agg;