-- ============================================================================
-- affair_contributors_by_id.sql
--
-- Paginated, localized feed of the CONTRIBUTORS of ONE affair:
-- contributors.affair_id = $1. Each item is a contributor (a person in a role —
-- author, co-signatory, …) recorded on this affair: name, role, party. This is
-- the INVERSE of person_contributors (which lists the affairs a person worked
-- on); here the affair is fixed and the people vary. No identity widening.
-- PERSON family ($1 = the affair id at the scope slot → runPersonPaginatedFiltered).
-- Also returns the single localized `affair` (breadcrumb / sidebar subtitle).
-- Requires macro_loc.sql.
--
-- Parameters
--   $1     INTEGER  - the affair id (scope; contributors.affair_id = $1)
--   $2..$6 VARCHAR  - language priority codes
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror affairContributorsDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (fullname + localized role + lastname)  NULL = none
--   ORDER BY at c_lim + c_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   affair        STRUCT  the single localized affair. ZERO rows → undefined.
--   contributors  STRUCT { total_count, items }  PaginatedList<ContributorClient>.
-- ============================================================================

WITH
c_filtered AS (
    SELECT * FROM contributors c
    WHERE c.affair_id = $1
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
            -- localized
            role:             loc(role_de,             role_fr,             role_it,             role_rm,            NULL,               $2, $3, $4, $5, $6),
            role_harmonized:  loc(role_harmonized_de,  role_harmonized_fr,  role_harmonized_it,  role_harmonized_rm, role_harmonized_en, $2, $3, $4, $5, $6),
            party:            loc(party_de,            party_fr,            party_it,            party_rm,           NULL,               $2, $3, $4, $5, $6),
            party_harmonized: loc(party_harmonized_de, party_harmonized_fr, party_harmonized_it, NULL,               NULL,               $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM c_lim
),
-- The single route affair (breadcrumb / sidebar subtitle; langs $2..$6).
af AS (
    SELECT
        {
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
        } AS affair
    FROM affairs WHERE id = $1
)
SELECT
    af.affair AS affair,
    { total_count: CAST(c_agg.total_count AS INTEGER), items: COALESCE(c_agg.items, []) } AS contributors
FROM c_agg
CROSS JOIN af;
