-- ============================================================================
-- affairs_list.sql
--
-- Top-level, paginated, localized DIRECTORY of affairs (parliamentary business
-- items) with server-side search / filter / sort — the affairs listing page.
-- NOT person-scoped: the scope is the whole `affairs` table. ONE row per affair;
-- each row links to /affairs/:id.
--
-- runListPaginatedFiltered family (langs/limit/offset, filters $8+). Requires
-- macro_loc.sql on the same connection. Affairs are self-contained, so the single
-- output column is the paginated `affairs` list itself.
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror affairsDescriptor.toSqlParams order EXACTLY):
--   $8  VARCHAR  - search: title / title_long (localized variants) + number       NULL = none
--   $9  INTEGER  - type_harmonized_id   (stable harmonized code)                  NULL = any
--   $10 INTEGER  - state_name_harmonized_id (stable harmonized code)              NULL = any
--   $11 INTEGER  - body_id              (the affair's body PK)                    NULL = any
--   $12 DOUBLE   - begin_date >=  (epoch-ms)                                      NULL = open
--   $13 DOUBLE   - begin_date <=  (epoch-ms)                                      NULL = open
--   ORDER BY at a_lim + a_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   affairs STRUCT { total_count, items }  PaginatedList<AffairClient> (filtered page).
--   bodies  STRUCT { total_count, items }  PaginatedList<BodyClient> — response-scoped
--           LOOKUP of the bodies referenced by this page's affairs (b.id = affair.body_id),
--           localized. Not paginated as a list; the client keys it by body_key to label
--           each row's body. Empty list when no affair on the page has a body.
-- ============================================================================

WITH
a_filtered AS (
    SELECT * FROM affairs a
    WHERE
        ($8 IS NULL
            OR contains(lower(coalesce(a.title_de,        '')), lower($8))
            OR contains(lower(coalesce(a.title_fr,        '')), lower($8))
            OR contains(lower(coalesce(a.title_it,        '')), lower($8))
            OR contains(lower(coalesce(a.title_rm,        '')), lower($8))
            OR contains(lower(coalesce(a.title_long_de,   '')), lower($8))
            OR contains(lower(coalesce(a.title_long_fr,   '')), lower($8))
            OR contains(lower(coalesce(a.title_long_it,   '')), lower($8))
            OR contains(lower(coalesce(a.title_long_rm,   '')), lower($8))
            OR contains(lower(coalesce(a.number,          '')), lower($8)))
      AND ($9  IS NULL OR a.type_harmonized_id = $9)
      AND ($10 IS NULL OR a.state_name_harmonized_id = $10)
      AND ($11 IS NULL OR a.body_id = $11)
      AND ($12 IS NULL OR a.begin_date >= $12)
      AND ($13 IS NULL OR a.begin_date <= $13)
),
a_lim AS (
    SELECT * FROM a_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
),
a_agg AS (
    SELECT
        (SELECT count(*) FROM a_filtered) AS total_count,
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
                title:                 loc(title_de,                 title_fr,                 title_it,                 title_rm,                 NULL,               $1, $2, $3, $4, $5),
                title_long:            loc(title_long_de,            title_long_fr,            title_long_it,            title_long_rm,            NULL,               $1, $2, $3, $4, $5),
                type_harmonized:       loc(type_harmonized_de,       type_harmonized_fr,       type_harmonized_it,       type_harmonized_rm,       type_harmonized_en, $1, $2, $3, $4, $5),
                type_name:             loc(type_name_de,             type_name_fr,             type_name_it,             type_name_rm,             NULL,               $1, $2, $3, $4, $5),
                state_name_harmonized: loc(state_name_harmonized_de, state_name_harmonized_fr, state_name_harmonized_it, state_name_harmonized_rm, NULL,               $1, $2, $3, $4, $5),
                state_name:            loc(state_name_de,            state_name_fr,            state_name_it,            NULL,                     NULL,               $1, $2, $3, $4, $5),
                url_external:          loc(url_external_de,          url_external_fr,          url_external_it,          url_external_rm,          NULL,               $1, $2, $3, $4, $5)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM a_lim
),
-- Response-scoped body lookup: the distinct bodies referenced by THIS page's
-- affairs (join key: bodies.id = affairs.body_id). Small set (<= page size), so
-- no row cap is needed. Localized with the LIST langs $1..$5.
b_ids AS (
    SELECT DISTINCT body_id AS id FROM a_lim WHERE body_id IS NOT NULL
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
    { total_count: CAST(a_agg.total_count AS INTEGER), items: COALESCE(a_agg.items, []) } AS affairs,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM a_agg, b_agg;