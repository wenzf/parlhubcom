-- ============================================================================
-- text_by_id.sql                          → ~/server/db/sql/texts/text_by_id.sql
--
-- The overview payload for ONE text (a row of the `texts` table) by primary key,
-- localized to the requested language priority. A text is a LEAF entity (no
-- sub-feeds), so this returns:
--   • the text itself (localized type heading + body, format, date, the resolved
--     `text_lang`, and the denormalized parent-affair title), and
--   • a response-scoped `bodies` lookup: the single institution the text belongs
--     to (b.id = texts.body_id), localized — 0 or 1 item.
-- The parent affair is denormalized on the row (affair_id + affair_title), so the
-- page links to /affairs/:affair_id with no separate lookup. Requires
-- macro_loc.sql (incl. loc_lang) on the same connection. Run with runByIdLocalized.
--
-- Parameters
--   $1     INTEGER  - primary key of the text to fetch
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--
-- Output columns
--   text    STRUCT  one localized TextClient. ZERO rows when no text matches $1
--                   (runByIdLocalized → undefined).
--   bodies  STRUCT { total_count, items }  PaginatedList<BodyClient> — the text's
--                   body (b.id = texts.body_id), 0 or 1 item.
--   affairs STRUCT { total_count, items }  PaginatedList<AffairClient> — the text's
--                   parent affair (a.id = texts.affair_id), 0 or 1 item, for the
--                   linked-affair item + /affairs/:id link on the detail page.
-- ============================================================================

WITH
t AS (
    SELECT
        t.*,
        a.title_de AS _aff_title_de,
        a.title_fr AS _aff_title_fr,
        a.title_it AS _aff_title_it,
        a.title_rm AS _aff_title_rm
    FROM texts t
    LEFT JOIN affairs a ON a.id = t.affair_id
    WHERE t.id = $1
),
-- the text's body (0 or 1), localized with the page langs $2..$6
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total
    FROM bodies b
    INNER JOIN (SELECT DISTINCT body_id AS id FROM t WHERE body_id IS NOT NULL) bi
        ON b.id = bi.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
),
-- the parent affair (0 or 1), localized with the page langs $2..$6 — so the
-- detail page can render the linked affair as a real item (title + type) with a
-- link to /affairs/:id. Mirrors the bodies lookup.
af_src AS (
    SELECT a.*, COUNT(*) OVER () AS _total
    FROM affairs a
    INNER JOIN (SELECT DISTINCT affair_id AS id FROM t WHERE affair_id IS NOT NULL) ai
        ON a.id = ai.id
),
af_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
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
            title:                 loc(title_de,                 title_fr,                 title_it,                 title_rm,                 NULL,               $2, $3, $4, $5, $6),
            title_long:            loc(title_long_de,            title_long_fr,            title_long_it,            title_long_rm,            NULL,               $2, $3, $4, $5, $6),
            type_harmonized:       loc(type_harmonized_de,       type_harmonized_fr,       type_harmonized_it,       type_harmonized_rm,       type_harmonized_en, $2, $3, $4, $5, $6),
            type_name:             loc(type_name_de,             type_name_fr,             type_name_it,             type_name_rm,             NULL,               $2, $3, $4, $5, $6),
            state_name_harmonized: loc(state_name_harmonized_de, state_name_harmonized_fr, state_name_harmonized_it, state_name_harmonized_rm, NULL,               $2, $3, $4, $5, $6),
            state_name:            loc(state_name_de,            state_name_fr,            state_name_it,            NULL,                     NULL,               $2, $3, $4, $5, $6),
            url_external:          loc(url_external_de,          url_external_fr,          url_external_it,          url_external_rm,          NULL,               $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM af_src
)
SELECT
    {
        id:                  t.id,
        body_id:             t.body_id,
        body_key:            t.body_key,
        external_id:         t.external_id,
        affair_id:           t.affair_id,
        type_en:             t.type_en,
        text_format:         t.text_format,
        text_date:           CAST(t.text_date AS VARCHAR),
        created_at:          t.created_at,
        updated_at:          t.updated_at,
        updated_external_at: t.updated_external_at,
        -- localized
        "type": loc(t.type_de, t.type_fr, t.type_it, t.type_rm, t.type_en, $2, $3, $4, $5, $6),
        "text": loc(t.text_de, t.text_fr, t.text_it, t.text_rm, NULL,      $2, $3, $4, $5, $6),
        -- the language tag the `text` was resolved from (de|fr|it|rm), via loc_lang
        text_lang: loc_lang(t.text_de, t.text_fr, t.text_it, t.text_rm, NULL, $2, $3, $4, $5, $6),
        -- denormalized localized title of the parent affair (NULL when none)
        affair_title: loc(t._aff_title_de, t._aff_title_fr, t._aff_title_it, t._aff_title_rm, NULL, $2, $3, $4, $5, $6)
    } AS "text",
    { total_count: CAST(b_agg.total_count  AS INTEGER), items: COALESCE(b_agg.items,  []) } AS bodies,
    { total_count: CAST(af_agg.total_count AS INTEGER), items: COALESCE(af_agg.items, []) } AS affairs
FROM t
CROSS JOIN b_agg
CROSS JOIN af_agg;