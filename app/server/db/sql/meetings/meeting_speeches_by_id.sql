-- ============================================================================
-- meeting_speeches_by_id.sql → ~/server/db/sql/meetings/meeting_speeches_by_id.sql
--
-- Paginated, localized feed of the SPEECHES of ONE meeting: speeches.meeting_id = $1.
-- Speaker-headlined rows (rich-text transcript). PERSON family ($1 = meeting id →
-- runPersonPaginatedFiltered, filters $9+). Returns the single localized `meeting`
-- + a `persons` lookup (speakers, p.id = speech.person_id) + a `bodies` lookup
-- (b.id = speech.body_id). macro_loc.sql required.
--
-- Params: $1 id · $2..$6 langs · $7 limit · $8 offset
--   $9  VARCHAR search (transcript, tags stripped)  NULL = none
--   $10 DOUBLE  date_start >= (epoch-ms)             NULL = open
--   $11 DOUBLE  date_start <= (epoch-ms)             NULL = open
-- ============================================================================

WITH
sp_filtered AS (
    SELECT * FROM speeches
    WHERE meeting_id = $1
      AND ($9 IS NULL OR contains(
            lower(regexp_replace(
                coalesce(loc(text_content_de, text_content_fr, text_content_it, NULL, NULL, $2,$3,$4,$5,$6), ''),
                '<[^>]*>', ' ', 'g')),
            lower($9)))
      AND ($10 IS NULL OR date_start >= $10)
      AND ($11 IS NULL OR date_start <= $11)
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
            id: id, body_id: body_id, body_key: body_key, external_id: external_id,
            person_id: person_id, date_start: date_start, date_end: date_end,
            type_external_id: type_external_id, affair_id: affair_id, meeting_id: meeting_id,
            agenda_external_id: agenda_external_id, agenda_id: agenda_id, url: url,
            audio_url: audio_url, video_url: video_url, meeting_external_id: meeting_external_id,
            meeting_type: meeting_type, created_at: created_at, updated_at: updated_at,
            updated_external_at: updated_external_at,
            person_role:   COALESCE(loc(person_role_de, person_role_fr, person_role_it, NULL, NULL, $2,$3,$4,$5,$6), person_role),
            text_content:  loc(text_content_de, text_content_fr, text_content_it, NULL, NULL, $2,$3,$4,$5,$6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $2,$3,$4,$5,$6),
            -- the language tag `text_content` was resolved from (de|fr|it), via
            -- loc_lang — same args as the loc() above, so the two always agree.
            -- Consumed as the transcript's lang attribute (WCAG 3.1.2).
            speech_lang:   loc_lang(text_content_de, text_content_fr, text_content_it, NULL, NULL, $2,$3,$4,$5,$6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM sp_lim
),
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
            id: id, body_id: body_id, body_key: body_key, external_id: external_id,
            external_alternative_id: external_alternative_id, firstname: firstname, lastname: lastname,
            fullname: fullname, birthday: birthday, birthday_format: birthday_format, deathday: deathday,
            gender: gender, party_external_id: party_external_id,
            party_harmonized_wikidata_id: party_harmonized_wikidata_id,
            parliamentary_group_external_id: parliamentary_group_external_id,
            image_url_external: image_url_external, image_url_oparl: image_url_oparl,
            email: email, phone: phone, street: street, postal_code: postal_code, city: city,
            title: title, website_personal: website_personal, parliament_sector: parliament_sector,
            parliament_seat: parliament_seat, active: active, "language": language,
            function_latest_external_id: function_latest_external_id, wikidata_id: wikidata_id,
            created_at: created_at, updated_at: updated_at, updated_external_at: updated_external_at,
            parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL, $2,$3,$4,$5,$6),
            party:            loc(party_de, party_fr, party_it, NULL, NULL, $2,$3,$4,$5,$6),
            party_harmonized: loc(party_harmonized_de, party_harmonized_fr, party_harmonized_it, NULL, party_harmonized_en, $2,$3,$4,$5,$6),
            website_parliament_url: loc(website_parliament_url_de, website_parliament_url_fr, website_parliament_url_it, NULL, NULL, $2,$3,$4,$5,$6),
            occupation: loc(occupation_de, occupation_fr, occupation_it, NULL, NULL, $2,$3,$4,$5,$6),
            marital_status: loc(marital_status_de, marital_status_fr, marital_status_it, NULL, NULL, $2,$3,$4,$5,$6),
            electoral_district: loc(electoral_district_de, electoral_district_fr, electoral_district_it, NULL, NULL, $2,$3,$4,$5,$6),
            function_latest: loc(function_latest_de, function_latest_fr, function_latest_it, function_latest_rm, NULL, $2,$3,$4,$5,$6)
        } ORDER BY id) AS items
    FROM p_src
),
mt AS (
    SELECT {
        id: id, body_id: body_id, body_key: body_key, external_id: external_id, "type": type,
        group_id: group_id, parent_type: parent_type, parent_external_id: parent_external_id,
        parent_oparl_id: parent_oparl_id, state: state, abbreviation: abbreviation, number: number,
        begin_date: begin_date, end_date: end_date, location: location, created_at: created_at,
        updated_at: updated_at, updated_external_at: updated_external_at,
        name:          loc(name_de, name_fr, name_it, name_rm, NULL, $2,$3,$4,$5,$6),
        description:   loc(description_de, description_fr, description_it, NULL, NULL, $2,$3,$4,$5,$6),
        type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $2,$3,$4,$5,$6),
        url_external:  loc(url_external_de, url_external_fr, url_external_it, url_external_rm, NULL, $2,$3,$4,$5,$6)
    } AS meeting FROM meetings WHERE id = $1
)
SELECT
    mt.meeting AS meeting,
    { total_count: CAST(sp_agg.total_count AS INTEGER), items: COALESCE(sp_agg.items, []) } AS speeches,
    { total_count: CAST(b_agg.total_count AS INTEGER),  items: COALESCE(b_agg.items, [])  } AS bodies,
    { total_count: CAST(p_agg.total_count AS INTEGER),  items: COALESCE(p_agg.items, [])  } AS persons
FROM sp_agg, b_agg, p_agg, mt;
