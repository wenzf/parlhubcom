-- ============================================================================
-- texts_list.sql                          → ~/server/db/sql/texts/texts_list.sql
--
-- Top-level, paginated, localized DIRECTORY of TEXTS (text blocks from the
-- `texts` table) with server-side full-text search / filter / sort — the /texts
-- catalogue. NOT scoped to a body or affair: the scope is the whole `texts`
-- table. ONE row per text. Each text MAY belong to an affair (texts.affair_id)
-- and/or a body (texts.body_id); when it has an affair, the row links to
-- /affairs/:affair_id via the denormalized, localized `affair_title`.
--
-- runListPaginatedFiltered family (langs/limit/offset, filters $8+). Requires
-- macro_loc.sql on the same connection. Mirrors votings_list.sql: the single
-- list column `texts` plus a response-scoped `bodies` lookup so each row can
-- label its institution (b.id = texts.body_id).
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror textsDescriptor.toSqlParams order EXACTLY):
--   $8  VARCHAR  - search REGEX PATTERN: matched (regexp_matches) over text body
--                  + type heading + parent affair title. Built from the keyword +
--                  case/word options (escaped term, optional \b…\b, optional (?i)). NULL = none
--   $9  INTEGER  - body_id   (the text's body PK)                            NULL = any
--   $10 VARCHAR  - text_format code (e.g. 'plain', 'html')                   NULL = any
--   $11 VARCHAR  - lang — DISPLAYED language tag of the text (loc_lang(text…)) NULL = any
--   ORDER BY at t_lim + t_agg is the literal token /* __ORDER_BY__ */.
--
-- NOTES
--   • The text `type` is localized free-text (a heading like "Submitted text"),
--     NOT a stable harmonized code → it is NOT a facet. Only body + format are
--     facets. `text_date` is a SQL DATE (not epoch-ms), so there is NO date-range
--     facet here, and it is CAST to VARCHAR to match the string-typed TextClient
--     schema. created_at / updated_* are DOUBLE epoch-ms and the TextClient schema
--     types them as numbers, so they are NOT cast.
--   • Unlike docs, the `text` body IS the payload (it is what the row displays),
--     so it is kept — not NULLed out. Each row also carries `text_lang`: the
--     language tag ('de'|'fr'|'it'|'rm') the `text` was resolved from, via the
--     loc_lang() companion macro (requires the updated macro_loc.sql on the
--     connection). NULL when the text has no body.
--   • Search matches the localized type heading, the localized text body, AND the
--     parent affair's title (via the LEFT JOIN), so a query can find a text by its
--     own words or by the affair it belongs to.
--
-- Output columns
--   texts  STRUCT { total_count, items }  PaginatedList<TextClient> (filtered page).
--   bodies STRUCT { total_count, items }  PaginatedList<BodyClient> — response-scoped
--          LOOKUP of the bodies referenced by this page's texts (b.id =
--          texts.body_id), localized. Keyed client-side by id to label each row.
-- ============================================================================

WITH
t_filtered AS (
    SELECT
        t.*,
        a.title_de AS _aff_title_de,
        a.title_fr AS _aff_title_fr,
        a.title_it AS _aff_title_it,
        a.title_rm AS _aff_title_rm
    FROM texts t
    LEFT JOIN affairs a ON a.id = t.affair_id
    WHERE
        -- $8 is a REGEX PATTERN (built by textsDescriptor.buildTextSearchPattern
        -- from the keyword + the case/word options): the term is escaped + matched
        -- literally, optionally fenced with \b…\b (whole word) and prefixed with
        -- (?i) (case-insensitive, the default). Matched over the localized type
        -- heading, the localized text body, and the parent affair title.
        ($8 IS NULL
            OR regexp_matches(coalesce(loc(t.type_de, t.type_fr, t.type_it, t.type_rm, t.type_en, $1, $2, $3, $4, $5), ''), $8)
            OR regexp_matches(coalesce(loc(t.text_de, t.text_fr, t.text_it, t.text_rm, NULL,       $1, $2, $3, $4, $5), ''), $8)
            OR regexp_matches(coalesce(a.title_de, ''), $8)
            OR regexp_matches(coalesce(a.title_fr, ''), $8)
            OR regexp_matches(coalesce(a.title_it, ''), $8))
      AND ($9  IS NULL OR t.body_id = $9)
      AND ($10 IS NULL OR t.text_format = $10)
      -- Language filter: matches on the DISPLAYED language of the row's text — the
      -- same value loc_lang() returns as `text_lang` — so it stays in step with the
      -- visible/highlighted text. NULL = any language.
      AND ($11 IS NULL OR loc_lang(t.text_de, t.text_fr, t.text_it, t.text_rm, NULL, $1, $2, $3, $4, $5) = $11)
),
t_lim AS (
    SELECT * FROM t_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
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
            -- localized text fields (LIST family langs $1..$5)
            "type": loc(type_de, type_fr, type_it, type_rm, type_en, $1, $2, $3, $4, $5),
            "text": loc(text_de, text_fr, text_it, text_rm, NULL,    $1, $2, $3, $4, $5),
            -- the language tag of the variant `text` was resolved from (de|fr|it|rm),
            -- matching loc()'s selection exactly. NULL when the text has no body.
            text_lang: loc_lang(text_de, text_fr, text_it, text_rm, NULL, $1, $2, $3, $4, $5),
            -- denormalized localized title of the parent affair (NULL when none)
            affair_title: loc(_aff_title_de, _aff_title_fr, _aff_title_it, _aff_title_rm, NULL, $1, $2, $3, $4, $5)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM t_lim
),
-- Response-scoped body lookup: the distinct bodies referenced by THIS page's
-- texts (join key: bodies.id = texts.body_id). Small set (<= page size), so no
-- row cap is needed. Localized with the LIST langs $1..$5.
b_ids AS (
    SELECT DISTINCT body_id AS id FROM t_lim WHERE body_id IS NOT NULL
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
    { total_count: CAST(t_agg.total_count AS INTEGER), items: COALESCE(t_agg.items, []) } AS texts,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM t_agg, b_agg;