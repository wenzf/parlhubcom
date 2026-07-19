-- ============================================================================
-- body_votings_by_id.sql
--
-- Paginated, localized feed of the VOTINGS held in ONE body (parliament / canton
-- / communal institution): votings.body_id = $1. Each item is a voting EVENT
-- (title, date, type, parent affair, chamber tally, decision) — NOT a per-person
-- vote, so there is no identity widening. PERSON family ($1 = the body id at the
-- scope slot, so it runs through runPersonPaginatedFiltered). Also returns the
-- single `body` record for the BodyBase header in the layout. Requires
-- macro_loc.sql on the same connection.
--
-- Parameters
--   $1     INTEGER  - the body id (scope; votings.body_id = $1)
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror bodyVotingsDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (voting title + parent affair title, localized)  NULL = none
--   $10  DOUBLE   - date >= (epoch ms)                          NULL = open lower bound
--   $11  DOUBLE   - date <= (epoch ms)                          NULL = open upper bound
--   $12  INTEGER  - chamber (votings.group_id)                  NULL = any
--   ORDER BY at v_lim + v_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   body     STRUCT  the single localized route body (BodyBase header). ZERO rows
--                    when no body matches $1 (whole row collapses → undefined).
--   votings  STRUCT { total_count, items }  PaginatedList<VotingClient> (filtered page).
--   chambers LIST    the body's voting chambers (active `council_legislative`
--                    groups that appear on votings), for the chamber facet.
--                    ≥ 2 entries only for multi-chamber bodies (CH federal);
--                    the client hides the facet below 2.
-- ============================================================================

WITH
v_filtered AS (
    SELECT * FROM votings v
    WHERE v.body_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(v.title_de,        '')), lower($9))
            OR contains(lower(coalesce(v.title_fr,        '')), lower($9))
            OR contains(lower(coalesce(v.title_it,        '')), lower($9))
            OR contains(lower(coalesce(v.affair_title_de, '')), lower($9))
            OR contains(lower(coalesce(v.affair_title_fr, '')), lower($9))
            OR contains(lower(coalesce(v.affair_title_it, '')), lower($9)))
      AND ($10 IS NULL OR v.date >= $10)
      AND ($11 IS NULL OR v.date <= $11)
      AND ($12 IS NULL OR v.group_id = $12)
),
-- The page slice (pagination unit = one voting).
v_lim AS (
    SELECT * FROM v_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
v_agg AS (
    SELECT
        (SELECT count(*) FROM v_filtered) AS total_count,  -- filtered voting count
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
-- The body's voting chambers: active legislative-council groups of THIS body
-- that actually appear on votings — this drops duplicate/historical council
-- rows (e.g. Obwalden's two active `Kantonsrat` rows: only the one carrying
-- votings qualifies) and the noise councils with no voting data.
ch_agg AS (
    SELECT list({
            id:           g.id,
            name:         loc(g.name_de,         g.name_fr,         g.name_it,         g.name_rm,         NULL, $2, $3, $4, $5, $6),
            abbreviation: loc(g.abbreviation_de, g.abbreviation_fr, g.abbreviation_it, g.abbreviation_rm, NULL, $2, $3, $4, $5, $6)
        } ORDER BY g.id) AS items
    FROM groups g
    WHERE g.body_id = $1
      AND g.type_harmonized = 'council_legislative'
      AND g.active
      AND EXISTS (SELECT 1 FROM votings vv WHERE vv.body_id = $1 AND vv.group_id = g.id)
),
-- The single route body (for the BodyBase header; same struct as body_by_id.sql).
bd AS (
    SELECT
        body_struct(bodies, $2, $3, $4, $5, $6) AS body
    FROM bodies WHERE id = $1
)
SELECT
    bd.body AS body,
    { total_count: CAST(v_agg.total_count AS INTEGER), items: COALESCE(v_agg.items, []) } AS votings,
    COALESCE(ch_agg.items, []) AS chambers
FROM v_agg
CROSS JOIN bd
CROSS JOIN ch_agg;
