-- ============================================================================
-- meetings_list.sql                     → ~/server/db/sql/meetings/meetings_list.sql
--
-- Top-level, paginated, localized DIRECTORY of meetings (sessions / sittings)
-- with server-side search / filter / sort — the /meetings catalogue. NOT scoped
-- to one group or body: the scope is the whole `meetings` table. ONE row per
-- meeting; each row links to /meetings/:id, to its group /groups/:group_id (via
-- the response-scoped `groups` lookup), and shows its body (via `bodies`).
--
-- runListPaginatedFiltered family (langs/limit/offset, filters $8+). Requires
-- macro_loc.sql on the same connection. Mirrors votings_list.sql: the single
-- list column `meetings` plus two response-scoped lookups:
--   • groups (g.id = meeting.group_id) — label + link each row's group.
--   • bodies (b.id = meeting.body_id)  — label each row's institution.
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror meetingsCatalogDescriptor.toSqlParams order EXACTLY):
--   $8  VARCHAR  - search: meeting name/abbreviation/location/description       NULL = none
--   $9  INTEGER  - group_id  (the meeting's parliamentary group; SOURCED facet) NULL = any
--   $10 INTEGER  - body_id   (the meeting's institution)                        NULL = any
--   $11 DOUBLE   - begin_date >=  (epoch-ms)                                    NULL = open
--   $12 DOUBLE   - begin_date <=  (epoch-ms)                                    NULL = open
--   $13 VARCHAR  - time: 'upcoming' (begin_date > now) | 'past' (<= now)        NULL = any
--   ORDER BY at m_lim + m_agg is the literal token /* __ORDER_BY__ */.
--
-- NOTE: `type` / `state` are free VARCHAR codes (no stable harmonized vocab) and
-- `type_external` is localized free-text → none is a facet (HANDOFF_catalogues §6).
-- `begin_date` is DOUBLE epoch-ms, so the date-range facet is valid here.
--
-- Output columns
--   meetings STRUCT { total_count, items }  PaginatedList<MeetingClient> (filtered page).
--   groups   STRUCT { total_count, items }  PaginatedList<GroupClient> — response-scoped
--            LOOKUP of the groups referenced by this page (g.id = meeting.group_id).
--   bodies   STRUCT { total_count, items }  PaginatedList<BodyClient> — response-scoped
--            LOOKUP of the bodies referenced by this page (b.id = meeting.body_id).
-- ============================================================================

WITH
m_filtered AS (
    SELECT * FROM meetings m
    WHERE
        ($8 IS NULL OR (
               contains(lower(coalesce(loc(name_de, name_fr, name_it, name_rm, NULL, $1, $2, $3, $4, $5), '')), lower($8))
            OR contains(lower(coalesce(abbreviation, '')), lower($8))
            OR contains(lower(coalesce(location, '')), lower($8))
            OR contains(lower(coalesce(loc(description_de, description_fr, description_it, NULL, NULL, $1, $2, $3, $4, $5), '')), lower($8))
        ))
      AND ($9  IS NULL OR m.group_id = $9)   -- parliamentary group PK (sourced)
      AND ($10 IS NULL OR m.body_id  = $10)  -- institution PK
      AND ($11 IS NULL OR m.begin_date >= $11)
      AND ($12 IS NULL OR m.begin_date <= $12)
      AND ($13 IS NULL
           OR ($13 = 'upcoming' AND m.begin_date >  epoch_ms(now()))
           OR ($13 = 'past'     AND m.begin_date <= epoch_ms(now())))
),
m_lim AS (
    SELECT * FROM m_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
),
m_agg AS (
    SELECT
        (SELECT count(*) FROM m_filtered) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            "type":              type,
            group_id:            group_id,
            parent_type:         parent_type,
            parent_external_id:  parent_external_id,
            parent_oparl_id:     parent_oparl_id,
            state:               state,
            abbreviation:        abbreviation,
            number:              number,
            begin_date:          begin_date,
            end_date:            end_date,
            location:            location,
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            -- localized (LIST family langs $1..$5)
            name:          loc(name_de,          name_fr,          name_it,          name_rm, NULL, $1, $2, $3, $4, $5),
            description:   loc(description_de,    description_fr,    description_it,    NULL,    NULL, $1, $2, $3, $4, $5),
            type_external: loc(type_external_de,  type_external_fr,  type_external_it,  NULL,    NULL, $1, $2, $3, $4, $5),
            url_external:  loc(url_external_de,   url_external_fr,   url_external_it,   url_external_rm, NULL, $1, $2, $3, $4, $5)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM m_lim
),
-- Response-scoped group lookup: the distinct groups referenced by THIS page's
-- meetings (g.id = meeting.group_id). Small set (<= page size), localized $1..$5.
g_ids AS (
    SELECT DISTINCT group_id AS id FROM m_lim WHERE group_id IS NOT NULL
),
g_src AS (
    SELECT g.*, COUNT(*) OVER () AS _total
    FROM groups g
    INNER JOIN g_ids ON g.id = g_ids.id
),
g_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list({
            id:                          id,
            body_id:                     body_id,
            body_key:                    body_key,
            external_id:                 external_id,
            external_alternative_id:     external_alternative_id,
            type_harmonized_id:          type_harmonized_id,
            type_harmonized_position:    type_harmonized_position,
            type_harmonized_wikidata_id: type_harmonized_wikidata_id,
            active:                      active,
            type_external_id:            type_external_id,
            begin_date:                  begin_date,
            end_date:                    end_date,
            wikidata_id:                 wikidata_id,
            parent_group_external_id:    parent_group_external_id,
            child_group_external_id:     child_group_external_id,
            parent_council_external_id:  parent_council_external_id,
            contact:                     contact,
            created_at:                  created_at,
            updated_at:                  updated_at,
            updated_external_at:         updated_external_at,
            name:            loc(name_de,            name_fr,            name_it,            name_rm,            NULL,               $1, $2, $3, $4, $5),
            abbreviation:    loc(abbreviation_de,    abbreviation_fr,    abbreviation_it,    abbreviation_rm,    NULL,               $1, $2, $3, $4, $5),
            description:     loc(description_de,     description_fr,     description_it,     description_rm,     NULL,               $1, $2, $3, $4, $5),
            type_harmonized: loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $1, $2, $3, $4, $5),
            type_external:   loc(type_external_de,   type_external_fr,   type_external_it,   type_external_rm,   NULL,               $1, $2, $3, $4, $5),
            url_external:    loc(url_external_de,    url_external_fr,    url_external_it,    url_external_rm,    NULL,               $1, $2, $3, $4, $5)
        } ORDER BY id) AS items
    FROM g_src
),
-- Response-scoped body lookup: the distinct bodies referenced by THIS page's
-- meetings (b.id = meeting.body_id). Localized $1..$5.
b_ids AS (
    SELECT DISTINCT body_id AS id FROM m_lim WHERE body_id IS NOT NULL
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
    { total_count: CAST(m_agg.total_count AS INTEGER), items: COALESCE(m_agg.items, []) } AS meetings,
    { total_count: CAST(g_agg.total_count AS INTEGER), items: COALESCE(g_agg.items, []) } AS groups,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM m_agg, g_agg, b_agg;
