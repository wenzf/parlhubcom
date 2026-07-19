-- ============================================================================
-- affair_docs_by_id.sql
--
-- Paginated, localized feed of the DOCUMENTS attached to ONE affair:
-- docs.affair_id = $1. Each item is a file (name, url, format, size, category,
-- date). No identity widening. PERSON family ($1 = the affair id at the scope
-- slot → runPersonPaginatedFiltered). Also returns the single localized `affair`
-- (breadcrumb / sidebar subtitle). Requires macro_loc.sql.
--
-- Parameters
--   $1     INTEGER  - the affair id (scope; docs.affair_id = $1)
--   $2..$6 VARCHAR  - language priority codes
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror affairDocsDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (name + localized category)          NULL = none
--   $10  VARCHAR  - category_harmonized code                    NULL = any
--   $11  VARCHAR  - format code (e.g. 'pdf')                    NULL = any
--   ORDER BY at d_lim + d_agg is the literal token /* __ORDER_BY__ */.
--
-- Notes
--   • `date` is a SQL DATE and updated_* are DOUBLE epoch — CAST to VARCHAR to
--     match the string-typed DocClient schema.
--   • `text` / `tika_metadata` (full extracted text) are NULLed out of the list
--     payload (not displayed; keeps the response small). The full file is the url.
--
-- Output columns
--   affair  STRUCT  the single localized affair. ZERO rows → undefined.
--   docs    STRUCT { total_count, items }  PaginatedList<DocClient> (filtered page).
-- ============================================================================

WITH
d_filtered AS (
    SELECT * FROM docs d
    WHERE d.affair_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(d.name, '')), lower($9))
            OR contains(lower(coalesce(loc(d.category_de, d.category_fr, d.category_it, NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9)))
      AND ($10 IS NULL OR d.category_harmonized = $10)
      AND ($11 IS NULL OR d.format = $11)
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
            -- localized
            category: loc(category_de, category_fr, category_it, NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM d_lim
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
    { total_count: CAST(d_agg.total_count AS INTEGER), items: COALESCE(d_agg.items, []) } AS docs
FROM d_agg
CROSS JOIN af;
