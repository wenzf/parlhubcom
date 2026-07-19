-- ============================================================================
-- meeting_events_by_id.sql  → ~/server/db/sql/meetings/meeting_events_by_id.sql
--
-- Paginated, localized feed of the EVENTS of ONE meeting: events.meeting_id = $1.
-- Each item is a dated step (title/stage, actor, details). `date` is a SQL DATE
-- → CAST to VARCHAR. PERSON family ($1 = meeting id → runPersonPaginatedFiltered,
-- filters $9+). Returns the single localized `meeting`. macro_loc.sql required.
--
-- Params: $1 id · $2..$6 langs · $7 limit · $8 offset
--   $9 VARCHAR search (localized title + actor + details_text)  NULL = none
-- ============================================================================

WITH
e_filtered AS (
    SELECT * FROM events e
    WHERE e.meeting_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(loc(e.title_de, e.title_fr, e.title_it, e.title_rm, NULL, $2,$3,$4,$5,$6), '')), lower($9))
            OR contains(lower(coalesce(loc(e.actor_de, e.actor_fr, e.actor_it, NULL, NULL, $2,$3,$4,$5,$6), '')), lower($9))
            OR contains(lower(coalesce(e.details_text, '')), lower($9)))
),
e_lim AS (
    SELECT * FROM e_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
e_agg AS (
    SELECT
        (SELECT count(*) FROM e_filtered) AS total_count,
        list({
            id: id, body_id: body_id, body_key: body_key, external_id: external_id,
            date: CAST(date AS VARCHAR), "position": position, title_external_id: title_external_id,
            actor_external_id: actor_external_id, actor_type: actor_type, affair_id: affair_id,
            meeting_parent_type: meeting_parent_type, meeting_id: meeting_id,
            meeting_parent_external_id: meeting_parent_external_id, details_url: details_url,
            details_text: details_text, "last": last, created_at: created_at, updated_at: updated_at,
            updated_external_at: updated_external_at,
            title:            loc(title_de, title_fr, title_it, title_rm, NULL, $2,$3,$4,$5,$6),
            title_harmonized: loc(title_harmonized_de, title_harmonized_fr, title_harmonized_it, title_harmonized_rm, title_harmonized_en, $2,$3,$4,$5,$6),
            actor:            loc(actor_de, actor_fr, actor_it, NULL, NULL, $2,$3,$4,$5,$6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM e_lim
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
    { total_count: CAST(e_agg.total_count AS INTEGER), items: COALESCE(e_agg.items, []) } AS events
FROM e_agg, mt;
