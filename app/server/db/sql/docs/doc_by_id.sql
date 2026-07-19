-- ============================================================================
-- doc_by_id.sql                            → ~/server/db/sql/docs/doc_by_id.sql
--
-- The overview payload for ONE document by primary key, localized to the
-- requested language priority. A doc is a LEAF entity (no sub-feeds). Returns the
-- doc itself (name, url, format, size, date, localized category) plus FOUR
-- response-scoped lookups for the linked entities — each 0 or 1 item:
--   bodies   (b.id  = docs.body_id)      the institution  → /bodies/:id   (internal)
--   affairs  (a.id  = docs.affair_id)    the affair       → /affairs/:id  (internal)
--   meetings (mt.id = docs.meeting_id)   the meeting      → /meetings/:id (internal)
--                                                          + external url_external
--   agendas  (ag.id = docs.agenda_id)    the agenda item  (external item_url)
-- Requires macro_loc.sql. Run with runByIdLocalized.
--
-- Parameters
--   $1     INTEGER  - primary key of the doc to fetch
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--
-- NOTES
--   • `date` is a SQL DATE and updated_* are DOUBLE epoch — CAST to VARCHAR to
--     match the string-typed DocClient schema. `text` / `tika_metadata` (the full
--     extracted text) are NULLed out (not displayed; the full file is the url).
--
-- Output columns
--   doc      STRUCT  one localized DocClient. ZERO rows → undefined.
--   bodies   STRUCT { total_count, items }  PaginatedList<BodyClient>    (0/1)
--   affairs  STRUCT { total_count, items }  PaginatedList<AffairClient>  (0/1)
--   meetings STRUCT { total_count, items }  PaginatedList<MeetingClient> (0/1)
--   agendas  STRUCT { total_count, items }  PaginatedList<AgendaClient>  (0/1)
-- ============================================================================

WITH
d AS (
    SELECT * FROM docs WHERE id = $1
),
-- institution (b.id = d.body_id)
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total
    FROM bodies b
    INNER JOIN (SELECT DISTINCT body_id AS id FROM d WHERE body_id IS NOT NULL) bi ON b.id = bi.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
),
-- affair (a.id = d.affair_id)
af_src AS (
    SELECT a.*, COUNT(*) OVER () AS _total
    FROM affairs a
    INNER JOIN (SELECT DISTINCT affair_id AS id FROM d WHERE affair_id IS NOT NULL) ai ON a.id = ai.id
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
),
-- meeting (mt.id = d.meeting_id)
mt_src AS (
    SELECT mt.*, COUNT(*) OVER () AS _total
    FROM meetings mt
    INNER JOIN (SELECT DISTINCT meeting_id AS id FROM d WHERE meeting_id IS NOT NULL) mi ON mt.id = mi.id
),
mt_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
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
            name:          loc(name_de,          name_fr,          name_it,          name_rm, NULL, $2, $3, $4, $5, $6),
            description:   loc(description_de,   description_fr,   description_it,   NULL,    NULL, $2, $3, $4, $5, $6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL,    NULL, $2, $3, $4, $5, $6),
            url_external:  loc(url_external_de,  url_external_fr,  url_external_it,  url_external_rm, NULL, $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM mt_src
),
-- agenda item (ag.id = d.agenda_id)
ag_src AS (
    SELECT ag.*, COUNT(*) OVER () AS _total
    FROM agendas ag
    INNER JOIN (SELECT DISTINCT agenda_id AS id FROM d WHERE agenda_id IS NOT NULL) gi ON ag.id = gi.id
),
ag_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            meeting_id:          meeting_id,
            item_date:           item_date,
            item_external_id:    item_external_id,
            item_title:          item_title,
            item_number_display: item_number_display,
            item_category:       item_category,
            item_url:            item_url,
            item_affair_number:  item_affair_number,
            item_affair_id:      item_affair_id,
            item_language:       item_language,
            item_description:    item_description,
            item_number:         item_number,
            item_result:         item_result,
            item_status:         item_status,
            created_at:          created_at
        } ORDER BY id) AS items
    FROM ag_src
)
SELECT
    {
        id:                      d.id,
        body_id:                 d.body_id,
        body_key:                d.body_key,
        parent_type:             d.parent_type,
        hash:                    d.hash,
        external_id:             d.external_id,
        external_alternative_id: d.external_alternative_id,
        name:                    d.name,
        url:                     d.url,
        url_oparl:               d.url_oparl,
        date:                    CAST(d.date AS VARCHAR),
        size:                    d.size,
        category_harmonized:     d.category_harmonized,
        format:                  d.format,
        "language":              d.language,
        updated_external_at:     CAST(d.updated_external_at AS VARCHAR),
        updated_at:              CAST(d.updated_at AS VARCHAR),
        text:                    NULL,
        tika_metadata:           NULL,
        affair_id:               d.affair_id,
        meeting_id:              d.meeting_id,
        agenda_id:               d.agenda_id,
        news_id:                 d.news_id,
        -- localized
        category: loc(d.category_de, d.category_fr, d.category_it, NULL, NULL, $2, $3, $4, $5, $6)
    } AS doc,
    { total_count: CAST(b_agg.total_count  AS INTEGER), items: COALESCE(b_agg.items,  []) } AS bodies,
    { total_count: CAST(af_agg.total_count AS INTEGER), items: COALESCE(af_agg.items, []) } AS affairs,
    { total_count: CAST(mt_agg.total_count AS INTEGER), items: COALESCE(mt_agg.items, []) } AS meetings,
    { total_count: CAST(ag_agg.total_count AS INTEGER), items: COALESCE(ag_agg.items, []) } AS agendas
FROM d
CROSS JOIN b_agg
CROSS JOIN af_agg
CROSS JOIN mt_agg
CROSS JOIN ag_agg;
