-- ============================================================================
-- affair_events_by_id.sql
--
-- Paginated, localized feed of the EVENTS (lifecycle stages) of ONE affair:
-- events.affair_id = $1. Each item is a dated step (title/stage, actor, details).
-- No identity widening. PERSON family ($1 = the affair id at the scope slot →
-- runPersonPaginatedFiltered). Also returns the single localized `affair`
-- (breadcrumb / sidebar subtitle). Requires macro_loc.sql.
--
-- Parameters
--   $1     INTEGER  - the affair id (scope; events.affair_id = $1)
--   $2..$6 VARCHAR  - language priority codes
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror affairEventsDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (localized title + actor + details_text)  NULL = none
--   $10  VARCHAR  - actor_type code                                  NULL = any
--   ORDER BY at e_lim + e_agg is the literal token /* __ORDER_BY__ */.
--
-- Notes
--   • `date` is a SQL DATE → CAST to VARCHAR (string-typed EventClient). The
--     created_at/updated_* are epoch DOUBLE → numbers (client overrides), passed
--     through as-is. No date-range facet (DATE column).
--
-- Output columns
--   affair  STRUCT  the single localized affair. ZERO rows → undefined.
--   events  STRUCT { total_count, items }  PaginatedList<EventClient> (filtered page).
-- ============================================================================

WITH
e_filtered AS (
    SELECT * FROM events e
    WHERE e.affair_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(loc(e.title_de, e.title_fr, e.title_it, e.title_rm, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(loc(e.actor_de, e.actor_fr, e.actor_it, NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(e.details_text, '')), lower($9)))
      AND ($10 IS NULL OR e.actor_type = $10)
),
e_lim AS (
    SELECT * FROM e_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
e_agg AS (
    SELECT
        (SELECT count(*) FROM e_filtered) AS total_count,
        list({
            id:                         id,
            body_id:                    body_id,
            body_key:                   body_key,
            external_id:                external_id,
            date:                       CAST(date AS VARCHAR),
            "position":                 position,
            title_external_id:          title_external_id,
            actor_external_id:          actor_external_id,
            actor_type:                 actor_type,
            affair_id:                  affair_id,
            meeting_parent_type:        meeting_parent_type,
            meeting_id:                 meeting_id,
            meeting_parent_external_id: meeting_parent_external_id,
            details_url:                details_url,
            details_text:               details_text,
            "last":                     last,
            created_at:                 created_at,
            updated_at:                 updated_at,
            updated_external_at:        updated_external_at,
            -- localized
            title:            loc(title_de,            title_fr,            title_it,            title_rm,            NULL,                $2, $3, $4, $5, $6),
            title_harmonized: loc(title_harmonized_de, title_harmonized_fr, title_harmonized_it, title_harmonized_rm, title_harmonized_en, $2, $3, $4, $5, $6),
            actor:            loc(actor_de,            actor_fr,            actor_it,            NULL,                NULL,                $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM e_lim
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
    { total_count: CAST(e_agg.total_count AS INTEGER), items: COALESCE(e_agg.items, []) } AS events
FROM e_agg
CROSS JOIN af;
