-- ============================================================================
-- speeches_list.sql                    → ~/server/db/sql/speeches/speeches_list.sql
--
-- Top-level, paginated, localized DIRECTORY of SPEECHES (parliamentary
-- interventions) with server-side full-text search / filter / sort — the
-- /speeches catalogue. NOT scoped to a person or affair: the scope is the whole
-- `speeches` table. ONE row per speech; each row links to /speeches/:id and shows
-- its speaker (persons lookup) + body (bodies lookup).
--
-- runListPaginatedFiltered family (langs/limit/offset, filters $8+). Requires
-- macro_loc.sql (incl. loc_lang) on the same connection. Mirrors texts_list.sql /
-- the affair_speeches feed: a `speeches` list column + response-scoped `persons`
-- and `bodies` lookups.
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror speechesCatalogDescriptor.toSqlParams order EXACTLY):
--   $8  VARCHAR  - search REGEX PATTERN over the PRECOMPUTED search columns
--                  (search_text_* = tag-stripped transcript, search_meta =
--                  speaker name + parent affair titles — see ingest/derive.ts).
--                  Built from the keyword + case/word options (escaped term,
--                  optional \b…\b, optional (?i)).                             NULL = none
--   $9  INTEGER  - body_id   (the speech's body PK)                            NULL = any
--   $10 VARCHAR  - type_external_id code                                       NULL = any
--   $11 BOOLEAN  - has video (video_url IS NOT NULL)                           NULL = any
--   $12 VARCHAR  - lang — DISPLAYED language of the transcript (loc_lang),
--                  one of 'de'|'fr'|'it'                                       NULL = any
--   $13 DOUBLE   - date_start >= (epoch ms)                                    NULL = open
--   $14 DOUBLE   - date_start <= (epoch ms)                                    NULL = open
--   ORDER BY at sp_page + sp_agg is the literal token /* __ORDER_BY__ */.
--
-- Shape: LATE MATERIALIZED — sp_ids (narrow: filter/sort/count) -> sp_page (the
-- page's ids) -> sp_lim (wide columns for those ids only). See the note on sp_ids
-- before changing it; projecting the transcripts before the LIMIT costs ~1.7s.
--
-- Output columns
--   speeches STRUCT { total_count, items }  PaginatedList<SpeechClient> (filtered page).
--   bodies   STRUCT { total_count, items }  PaginatedList<BodyClient>  (page bodies).
--   persons  STRUCT { total_count, items }  PaginatedList<PersonClient> (page speakers).
-- ============================================================================

WITH
-- LATE MATERIALIZATION — do not widen this CTE.
--
-- Filter, sort and count over id + the sort keys ONLY. `speeches` carries three
-- transcript columns (avg ~1.3 KB, max ~270 KB) over 2.5M rows; projecting `s.*`
-- here made the scan read every transcript in the table before the LIMIT threw
-- 2.5M of them away — ~9s of CPU (1.7s wall) for a 20-row page. The page's wide
-- columns are fetched in `sp_lim` below, for the 20 ids that survive.
--
-- SEARCH runs on the PRECOMPUTED columns from ingest/derive.ts (search_text_* =
-- tag-stripped transcripts, NULL exactly where text_content_* is NULL so loc()
-- picks the same variant; search_meta = fullname + affair titles denormalized).
-- That removes the per-request regexp_replace over every transcript (~3x the
-- cost of the match itself) and the persons/affairs joins. The one semantic
-- delta vs. matching the joined fields separately: a multi-word phrase can in
-- principle match ACROSS the concatenated name/title fields of search_meta.
--
-- The lang facet ($12) runs loc_lang over the has_text_* flags (1 byte/row) —
-- the CASE mirrors the text columns' nullness, which is all loc_lang reads, so
-- it returns the exact `speech_lang` without touching the transcripts.
--
-- Only `date_start` / `date_end` are sortable (speechesCatalogDescriptor.sorts),
-- so the sort keys are narrow. Adding a sort over a wide column would defeat
-- this — carry the new key here rather than falling back to `s.*`.
sp_ids AS (
    SELECT s.id, s.date_start, s.date_end
    FROM speeches s
    WHERE
        -- $8 = a REGEX PATTERN; matched over the precomputed tag-stripped
        -- localized transcript and the speaker/affair metadata blob.
        ($8 IS NULL
            OR regexp_matches(coalesce(loc(s.search_text_de, s.search_text_fr, s.search_text_it, NULL, NULL, $1, $2, $3, $4, $5), ''), $8)
            OR regexp_matches(coalesce(s.search_meta, ''), $8))
      AND ($9  IS NULL OR s.body_id = $9)
      AND ($10 IS NULL OR s.type_external_id = $10)
      AND ($11 IS NULL OR (s.video_url IS NOT NULL) = $11)
      -- Language filter on the DISPLAYED transcript language (same value loc_lang
      -- returns as `speech_lang`, via the presence flags). NULL = any.
      AND ($12 IS NULL OR loc_lang(CASE WHEN s.has_text_de THEN '' END, CASE WHEN s.has_text_fr THEN '' END, CASE WHEN s.has_text_it THEN '' END, NULL, NULL, $1, $2, $3, $4, $5) = $12)
      AND ($13 IS NULL OR s.date_start >= $13)
      AND ($14 IS NULL OR s.date_start <= $14)
),
-- The page's ids: the only place the 2.5M-row sort happens, on narrow rows.
sp_page AS (
    SELECT id FROM sp_ids
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
),
-- Now — and only now — read the wide columns, for the <= $6 rows on the page.
-- SEMI JOIN keeps one row per speech; ordering is re-applied in sp_agg's list().
sp_lim AS (
    SELECT s.* FROM speeches s SEMI JOIN sp_page ON s.id = sp_page.id
),
sp_agg AS (
    SELECT
        (SELECT count(*) FROM sp_ids) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            person_id:           person_id,
            date_start:          date_start,
            date_end:            date_end,
            type_external_id:    type_external_id,
            affair_id:           affair_id,
            meeting_id:          meeting_id,
            agenda_external_id:  agenda_external_id,
            agenda_id:           agenda_id,
            url:                 url,
            audio_url:           audio_url,
            video_url:           video_url,
            meeting_external_id: meeting_external_id,
            meeting_type:        meeting_type,
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            -- localized (LIST family langs $1..$5)
            person_role:   COALESCE(loc(person_role_de, person_role_fr, person_role_it, NULL, NULL, $1, $2, $3, $4, $5), person_role),
            text_content:  loc(text_content_de,  text_content_fr,  text_content_it,  NULL, NULL, $1, $2, $3, $4, $5),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $1, $2, $3, $4, $5),
            -- the language tag the transcript was resolved from (de|fr|it), via loc_lang
            speech_lang:   loc_lang(text_content_de, text_content_fr, text_content_it, NULL, NULL, $1, $2, $3, $4, $5)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM sp_lim
),
-- Bodies referenced by the page's speeches (b.id = speech.body_id).
b_ids AS (
    SELECT DISTINCT body_id AS id FROM sp_lim WHERE body_id IS NOT NULL
),
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total FROM bodies b INNER JOIN b_ids ON b.id = b_ids.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $1, $2, $3, $4, $5) ORDER BY id) AS items
    FROM b_src
),
-- Speakers referenced by the page's speeches (p.id = speech.person_id).
p_ids AS (
    SELECT DISTINCT person_id AS id FROM sp_lim WHERE person_id IS NOT NULL
),
p_src AS (
    SELECT p.*, COUNT(*) OVER () AS _total FROM persons p INNER JOIN p_ids ON p.id = p_ids.id
),
p_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list({
                id:                              id,
                body_id:                         body_id,
                body_key:                        body_key,
                external_id:                     external_id,
                external_alternative_id:         external_alternative_id,
                firstname:                       firstname,
                lastname:                        lastname,
                fullname:                        fullname,
                birthday:                        birthday,
                birthday_format:                 birthday_format,
                deathday:                        deathday,
                gender:                          gender,
                party_external_id:               party_external_id,
                party_harmonized_wikidata_id:    party_harmonized_wikidata_id,
                parliamentary_group_external_id: parliamentary_group_external_id,
                image_url_external:              image_url_external,
                image_url_oparl:                 image_url_oparl,
                email:                           email,
                phone:                           phone,
                street:                          street,
                postal_code:                     postal_code,
                city:                            city,
                title:                           title,
                website_personal:                website_personal,
                parliament_sector:               parliament_sector,
                parliament_seat:                 parliament_seat,
                active:                          active,
                "language":                      language,
                function_latest_external_id:     function_latest_external_id,
                wikidata_id:                     wikidata_id,
                created_at:                      created_at,
                updated_at:                      updated_at,
                updated_external_at:             updated_external_at,
                -- localized
                parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                $1, $2, $3, $4, $5),
                party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,                $1, $2, $3, $4, $5),
                party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en, $1, $2, $3, $4, $5),
                website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,                $1, $2, $3, $4, $5),
                occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,                $1, $2, $3, $4, $5),
                marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,                $1, $2, $3, $4, $5),
                electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,                $1, $2, $3, $4, $5),
                function_latest:          loc(function_latest_de,          function_latest_fr,          function_latest_it,          function_latest_rm,          NULL,                $1, $2, $3, $4, $5)
        } ORDER BY id) AS items
    FROM p_src
)
SELECT
    { total_count: CAST(sp_agg.total_count AS INTEGER), items: COALESCE(sp_agg.items, []) } AS speeches,
    { total_count: CAST(b_agg.total_count  AS INTEGER), items: COALESCE(b_agg.items,  []) } AS bodies,
    { total_count: CAST(p_agg.total_count  AS INTEGER), items: COALESCE(p_agg.items,  []) } AS persons
FROM sp_agg, b_agg, p_agg;
