-- ============================================================================
-- meeting_docs_by_id.sql  → ~/server/db/sql/meetings/meeting_docs_by_id.sql
--
-- Paginated, localized feed of the DOCUMENTS of ONE meeting: docs.meeting_id = $1.
-- Each item is a file (name, url, format, size, category, date). `text`/
-- `tika_metadata` are NULLed out of the payload; `date`/`updated_*` CAST to
-- VARCHAR (string-typed DocClient). PERSON family ($1 = meeting id →
-- runPersonPaginatedFiltered, filters $9+). Returns the single localized `meeting`.
-- macro_loc.sql required.
--
-- Params: $1 id · $2..$6 langs · $7 limit · $8 offset
--   $9 VARCHAR search (name + localized category)  NULL = none
-- ============================================================================

WITH
d_filtered AS (
    SELECT * FROM docs d
    WHERE d.meeting_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(d.name, '')), lower($9))
            OR contains(lower(coalesce(loc(d.category_de, d.category_fr, d.category_it, NULL, NULL, $2,$3,$4,$5,$6), '')), lower($9)))
),
d_lim AS (
    SELECT * FROM d_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
d_agg AS (
    SELECT
        (SELECT count(*) FROM d_filtered) AS total_count,
        list({
            id: id, body_id: body_id, body_key: body_key, parent_type: parent_type, hash: hash,
            external_id: external_id, external_alternative_id: external_alternative_id, name: name,
            url: url, url_oparl: url_oparl, date: CAST(date AS VARCHAR), size: size,
            category_harmonized: category_harmonized, format: format, "language": language,
            updated_external_at: CAST(updated_external_at AS VARCHAR), updated_at: CAST(updated_at AS VARCHAR),
            text: NULL, tika_metadata: NULL, affair_id: affair_id, meeting_id: meeting_id,
            agenda_id: agenda_id, news_id: news_id,
            category: loc(category_de, category_fr, category_it, NULL, NULL, $2,$3,$4,$5,$6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM d_lim
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
    { total_count: CAST(d_agg.total_count AS INTEGER), items: COALESCE(d_agg.items, []) } AS docs
FROM d_agg, mt;
