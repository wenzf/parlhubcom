-- ============================================================================
-- affair_speeches_by_id.sql
--
-- Paginated, localized feed of the SPEECHES given on ONE affair:
-- speeches.affair_id = $1. Inverse of person_speeches (which lists a person's
-- speeches across affairs); here the affair is fixed and the SPEAKERS vary, so
-- the response carries a `persons` lookup (the distinct speakers on the page) for
-- the row headline, plus a `bodies` lookup (rows span chambers → body facet +
-- per-row body label). No identity widening. PERSON family ($1 = the affair id at
-- the scope slot → runPersonPaginatedFiltered). Requires macro_loc.sql.
--
-- Parameters
--   $1     INTEGER  - the affair id (scope; speeches.affair_id = $1)
--   $2..$6 VARCHAR  - language priority codes
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror affairSpeechesDescriptor.toSqlParams order EXACTLY):
--   $9   VARCHAR  - search (transcript, tags stripped, localized)  NULL = none
--   $10  VARCHAR  - type_external_id code                          NULL = any
--   $11  BOOLEAN  - has video (video_url IS NOT NULL)              NULL = any
--   $12  INTEGER  - source body_id                                 NULL = any
--   $13  DOUBLE   - date_start >= (epoch ms)                       NULL = open
--   $14  DOUBLE   - date_start <= (epoch ms)                       NULL = open
--   ORDER BY at sp_lim + sp_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   affair   STRUCT  the single localized affair. ZERO rows → undefined.
--   speeches STRUCT { total_count, items }  PaginatedList<SpeechClient> (filtered page).
--   bodies   STRUCT { total_count, items }  PaginatedList<BodyClient>  (page bodies).
--   persons  STRUCT { total_count, items }  PaginatedList<PersonClient> (page speakers).
-- ============================================================================

WITH
sp_filtered AS (
    SELECT * FROM speeches
    WHERE affair_id = $1
      AND ($9 IS NULL OR contains(
            lower(regexp_replace(
                coalesce(loc(text_content_de, text_content_fr, text_content_it, NULL, NULL, $2, $3, $4, $5, $6), ''),
                '<[^>]*>', ' ', 'g')),
            lower($9)
      ))
      AND ($10 IS NULL OR type_external_id = $10)
      AND ($11 IS NULL OR (video_url IS NOT NULL) = $11)
      AND ($12 IS NULL OR body_id = $12)
      AND ($13 IS NULL OR date_start >= $13)
      AND ($14 IS NULL OR date_start <= $14)
),
sp_lim AS (
    SELECT * FROM sp_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
sp_agg AS (
    SELECT
        (SELECT count(*) FROM sp_filtered) AS total_count,
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
            -- localized
            person_role:   COALESCE(loc(person_role_de, person_role_fr, person_role_it, NULL, NULL, $2, $3, $4, $5, $6), person_role),
            text_content:  loc(text_content_de,  text_content_fr,  text_content_it,  NULL, NULL, $2, $3, $4, $5, $6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $2, $3, $4, $5, $6),
            -- the language tag `text_content` was resolved from (de|fr|it), via
            -- loc_lang — same args as the loc() above, so the two always agree.
            -- Consumed as the transcript's lang attribute (WCAG 3.1.2).
            speech_lang:   loc_lang(text_content_de, text_content_fr, text_content_it, NULL, NULL, $2, $3, $4, $5, $6)
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
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
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
                parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                  $2, $3, $4, $5, $6),
                party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                          NULL,                  $2, $3, $4, $5, $6),
                party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                          party_harmonized_en, $2, $3, $4, $5, $6),
                website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                          NULL,                  $2, $3, $4, $5, $6),
                occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                          NULL,                  $2, $3, $4, $5, $6),
                marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                          NULL,                  $2, $3, $4, $5, $6),
                electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                          NULL,                  $2, $3, $4, $5, $6),
                function_latest:          loc(function_latest_de,          function_latest_fr,          function_latest_it,          function_latest_rm,          NULL,                  $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM p_src
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
    { total_count: CAST(sp_agg.total_count AS INTEGER), items: COALESCE(sp_agg.items, []) } AS speeches,
    { total_count: CAST(b_agg.total_count AS INTEGER),  items: COALESCE(b_agg.items, [])  } AS bodies,
    { total_count: CAST(p_agg.total_count AS INTEGER),  items: COALESCE(p_agg.items, [])  } AS persons
FROM sp_agg, b_agg, p_agg, af;
