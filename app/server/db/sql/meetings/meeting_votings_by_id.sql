-- ============================================================================
-- meeting_votings_by_id.sql  → ~/server/db/sql/meetings/meeting_votings_by_id.sql
--
-- Paginated, localized feed of the VOTINGS of ONE meeting: votings.meeting_id = $1.
-- Each row is a voting EVENT (links to /votings/:id; parent affair denormalized).
-- PERSON family ($1 = meeting id → runPersonPaginatedFiltered, filters $9+).
-- Returns the single localized `meeting` + a `bodies` lookup (b.id = voting.body_id).
-- macro_loc.sql required.
--
-- Params: $1 id · $2..$6 langs · $7 limit · $8 offset
--   $9  VARCHAR search (voting title + parent affair title)  NULL = none
--   $10 DOUBLE  date >= (epoch-ms)                           NULL = open
--   $11 DOUBLE  date <= (epoch-ms)                           NULL = open
-- ============================================================================

WITH
v_filtered AS (
    SELECT * FROM votings v
    WHERE v.meeting_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(v.title_de, '')), lower($9))
            OR contains(lower(coalesce(v.title_fr, '')), lower($9))
            OR contains(lower(coalesce(v.title_it, '')), lower($9))
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
            id: id, body_id: body_id, body_key: body_key, external_id: external_id, date: date,
            external_alternative_id: external_alternative_id, affair_id: affair_id,
            results_yes: results_yes, results_no: results_no, results_abstention: results_abstention,
            results_absent: results_absent, results_string: results_string, decision: decision,
            meeting_id: meeting_id, group_id: group_id, group_external_id: group_external_id,
            created_at: created_at, updated_at: updated_at, updated_external_at: updated_external_at,
            title:          loc(title_de, title_fr, title_it, NULL, NULL, $2,$3,$4,$5,$6),
            url_external:   loc(url_external_de, url_external_fr, url_external_it, NULL, NULL, $2,$3,$4,$5,$6),
            "type":         loc(type_de, type_fr, type_it, NULL, NULL, $2,$3,$4,$5,$6),
            meaning_of_yes: loc(meaning_of_yes_de, meaning_of_yes_fr, meaning_of_yes_it, NULL, NULL, $2,$3,$4,$5,$6),
            meaning_of_no:  loc(meaning_of_no_de, meaning_of_no_fr, meaning_of_no_it, NULL, NULL, $2,$3,$4,$5,$6),
            affair_title:   loc(affair_title_de, affair_title_fr, affair_title_it, NULL, NULL, $2,$3,$4,$5,$6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM v_lim
),
b_ids AS (
    SELECT DISTINCT body_id AS id FROM v_lim WHERE body_id IS NOT NULL
),
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total FROM bodies b INNER JOIN b_ids ON b.id = b_ids.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
),
mt AS (
    SELECT {
        id: id, body_id: body_id, body_key: body_key, external_id: external_id, "type": type,
        group_id: group_id, parent_type: parent_type, parent_external_id: parent_external_id,
        parent_oparl_id: parent_oparl_id, state: state, abbreviation: abbreviation, number: number,
        begin_date: begin_date, end_date: end_date, location: location, created_at: created_at,
        updated_at: updated_at, updated_external_at: updated_external_at,
        name:          loc(name_de, name_fr, name_it, name_rm, NULL, $2,$3,$4,$5,$6),
        description:   loc(description_de, description_fr, description_it, NULL, NULL, $2,$3,$4,$5,$6),
        type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $2,$3,$4,$5,$6),
        url_external:  loc(url_external_de, url_external_fr, url_external_it, url_external_rm, NULL, $2,$3,$4,$5,$6)
    } AS meeting FROM meetings WHERE id = $1
)
SELECT
    mt.meeting AS meeting,
    { total_count: CAST(v_agg.total_count AS INTEGER), items: COALESCE(v_agg.items, []) } AS votings,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM v_agg, b_agg, mt;
