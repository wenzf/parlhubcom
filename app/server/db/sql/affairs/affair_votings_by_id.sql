-- ============================================================================
-- affair_votings_by_id.sql
--
-- Paginated, localized feed of the VOTINGS linked to ONE affair:
-- votings.affair_id = $1. Each item is a voting EVENT (title, date, type, chamber
-- tally, decision). No identity widening (affairs have no sibling/merge concept).
-- PERSON family ($1 = the affair id at the scope slot → runPersonPaginatedFiltered).
-- Also returns the single localized `affair` (for breadcrumb / sidebar subtitle;
-- the AffairBase header is rendered by the affairs layout). Requires macro_loc.sql.
--
-- Parameters
--   $1     INTEGER  - the affair id (scope; votings.affair_id = $1)
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror affairVotingsDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (voting title + parent affair title, localized)  NULL = none
--   $10  DOUBLE   - date >= (epoch ms)                          NULL = open lower bound
--   $11  DOUBLE   - date <= (epoch ms)                          NULL = open upper bound
--   ORDER BY at v_lim + v_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   affair   STRUCT  the single localized affair. ZERO rows → undefined.
--   votings  STRUCT { total_count, items }  PaginatedList<VotingClient> (filtered page).
-- ============================================================================

WITH
v_filtered AS (
    SELECT * FROM votings v
    WHERE v.affair_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(v.title_de,        '')), lower($9))
            OR contains(lower(coalesce(v.title_fr,        '')), lower($9))
            OR contains(lower(coalesce(v.title_it,        '')), lower($9))
            OR contains(lower(coalesce(v.affair_title_de, '')), lower($9))
            OR contains(lower(coalesce(v.affair_title_fr, '')), lower($9))
            OR contains(lower(coalesce(v.affair_title_it, '')), lower($9)))
      AND ($10 IS NULL OR v.date >= $10)
      AND ($11 IS NULL OR v.date <= $11)
),
v_lim AS (
    SELECT * FROM v_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
v_agg AS (
    SELECT
        (SELECT count(*) FROM v_filtered) AS total_count,
        list({
                id:                      id,
                body_id:                 body_id,
                body_key:                body_key,
                external_id:             external_id,
                date:                    date,
                external_alternative_id: external_alternative_id,
                affair_id:               affair_id,
                results_yes:             results_yes,
                results_no:              results_no,
                results_abstention:      results_abstention,
                results_absent:          results_absent,
                results_string:          results_string,
                decision:                decision,
                meeting_id:              meeting_id,
                group_id:                group_id,
                group_external_id:       group_external_id,
                created_at:              created_at,
                updated_at:              updated_at,
                updated_external_at:     updated_external_at,
                -- localized voting fields
                title:          loc(title_de,          title_fr,          title_it,          NULL, NULL, $2, $3, $4, $5, $6),
                url_external:   loc(url_external_de,   url_external_fr,   url_external_it,   NULL, NULL, $2, $3, $4, $5, $6),
                "type":         loc(type_de,           type_fr,           type_it,           NULL, NULL, $2, $3, $4, $5, $6),
                meaning_of_yes: loc(meaning_of_yes_de, meaning_of_yes_fr, meaning_of_yes_it, NULL, NULL, $2, $3, $4, $5, $6),
                meaning_of_no:  loc(meaning_of_no_de,  meaning_of_no_fr,  meaning_of_no_it,  NULL, NULL, $2, $3, $4, $5, $6),
                affair_title:   loc(affair_title_de,   affair_title_fr,   affair_title_it,   NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM v_lim
),
-- The single route affair (for breadcrumb / sidebar subtitle; same struct as
-- affair_by_id.sql, langs $2..$6).
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
    { total_count: CAST(v_agg.total_count AS INTEGER), items: COALESCE(v_agg.items, []) } AS votings
FROM v_agg
CROSS JOIN af;
