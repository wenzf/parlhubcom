-- ============================================================================
-- docs_list.sql                            → ~/server/db/sql/docs/docs_list.sql
--
-- Top-level, paginated, localized DIRECTORY of DOCUMENTS (files from the `docs`
-- table) with server-side search / filter / sort — the /docs catalogue. NOT
-- scoped to an affair, body or meeting: the scope is the whole `docs` table. ONE
-- row per document. Each doc MAY belong to a body (docs.body_id), an affair
-- (docs.affair_id), a meeting (docs.meeting_id) and/or an agenda item
-- (docs.agenda_id); the row links to its own detail page /docs/:id.
--
-- runListPaginatedFiltered family (langs/limit/offset, filters $8+). Requires
-- macro_loc.sql on the same connection. Mirrors texts_list.sql: the single list
-- column `docs` plus a response-scoped `bodies` lookup so each row can label its
-- institution (b.id = docs.body_id).
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror docsDescriptor.toSqlParams order EXACTLY):
--   $8  VARCHAR  - search: matched (contains) over the doc name + localized
--                  category.                                              NULL = none
--   $9  INTEGER  - body_id  (the doc's institution PK)                    NULL = any
--   $10 VARCHAR  - category_harmonized code                              NULL = any
--   $11 VARCHAR  - format code (e.g. 'pdf')                              NULL = any
--   ORDER BY at d_lim + d_agg is the literal token /* __ORDER_BY__ */.
--
-- NOTES
--   • `date` is a SQL DATE and updated_* are DOUBLE epoch — CAST to VARCHAR to
--     match the string-typed DocClient schema. `text` / `tika_metadata` (the full
--     extracted text) are NULLed out of the list payload (not displayed; keeps the
--     response small). The full file is the url.
--   • The doc `category` is localized free-text; the stable FACET value is
--     `category_harmonized` (the code). Search matches the localized category so a
--     query still finds a doc by its category words.
--
-- Output columns
--   docs   STRUCT { total_count, items }  PaginatedList<DocClient> (filtered page).
--   bodies STRUCT { total_count, items }  PaginatedList<BodyClient> — response-scoped
--          LOOKUP of the bodies referenced by this page's docs (b.id =
--          docs.body_id), localized. Keyed client-side by id to label each row.
-- ============================================================================

WITH
d_filtered AS (
    SELECT * FROM docs d
    WHERE
        ($8 IS NULL
            OR contains(lower(coalesce(d.name, '')), lower($8))
            OR contains(lower(coalesce(loc(d.category_de, d.category_fr, d.category_it, NULL, NULL, $1, $2, $3, $4, $5), '')), lower($8)))
      AND ($9  IS NULL OR d.body_id = $9)
      AND ($10 IS NULL OR d.category_harmonized = $10)
      AND ($11 IS NULL OR d.format = $11)
),
d_lim AS (
    SELECT * FROM d_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
),
d_agg AS (
    SELECT
        (SELECT count(*) FROM d_filtered) AS total_count,
        list({
            id:                      id,
            body_id:                 body_id,
            body_key:                body_key,
            parent_type:             parent_type,
            hash:                    hash,
            external_id:             external_id,
            external_alternative_id: external_alternative_id,
            name:                    name,
            url:                     url,
            url_oparl:               url_oparl,
            date:                    CAST(date AS VARCHAR),
            size:                    size,
            category_harmonized:     category_harmonized,
            format:                  format,
            "language":              language,
            updated_external_at:     CAST(updated_external_at AS VARCHAR),
            updated_at:              CAST(updated_at AS VARCHAR),
            text:                    NULL,
            tika_metadata:           NULL,
            affair_id:               affair_id,
            meeting_id:              meeting_id,
            agenda_id:               agenda_id,
            news_id:                 news_id,
            -- localized (LIST family langs $1..$5)
            category: loc(category_de, category_fr, category_it, NULL, NULL, $1, $2, $3, $4, $5)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM d_lim
),
-- Response-scoped body lookup: the distinct bodies referenced by THIS page's
-- docs (join key: bodies.id = docs.body_id). Small set (<= page size). Localized
-- with the LIST langs $1..$5.
b_ids AS (
    SELECT DISTINCT body_id AS id FROM d_lim WHERE body_id IS NOT NULL
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
    { total_count: CAST(d_agg.total_count AS INTEGER), items: COALESCE(d_agg.items, []) } AS docs,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM d_agg, b_agg;
