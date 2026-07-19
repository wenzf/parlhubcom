-- ============================================================================
-- affair_texts_by_id.sql
--
-- Paginated, localized feed of the TEXTS attached to ONE affair:
-- texts.affair_id = $1. Each item is a text block (type, body, format, date) —
-- e.g. the submitted text, the reasoning, the council's answer. No identity
-- widening. PERSON family ($1 = the affair id at the scope slot →
-- runPersonPaginatedFiltered). Also returns the single localized `affair`
-- (breadcrumb / sidebar subtitle). Requires macro_loc.sql.
--
-- Parameters
--   $1     INTEGER  - the affair id (scope; texts.affair_id = $1)
--   $2..$6 VARCHAR  - language priority codes
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror affairTextsDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (localized type + localized text body)  NULL = none
--   $10  VARCHAR  - text_format code (e.g. 'plain', 'html')        NULL = any
--   ORDER BY at t_lim + t_agg is the literal token /* __ORDER_BY__ */.
--
-- Notes
--   • `text_date` is a SQL DATE — CAST to VARCHAR to match the string-typed
--     TextClient schema. created_at / updated_* are DOUBLE epoch-ms and the
--     TextClient schema types them as numbers, so they are NOT cast.
--   • Unlike docs, the `text` body IS the payload here (it is what the row
--     displays), so it is kept — not NULLed out.
--   • `type` has a de/fr/it/rm group PLUS an English-only `type_en` (passed as
--     the loc() English arg). `text` has only de/fr/it/rm (no English).
--
-- Output columns
--   affair  STRUCT  the single localized affair. ZERO rows → undefined.
--   texts   STRUCT { total_count, items }  PaginatedList<TextClient> (filtered).
-- ============================================================================

WITH
t_filtered AS (
    SELECT * FROM texts t
    WHERE t.affair_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(loc(t.type_de, t.type_fr, t.type_it, t.type_rm, t.type_en, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(loc(t.text_de, t.text_fr, t.text_it, t.text_rm, NULL,       $2, $3, $4, $5, $6), '')), lower($9)))
      AND ($10 IS NULL OR t.text_format = $10)
),
t_lim AS (
    SELECT * FROM t_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
t_agg AS (
    SELECT
        (SELECT count(*) FROM t_filtered) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            affair_id:           affair_id,
            type_en:             type_en,
            text_format:         text_format,
            text_date:           CAST(text_date AS VARCHAR),
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            -- localized
            "type": loc(type_de, type_fr, type_it, type_rm, type_en, $2, $3, $4, $5, $6),
            "text": loc(text_de, text_fr, text_it, text_rm, NULL,    $2, $3, $4, $5, $6),
            -- -- the language tag the value above was resolved from, via loc_lang — same
            -- args as its loc(), so the two always agree. Consumed as the rendered
            -- block's lang attribute (WCAG 3.1.2 Language of Parts).
            text_lang: loc_lang(text_de, text_fr, text_it, text_rm, NULL, $2, $3, $4, $5, $6),
            affair_title: (SELECT loc(a.title_de, a.title_fr, a.title_it, a.title_rm, NULL, $2, $3, $4, $5, $6) FROM affairs a WHERE a.id = affair_id)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM t_lim
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
    { total_count: CAST(t_agg.total_count AS INTEGER), items: COALESCE(t_agg.items, []) } AS texts
FROM t_agg
CROSS JOIN af;