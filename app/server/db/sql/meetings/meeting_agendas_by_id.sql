-- ============================================================================
-- meeting_agendas_by_id.sql  → ~/server/db/sql/meetings/meeting_agendas_by_id.sql
--
-- Paginated feed of the AGENDA ITEMS of ONE meeting: agendas.meeting_id = $1.
-- Each item is an agenda entry (title, number, category, result, linked affair).
-- Agenda columns are NOT localized (item_language marks the row's language).
-- PERSON family ($1 = meeting id → runPersonPaginatedFiltered, filters $9+).
-- Returns the single localized `meeting` (header) + an `affairs` lookup
-- (a.id = agenda.item_affair_id) so each row links to /affairs/:id. macro_loc.sql required.
--
-- Params: $1 id · $2..$6 langs · $7 limit · $8 offset
--   $9  VARCHAR search (item_title/description/number/category)  NULL = none
--   $10 DOUBLE  item_date >= (epoch-ms)                          NULL = open
--   $11 DOUBLE  item_date <= (epoch-ms)                          NULL = open
-- ============================================================================

WITH
ag_filtered AS (
    SELECT * FROM agendas ag
    WHERE ag.meeting_id = $1
      AND ($9 IS NULL OR (
               contains(lower(coalesce(item_title, '')), lower($9))
            OR contains(lower(coalesce(item_description, '')), lower($9))
            OR contains(lower(coalesce(item_number_display, '')), lower($9))
            OR contains(lower(coalesce(item_category, '')), lower($9))))
      AND ($10 IS NULL OR item_date >= $10)
      AND ($11 IS NULL OR item_date <= $11)
),
ag_lim AS (
    SELECT * FROM ag_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
ag_agg AS (
    SELECT
        (SELECT count(*) FROM ag_filtered) AS total_count,
        list({
            id: id, body_id: body_id, body_key: body_key, meeting_id: meeting_id,
            item_date: item_date, item_external_id: item_external_id, item_title: item_title,
            item_number_display: item_number_display, item_category: item_category, item_url: item_url,
            item_affair_number: item_affair_number, item_affair_id: item_affair_id,
            item_language: item_language, item_description: item_description, item_number: item_number,
            item_result: item_result, item_status: item_status, created_at: created_at
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM ag_lim
),
af_ids AS (
    SELECT DISTINCT item_affair_id AS id FROM ag_lim WHERE item_affair_id IS NOT NULL
),
af_src AS (
    SELECT a.*, COUNT(*) OVER () AS _total FROM affairs a INNER JOIN af_ids ON a.id = af_ids.id
),
af_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list({
            id: id, body_id: body_id, body_key: body_key, number: number, external_id: external_id,
            external_alternative_id: external_alternative_id, type_harmonized_id: type_harmonized_id,
            type_harmonized_wikidata_id: type_harmonized_wikidata_id,
            state_name_harmonized_id: state_name_harmonized_id, active: active,
            type_external_id: type_external_id, state_external_id: state_external_id,
            begin_date: begin_date, end_date: end_date, created_at: created_at, updated_at: updated_at,
            updated_external_at: updated_external_at,
            title:      loc(title_de, title_fr, title_it, title_rm, NULL, $2,$3,$4,$5,$6),
            title_long: loc(title_long_de, title_long_fr, title_long_it, title_long_rm, NULL, $2,$3,$4,$5,$6),
            type_harmonized: loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $2,$3,$4,$5,$6),
            type_name:  loc(type_name_de, type_name_fr, type_name_it, type_name_rm, NULL, $2,$3,$4,$5,$6),
            state_name_harmonized: loc(state_name_harmonized_de, state_name_harmonized_fr, state_name_harmonized_it, state_name_harmonized_rm, NULL, $2,$3,$4,$5,$6),
            state_name: loc(state_name_de, state_name_fr, state_name_it, NULL, NULL, $2,$3,$4,$5,$6),
            url_external: loc(url_external_de, url_external_fr, url_external_it, url_external_rm, NULL, $2,$3,$4,$5,$6)
        } ORDER BY id) AS items
    FROM af_src
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
    { total_count: CAST(ag_agg.total_count AS INTEGER), items: COALESCE(ag_agg.items, []) } AS agendas,
    { total_count: CAST(af_agg.total_count AS INTEGER), items: COALESCE(af_agg.items, []) } AS affairs
FROM ag_agg, af_agg, mt;
