-- ============================================================================
-- bodies_list.sql
--
-- Top-level, paginated, localized DIRECTORY of bodies (parliaments / cantons /
-- communal institutions) with server-side search / filter / sort — the bodies
-- listing page. NOT person-scoped: the scope is the whole `bodies` table. ONE row
-- per body; each row links to /bodies/:id.
--
-- This is the runListPaginatedFiltered family (langs/limit/offset, filters $8+).
-- Requires macro_loc.sql on the same connection. Bodies are self-contained (name
-- / type / canton / country all live on the row) so there are NO response-scoped
-- lookups — the single output column is the paginated `bodies` list itself.
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror bodiesDescriptor.toSqlParams order EXACTLY):
--   $8  VARCHAR  - search: name / legislative_name / executive_name (all localized
--                  variants + base) + canton_key + body_key                NULL = none
--   $9  VARCHAR  - type code (bodies.type; stable, non-localized)           NULL = any
--   $10 VARCHAR  - country_key ('CHE' | 'LIE')                              NULL = any
--   $11 BOOLEAN  - has_parliament                                          NULL = any
--   ORDER BY at b_lim + b_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   bodies  STRUCT { total_count, items }  PaginatedList<BodyClient> (filtered page).
--           total_count is the FILTERED count (CAST to INTEGER); items is the page
--           slice in the ORDER BY, COALESCEd to [] when empty.
-- ============================================================================

WITH
-- A body is kept iff it satisfies ALL active filters. Search spans the localized
-- name variants (and the non-suffixed base columns as ultimate fallback) plus the
-- stable canton_key / body_key codes. Facet predicates key off STABLE columns
-- (type code, country_key, has_parliament) — never a localized display string.
b_filtered AS (
    SELECT * FROM bodies b
    WHERE
        ($8 IS NULL
            OR contains(lower(coalesce(b.name,                 '')), lower($8))
            OR contains(lower(coalesce(b.name_de,              '')), lower($8))
            OR contains(lower(coalesce(b.name_fr,              '')), lower($8))
            OR contains(lower(coalesce(b.name_it,              '')), lower($8))
            OR contains(lower(coalesce(b.name_en,              '')), lower($8))
            OR contains(lower(coalesce(b.legislative_name,     '')), lower($8))
            OR contains(lower(coalesce(b.legislative_name_de,  '')), lower($8))
            OR contains(lower(coalesce(b.legislative_name_fr,  '')), lower($8))
            OR contains(lower(coalesce(b.legislative_name_it,  '')), lower($8))
            OR contains(lower(coalesce(b.legislative_name_en,  '')), lower($8))
            OR contains(lower(coalesce(b.executive_name,       '')), lower($8))
            OR contains(lower(coalesce(b.executive_name_de,    '')), lower($8))
            OR contains(lower(coalesce(b.executive_name_fr,    '')), lower($8))
            OR contains(lower(coalesce(b.executive_name_it,    '')), lower($8))
            OR contains(lower(coalesce(b.executive_name_en,    '')), lower($8))
            OR contains(lower(coalesce(b.canton_key,           '')), lower($8))
            OR contains(lower(coalesce(b.body_key,             '')), lower($8)))
      AND ($9  IS NULL OR b.type = $9)
      AND ($10 IS NULL OR b.country_key = $10)
      AND ($11 IS NULL OR b.has_parliament = $11)
),
-- The page slice (pagination unit = one body row).
b_lim AS (
    SELECT * FROM b_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
),
b_agg AS (
    SELECT
        (SELECT count(*) FROM b_filtered) AS total_count,  -- filtered body count
        list(body_struct(b_lim, $1, $2, $3, $4, $5) ORDER BY /* __ORDER_BY__ */) AS items
    FROM b_lim
)
SELECT
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM b_agg;
