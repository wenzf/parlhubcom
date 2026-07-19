-- ============================================================================
-- groups_list.sql
--
-- Top-level, paginated, localized DIRECTORY of groups (parliamentary groups /
-- factions / committees — the `groups` table) with server-side search / filter /
-- sort. NOT scoped to any entity: the scope is the whole `groups` table. ONE row
-- per group; each row links to /groups/:id.
--
-- runListPaginatedFiltered family (langs $1..$5, limit $6, offset $7, filters
-- $8+). Requires macro_loc.sql on the same connection. Mirrors affairs_list.sql.
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror groupsDescriptor.toSqlParams order EXACTLY):
--   $8  VARCHAR  - search: name / abbreviation / description (localized variants)  NULL = none
--   $9  INTEGER  - body_id              (the group's body PK)                      NULL = any
--   $10 INTEGER  - type_harmonized_id   (stable harmonized code)                   NULL = any
--   $11 BOOLEAN  - active                                                          NULL = any
--   $12 DOUBLE   - begin_date >=  (epoch-ms)                                        NULL = open
--   $13 DOUBLE   - begin_date <=  (epoch-ms)                                        NULL = open
--   ORDER BY at g_lim + g_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   groups STRUCT { total_count, items }  PaginatedList<GroupClient> (filtered page).
--   bodies STRUCT { total_count, items }  PaginatedList<BodyClient> — response-scoped
--          LOOKUP of the bodies referenced by this page's groups (b.id = group.body_id),
--          localized. The client keys it by id to label each row's body. Empty list
--          when no group on the page has a body.
-- ============================================================================

WITH
g_filtered AS (
    SELECT * FROM groups g
    WHERE
        ($8 IS NULL
            OR contains(lower(coalesce(g.name_de,         '')), lower($8))
            OR contains(lower(coalesce(g.name_fr,         '')), lower($8))
            OR contains(lower(coalesce(g.name_it,         '')), lower($8))
            OR contains(lower(coalesce(g.name_rm,         '')), lower($8))
            OR contains(lower(coalesce(g.abbreviation_de, '')), lower($8))
            OR contains(lower(coalesce(g.abbreviation_fr, '')), lower($8))
            OR contains(lower(coalesce(g.abbreviation_it, '')), lower($8))
            OR contains(lower(coalesce(g.abbreviation_rm, '')), lower($8))
            OR contains(lower(coalesce(g.description_de,  '')), lower($8))
            OR contains(lower(coalesce(g.description_fr,  '')), lower($8))
            OR contains(lower(coalesce(g.description_it,  '')), lower($8))
            OR contains(lower(coalesce(g.description_rm,  '')), lower($8)))
      AND ($9  IS NULL OR g.body_id = $9)
      AND ($10 IS NULL OR g.type_harmonized_id = $10)
      AND ($11 IS NULL OR g.active = $11)
      AND ($12 IS NULL OR g.begin_date >= $12)
      AND ($13 IS NULL OR g.begin_date <= $13)
),
g_lim AS (
    SELECT * FROM g_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
),
g_agg AS (
    SELECT
        (SELECT count(*) FROM g_filtered) AS total_count,
        list({
                id:                        id,
                body_id:                   body_id,
                body_key:                  body_key,
                external_id:               external_id,
                external_alternative_id:   external_alternative_id,
                type_harmonized_id:        type_harmonized_id,
                type_harmonized_position:  type_harmonized_position,
                type_harmonized_wikidata_id: type_harmonized_wikidata_id,
                active:                    active,
                type_external_id:          type_external_id,
                begin_date:                begin_date,
                end_date:                  end_date,
                wikidata_id:               wikidata_id,
                parent_group_external_id:  parent_group_external_id,
                child_group_external_id:   child_group_external_id,
                parent_council_external_id: parent_council_external_id,
                contact:                   contact,
                created_at:                created_at,
                updated_at:                updated_at,
                updated_external_at:       updated_external_at,
                -- localized
                name:            loc(name_de,            name_fr,            name_it,            name_rm,            NULL,               $1, $2, $3, $4, $5),
                abbreviation:    loc(abbreviation_de,    abbreviation_fr,    abbreviation_it,    abbreviation_rm,    NULL,               $1, $2, $3, $4, $5),
                description:     loc(description_de,     description_fr,     description_it,     description_rm,     NULL,               $1, $2, $3, $4, $5),
                type_harmonized: loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $1, $2, $3, $4, $5),
                type_external:   loc(type_external_de,   type_external_fr,   type_external_it,   type_external_rm,   NULL,               $1, $2, $3, $4, $5),
                url_external:    loc(url_external_de,    url_external_fr,    url_external_it,    url_external_rm,    NULL,               $1, $2, $3, $4, $5)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM g_lim
),
-- Response-scoped body lookup: the distinct bodies referenced by THIS page's
-- groups (join key: bodies.id = groups.body_id). Small set (<= page size).
b_ids AS (
    SELECT DISTINCT body_id AS id FROM g_lim WHERE body_id IS NOT NULL
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
    { total_count: CAST(g_agg.total_count AS INTEGER), items: COALESCE(g_agg.items, []) } AS groups,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM g_agg, b_agg;
