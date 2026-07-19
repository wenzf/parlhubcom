-- ============================================================================
-- speech_by_id.sql                     → ~/server/db/sql/speeches/speech_by_id.sql
--
-- The overview payload for ONE speech by primary key, localized to the requested
-- language priority. A speech is a LEAF entity (no sub-feeds). Returns the speech
-- itself (localized transcript + resolved `speech_lang`, role, type, media urls)
-- plus FIVE response-scoped lookups for the linked entities — each 0 or 1 item:
--   persons  (p.id  = speeches.person_id)   the speaker      → /people/:id
--   bodies   (b.id  = speeches.body_id)      the chamber      → /bodies/:id
--   affairs  (a.id  = speeches.affair_id)    the affair       → /affairs/:id
--   meetings (mt.id = speeches.meeting_id)   the meeting      (external url)
--   agendas  (ag.id = speeches.agenda_id)    the agenda item  (external url)
-- Requires macro_loc.sql (incl. loc_lang). Run with runByIdLocalized.
--
-- Parameters
--   $1     INTEGER  - primary key of the speech to fetch
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--
-- Output columns
--   speech   STRUCT  one localized SpeechClient. ZERO rows → undefined.
--   persons  STRUCT { total_count, items }  PaginatedList<PersonClient>  (0/1)
--   bodies   STRUCT { total_count, items }  PaginatedList<BodyClient>    (0/1)
--   affairs  STRUCT { total_count, items }  PaginatedList<AffairClient>  (0/1)
--   meetings STRUCT { total_count, items }  PaginatedList<MeetingClient> (0/1)
--   agendas  STRUCT { total_count, items }  PaginatedList<AgendaClient>  (0/1)
-- ============================================================================

WITH
s AS (
    SELECT * FROM speeches WHERE id = $1
),
-- speaker (p.id = s.person_id)
p_src AS (
    SELECT p.*, COUNT(*) OVER () AS _total
    FROM persons p
    INNER JOIN (SELECT DISTINCT person_id AS id FROM s WHERE person_id IS NOT NULL) pi ON p.id = pi.id
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
            parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                $2, $3, $4, $5, $6),
            party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,                $2, $3, $4, $5, $6),
            party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en, $2, $3, $4, $5, $6),
            website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,                $2, $3, $4, $5, $6),
            occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,                $2, $3, $4, $5, $6),
            marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,                $2, $3, $4, $5, $6),
            electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,                $2, $3, $4, $5, $6),
            function_latest:          loc(function_latest_de,          function_latest_fr,          function_latest_it,          function_latest_rm,          NULL,                $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM p_src
),
-- chamber (b.id = s.body_id)
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total
    FROM bodies b
    INNER JOIN (SELECT DISTINCT body_id AS id FROM s WHERE body_id IS NOT NULL) bi ON b.id = bi.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
),
-- affair (a.id = s.affair_id)
af_src AS (
    SELECT a.*, COUNT(*) OVER () AS _total
    FROM affairs a
    INNER JOIN (SELECT DISTINCT affair_id AS id FROM s WHERE affair_id IS NOT NULL) ai ON a.id = ai.id
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
-- meeting (mt.id = s.meeting_id)
mt_src AS (
    SELECT mt.*, COUNT(*) OVER () AS _total
    FROM meetings mt
    INNER JOIN (SELECT DISTINCT meeting_id AS id FROM s WHERE meeting_id IS NOT NULL) mi ON mt.id = mi.id
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
-- agenda item (ag.id = s.agenda_id)
ag_src AS (
    SELECT ag.*, COUNT(*) OVER () AS _total
    FROM agendas ag
    INNER JOIN (SELECT DISTINCT agenda_id AS id FROM s WHERE agenda_id IS NOT NULL) gi ON ag.id = gi.id
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
        id:                  s.id,
        body_id:             s.body_id,
        body_key:            s.body_key,
        external_id:         s.external_id,
        person_id:           s.person_id,
        date_start:          s.date_start,
        date_end:            s.date_end,
        type_external_id:    s.type_external_id,
        affair_id:           s.affair_id,
        meeting_id:          s.meeting_id,
        agenda_external_id:  s.agenda_external_id,
        agenda_id:           s.agenda_id,
        url:                 s.url,
        audio_url:           s.audio_url,
        video_url:           s.video_url,
        meeting_external_id: s.meeting_external_id,
        meeting_type:        s.meeting_type,
        created_at:          s.created_at,
        updated_at:          s.updated_at,
        updated_external_at: s.updated_external_at,
        -- localized
        person_role:   COALESCE(loc(s.person_role_de, s.person_role_fr, s.person_role_it, NULL, NULL, $2, $3, $4, $5, $6), s.person_role),
        text_content:  loc(s.text_content_de,  s.text_content_fr,  s.text_content_it,  NULL, NULL, $2, $3, $4, $5, $6),
        type_external: loc(s.type_external_de, s.type_external_fr, s.type_external_it, NULL, NULL, $2, $3, $4, $5, $6),
        -- the language tag the transcript was resolved from (de|fr|it), via loc_lang
        speech_lang:   loc_lang(s.text_content_de, s.text_content_fr, s.text_content_it, NULL, NULL, $2, $3, $4, $5, $6)
    } AS speech,
    { total_count: CAST(p_agg.total_count  AS INTEGER), items: COALESCE(p_agg.items,  []) } AS persons,
    { total_count: CAST(b_agg.total_count  AS INTEGER), items: COALESCE(b_agg.items,  []) } AS bodies,
    { total_count: CAST(af_agg.total_count AS INTEGER), items: COALESCE(af_agg.items, []) } AS affairs,
    { total_count: CAST(mt_agg.total_count AS INTEGER), items: COALESCE(mt_agg.items, []) } AS meetings,
    { total_count: CAST(ag_agg.total_count AS INTEGER), items: COALESCE(ag_agg.items, []) } AS agendas
FROM s
CROSS JOIN p_agg
CROSS JOIN b_agg
CROSS JOIN af_agg
CROSS JOIN mt_agg
CROSS JOIN ag_agg;
