-- ============================================================================
-- votings_list.sql                      → ~/server/db/sql/votings/votings_list.sql
--
-- Top-level, paginated, localized DIRECTORY of votings (voting EVENTS, not
-- per-person votes) with server-side search / filter / sort — the /votings
-- catalogue. NOT scoped to a body or affair: the scope is the whole `votings`
-- table. ONE row per voting; each row links to /votings/:id (and, when present,
-- to its parent affair /affairs/:affair_id via the denormalized affair_title).
--
-- runListPaginatedFiltered family (langs/limit/offset, filters $8+). Requires
-- macro_loc.sql on the same connection. Mirrors affairs_list.sql: the single
-- list column `votings` plus a response-scoped `bodies` lookup so each row can
-- label its parliament (b.id = voting.body_id).
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror votingsDescriptor.toSqlParams order EXACTLY):
--   $8  VARCHAR  - search: voting title + parent affair title (localized)  NULL = none
--   $9  INTEGER  - body_id    (the voting's body PK)                       NULL = any
--   $10 DOUBLE   - date >=    (epoch-ms)                                   NULL = open
--   $11 DOUBLE   - date <=    (epoch-ms)                                   NULL = open
--   ORDER BY at v_lim + v_agg is the literal token /* __ORDER_BY__ */.
--
-- NOTE: the voting `type` is localized free-text (no stable harmonized code),
-- so it is NOT a facet (HANDOFF_catalogues §6). `decision` is likewise free
-- VARCHAR. Filters are body + date range only. `date` is DOUBLE epoch-ms, so the
-- date-range facet is valid here.
--
-- Output columns
--   votings STRUCT { total_count, items }  PaginatedList<VotingClient> (filtered page).
--   bodies  STRUCT { total_count, items }  PaginatedList<BodyClient> — response-scoped
--           LOOKUP of the bodies referenced by this page's votings (b.id =
--           voting.body_id), localized. Keyed client-side by id to label each row.
-- ============================================================================

WITH
v_filtered AS (
    SELECT * FROM votings v
    WHERE
        ($8 IS NULL
            OR contains(lower(coalesce(v.title_de,        '')), lower($8))
            OR contains(lower(coalesce(v.title_fr,        '')), lower($8))
            OR contains(lower(coalesce(v.title_it,        '')), lower($8))
            OR contains(lower(coalesce(v.affair_title_de, '')), lower($8))
            OR contains(lower(coalesce(v.affair_title_fr, '')), lower($8))
            OR contains(lower(coalesce(v.affair_title_it, '')), lower($8)))
      AND ($9  IS NULL OR v.body_id = $9)
      AND ($10 IS NULL OR v.date >= $10)
      AND ($11 IS NULL OR v.date <= $11)
),
v_lim AS (
    SELECT * FROM v_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
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
                -- localized voting fields (LIST family langs $1..$5)
                title:          loc(title_de,          title_fr,          title_it,          NULL, NULL, $1, $2, $3, $4, $5),
                url_external:   loc(url_external_de,   url_external_fr,   url_external_it,   NULL, NULL, $1, $2, $3, $4, $5),
                "type":         loc(type_de,           type_fr,           type_it,           NULL, NULL, $1, $2, $3, $4, $5),
                meaning_of_yes: loc(meaning_of_yes_de, meaning_of_yes_fr, meaning_of_yes_it, NULL, NULL, $1, $2, $3, $4, $5),
                meaning_of_no:  loc(meaning_of_no_de,  meaning_of_no_fr,  meaning_of_no_it,  NULL, NULL, $1, $2, $3, $4, $5),
                affair_title:   loc(affair_title_de,   affair_title_fr,   affair_title_it,   NULL, NULL, $1, $2, $3, $4, $5)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM v_lim
),
-- Response-scoped body lookup: the distinct bodies referenced by THIS page's
-- votings (join key: bodies.id = votings.body_id). Small set (<= page size), so
-- no row cap is needed. Localized with the LIST langs $1..$5.
b_ids AS (
    SELECT DISTINCT body_id AS id FROM v_lim WHERE body_id IS NOT NULL
),
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total
    FROM bodies b
    INNER JOIN b_ids ON b.id = b_ids.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $1, $2, $3, $4, $5) ORDER BY id) AS items
    FROM b_src
)
SELECT
    { total_count: CAST(v_agg.total_count AS INTEGER), items: COALESCE(v_agg.items, []) } AS votings,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM v_agg, b_agg;
