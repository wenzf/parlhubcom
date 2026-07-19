-- ============================================================================
-- body_affairs_by_id.sql
--
-- Paginated, localized feed of the AFFAIRS (parliamentary business) of ONE body
-- (parliament / canton / communal institution): affairs.body_id = $1. PERSON
-- family ($1 = the body id at the scope slot, so it runs through
-- runPersonPaginatedFiltered). Also returns the single `body` record for the
-- BodyBase header in the layout. Requires macro_loc.sql on the same connection.
--
-- Parameters
--   $1     INTEGER  - the body id (scope; affairs.body_id = $1)
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror bodyAffairsDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (title / number, localized)                  NULL = none
--   $10  INTEGER  - type_harmonized_id   (sourced from affair_types)    NULL = any
--   $11  INTEGER  - state_name_harmonized_id (sourced from affair_states) NULL = any
--   $12  DOUBLE   - begin_date >= (epoch ms)                  NULL = open lower bound
--   $13  DOUBLE   - begin_date <= (epoch ms)                  NULL = open upper bound
--   ORDER BY at a_lim + a_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   body     STRUCT  the single localized route body (BodyBase header). ZERO rows
--                    when no body matches $1 (whole row collapses → undefined).
--   affairs  STRUCT { total_count, items }  PaginatedList<AffairClient> (filtered page).
-- ============================================================================

WITH
a_filtered AS (
    SELECT * FROM affairs a
    WHERE a.body_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(a.title_de, '')), lower($9))
            OR contains(lower(coalesce(a.title_fr, '')), lower($9))
            OR contains(lower(coalesce(a.title_it, '')), lower($9))
            OR contains(lower(coalesce(a.title_rm, '')), lower($9))
            OR contains(lower(coalesce(a.number,   '')), lower($9)))
      AND ($10 IS NULL OR a.type_harmonized_id = $10)
      AND ($11 IS NULL OR a.state_name_harmonized_id = $11)
      AND ($12 IS NULL OR a.begin_date >= $12)
      AND ($13 IS NULL OR a.begin_date <= $13)
),
-- The page slice (pagination unit = one affair).
a_lim AS (
    SELECT * FROM a_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
a_agg AS (
    SELECT
        (SELECT count(*) FROM a_filtered) AS total_count,  -- filtered affair count
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
                -- localized affair fields
                title:                 loc(title_de,                 title_fr,                 title_it,                 title_rm,                 NULL,                  $2, $3, $4, $5, $6),
                title_long:            loc(title_long_de,            title_long_fr,            title_long_it,            title_long_rm,            NULL,                  $2, $3, $4, $5, $6),
                type_harmonized:       loc(type_harmonized_de,       type_harmonized_fr,       type_harmonized_it,       type_harmonized_rm,       type_harmonized_en,    $2, $3, $4, $5, $6),
                type_name:             loc(type_name_de,             type_name_fr,             type_name_it,             type_name_rm,             NULL,                  $2, $3, $4, $5, $6),
                state_name_harmonized: loc(state_name_harmonized_de, state_name_harmonized_fr, state_name_harmonized_it, state_name_harmonized_rm, NULL,                  $2, $3, $4, $5, $6),
                state_name:            loc(state_name_de,            state_name_fr,            state_name_it,            NULL,                     NULL,                  $2, $3, $4, $5, $6),
                url_external:          loc(url_external_de,          url_external_fr,          url_external_it,          url_external_rm,          NULL,                  $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM a_lim
),
-- The single route body (for the BodyBase header; same struct as body_by_id.sql).
bd AS (
    SELECT
        body_struct(bodies, $2, $3, $4, $5, $6) AS body
    FROM bodies WHERE id = $1
)
SELECT
    bd.body AS body,
    { total_count: CAST(a_agg.total_count AS INTEGER), items: COALESCE(a_agg.items, []) } AS affairs
FROM a_agg
CROSS JOIN bd;
