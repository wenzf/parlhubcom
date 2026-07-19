-- ============================================================================
-- meeting_by_id.sql  → ~/server/db/sql/meetings/meeting_by_id.sql
--
-- Overview payload for ONE meeting (rendered under meetings_result_layout).
-- Returns the localized `meeting` + first-5 snippet slices of ALL SIX feeds
-- (agendas / votings / speeches / docs / events / contributors — each with the
-- full total_count) + response-scoped lookups: `groups` (the meeting's group,
-- 0/1), `bodies` (meeting body + group body + snippet bodies), `persons`
-- (speech/contributor speakers), `affairs` (behind votings/agendas/contributors/
-- docs/events). runByIdLocalized. macro_loc.sql required.
--   Params: $1 id · $2..$6 langs.
-- ============================================================================

WITH
ag5f AS ( SELECT * FROM agendas WHERE meeting_id = $1 ),
ag5 AS ( SELECT * FROM ag5f ORDER BY item_date DESC NULLS LAST, id DESC LIMIT 5 ),
ag5agg AS (
    SELECT (SELECT count(*) FROM ag5f) AS total_count,
           list({
            id: id, body_id: body_id, body_key: body_key, meeting_id: meeting_id,
            item_date: item_date, item_external_id: item_external_id, item_title: item_title,
            item_number_display: item_number_display, item_category: item_category, item_url: item_url,
            item_affair_number: item_affair_number, item_affair_id: item_affair_id,
            item_language: item_language, item_description: item_description, item_number: item_number,
            item_result: item_result, item_status: item_status, created_at: created_at
           } ORDER BY item_date DESC NULLS LAST, id DESC) AS items
    FROM ag5
),
v5f AS ( SELECT * FROM votings WHERE meeting_id = $1 ),
v5 AS ( SELECT * FROM v5f ORDER BY date DESC NULLS LAST, id DESC LIMIT 5 ),
v5agg AS (
    SELECT (SELECT count(*) FROM v5f) AS total_count,
           list({
            id: id, body_id: body_id, body_key: body_key, external_id: external_id, date: date,
            external_alternative_id: external_alternative_id, affair_id: affair_id,
            results_yes: results_yes, results_no: results_no, results_abstention: results_abstention,
            results_absent: results_absent, results_string: results_string, decision: decision,
            meeting_id: meeting_id, group_id: group_id, group_external_id: group_external_id,
            created_at: created_at, updated_at: updated_at, updated_external_at: updated_external_at,
            title:          loc(title_de, title_fr, title_it, NULL, NULL, $2,$3,$4,$5,$6),
            url_external:   loc(url_external_de, url_external_fr, url_external_it, NULL, NULL, $2,$3,$4,$5,$6),
            "type":         loc(type_de, type_fr, type_it, NULL, NULL, $2,$3,$4,$5,$6),
            meaning_of_yes: loc(meaning_of_yes_de, meaning_of_yes_fr, meaning_of_yes_it, NULL, NULL, $2,$3,$4,$5,$6),
            meaning_of_no:  loc(meaning_of_no_de, meaning_of_no_fr, meaning_of_no_it, NULL, NULL, $2,$3,$4,$5,$6),
            affair_title:   loc(affair_title_de, affair_title_fr, affair_title_it, NULL, NULL, $2,$3,$4,$5,$6)
           } ORDER BY date DESC NULLS LAST, id DESC) AS items
    FROM v5
),
sp5f AS ( SELECT * FROM speeches WHERE meeting_id = $1 ),
sp5 AS ( SELECT * FROM sp5f ORDER BY date_start DESC NULLS LAST, id DESC LIMIT 5 ),
sp5agg AS (
    SELECT (SELECT count(*) FROM sp5f) AS total_count,
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
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $2,$3,$4,$5,$6)
           } ORDER BY date_start DESC NULLS LAST, id DESC) AS items
    FROM sp5
),
d5f AS ( SELECT * FROM docs WHERE meeting_id = $1 ),
d5 AS ( SELECT * FROM d5f ORDER BY date DESC NULLS LAST, id DESC LIMIT 5 ),
d5agg AS (
    SELECT (SELECT count(*) FROM d5f) AS total_count,
           list({
            id: id, body_id: body_id, body_key: body_key, parent_type: parent_type, hash: hash,
            external_id: external_id, external_alternative_id: external_alternative_id, name: name,
            url: url, url_oparl: url_oparl, date: CAST(date AS VARCHAR), size: size,
            category_harmonized: category_harmonized, format: format, "language": language,
            updated_external_at: CAST(updated_external_at AS VARCHAR), updated_at: CAST(updated_at AS VARCHAR),
            text: NULL, tika_metadata: NULL, affair_id: affair_id, meeting_id: meeting_id,
            agenda_id: agenda_id, news_id: news_id,
            category: loc(category_de, category_fr, category_it, NULL, NULL, $2,$3,$4,$5,$6)
           } ORDER BY date DESC NULLS LAST, id DESC) AS items
    FROM d5
),
e5f AS ( SELECT * FROM events WHERE meeting_id = $1 ),
e5 AS ( SELECT * FROM e5f ORDER BY date DESC NULLS LAST, id DESC LIMIT 5 ),
e5agg AS (
    SELECT (SELECT count(*) FROM e5f) AS total_count,
           list({
            id: id, body_id: body_id, body_key: body_key, external_id: external_id,
            date: CAST(date AS VARCHAR), "position": position, title_external_id: title_external_id,
            actor_external_id: actor_external_id, actor_type: actor_type, affair_id: affair_id,
            meeting_parent_type: meeting_parent_type, meeting_id: meeting_id,
            meeting_parent_external_id: meeting_parent_external_id, details_url: details_url,
            details_text: details_text, "last": last, created_at: created_at, updated_at: updated_at,
            updated_external_at: updated_external_at,
            title:            loc(title_de, title_fr, title_it, title_rm, NULL, $2,$3,$4,$5,$6),
            title_harmonized: loc(title_harmonized_de, title_harmonized_fr, title_harmonized_it, title_harmonized_rm, title_harmonized_en, $2,$3,$4,$5,$6),
            actor:            loc(actor_de, actor_fr, actor_it, NULL, NULL, $2,$3,$4,$5,$6)
           } ORDER BY date DESC NULLS LAST, id DESC) AS items
    FROM e5
),
c5f AS ( SELECT * FROM contributors WHERE meeting_id = $1 ),
c5 AS ( SELECT * FROM c5f ORDER BY "position" ASC NULLS LAST, id DESC LIMIT 5 ),
c5agg AS (
    SELECT (SELECT count(*) FROM c5f) AS total_count,
           list({
            id: id, body_id: body_id, body_key: body_key, external_id: external_id,
            affair_id: affair_id, news_id: news_id, person_id: person_id, group_id: group_id,
            meeting_id: meeting_id, session_id: session_id, "type": type,
            role_external_id: role_external_id, firstname: firstname, lastname: lastname,
            fullname: fullname, party_wikidata_id: party_wikidata_id, "position": position,
            created_at: created_at, updated_at: updated_at, updated_external_at: updated_external_at,
            role:             loc(role_de, role_fr, role_it, role_rm, NULL, $2,$3,$4,$5,$6),
            role_harmonized:  loc(role_harmonized_de, role_harmonized_fr, role_harmonized_it, role_harmonized_rm, role_harmonized_en, $2,$3,$4,$5,$6),
            party:            loc(party_de, party_fr, party_it, party_rm, NULL, $2,$3,$4,$5,$6),
            party_harmonized: loc(party_harmonized_de, party_harmonized_fr, party_harmonized_it, NULL, NULL, $2,$3,$4,$5,$6)
           } ORDER BY "position" ASC NULLS LAST, id DESC) AS items
    FROM c5
),
grp AS (
    SELECT id, body_id,
        loc(name_de, name_fr, name_it, name_rm, NULL, $2,$3,$4,$5,$6) AS _n
    FROM groups WHERE id = (SELECT group_id FROM meetings WHERE id = $1)
),
g_agg AS (
    SELECT COALESCE((SELECT count(*) FROM grp),0) AS total_count,
        list({
            id: g.id, body_id: g.body_id, body_key: g.body_key, external_id: g.external_id,
            external_alternative_id: g.external_alternative_id, type_harmonized_id: g.type_harmonized_id,
            type_harmonized_position: g.type_harmonized_position, type_harmonized_wikidata_id: g.type_harmonized_wikidata_id,
            active: g.active, type_external_id: g.type_external_id, begin_date: g.begin_date, end_date: g.end_date,
            wikidata_id: g.wikidata_id, parent_group_external_id: g.parent_group_external_id,
            child_group_external_id: g.child_group_external_id, parent_council_external_id: g.parent_council_external_id,
            contact: g.contact, created_at: g.created_at, updated_at: g.updated_at, updated_external_at: g.updated_external_at,
            name:            loc(g.name_de, g.name_fr, g.name_it, g.name_rm, NULL, $2,$3,$4,$5,$6),
            abbreviation:    loc(g.abbreviation_de, g.abbreviation_fr, g.abbreviation_it, g.abbreviation_rm, NULL, $2,$3,$4,$5,$6),
            description:     loc(g.description_de, g.description_fr, g.description_it, g.description_rm, NULL, $2,$3,$4,$5,$6),
            type_harmonized: loc(g.type_harmonized_de, g.type_harmonized_fr, g.type_harmonized_it, g.type_harmonized_rm, g.type_harmonized_en, $2,$3,$4,$5,$6),
            type_external:   loc(g.type_external_de, g.type_external_fr, g.type_external_it, g.type_external_rm, NULL, $2,$3,$4,$5,$6),
            url_external:    loc(g.url_external_de, g.url_external_fr, g.url_external_it, g.url_external_rm, NULL, $2,$3,$4,$5,$6)
        } ORDER BY g.id) AS items
    FROM groups g WHERE g.id = (SELECT group_id FROM meetings WHERE id = $1)
),
b_ids AS (
        SELECT body_id AS id FROM meetings WHERE id = $1 AND body_id IS NOT NULL
    UNION SELECT body_id FROM v5  WHERE body_id IS NOT NULL
    UNION SELECT body_id FROM sp5 WHERE body_id IS NOT NULL
    UNION SELECT g.body_id FROM groups g WHERE g.id = (SELECT group_id FROM meetings WHERE id=$1) AND g.body_id IS NOT NULL
),
b_src AS ( SELECT b.*, COUNT(*) OVER () AS _total FROM bodies b INNER JOIN b_ids ON b.id = b_ids.id ),
b_agg AS (
    SELECT COALESCE(MAX(_total),0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
),
p_ids AS (
        SELECT person_id AS id FROM sp5 WHERE person_id IS NOT NULL
    UNION SELECT person_id FROM c5 WHERE person_id IS NOT NULL
),
p_src AS ( SELECT p.*, COUNT(*) OVER () AS _total FROM persons p INNER JOIN p_ids ON p.id = p_ids.id ),
p_agg AS (
    SELECT COALESCE(MAX(_total),0) AS total_count,
        list({
            id: id, body_id: body_id, body_key: body_key, external_id: external_id,
            external_alternative_id: external_alternative_id, firstname: firstname, lastname: lastname,
            fullname: fullname, birthday: birthday, birthday_format: birthday_format, deathday: deathday,
            gender: gender, party_external_id: party_external_id, party_harmonized_wikidata_id: party_harmonized_wikidata_id,
            parliamentary_group_external_id: parliamentary_group_external_id, image_url_external: image_url_external,
            image_url_oparl: image_url_oparl, email: email, phone: phone, street: street, postal_code: postal_code,
            city: city, title: title, website_personal: website_personal, parliament_sector: parliament_sector,
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
af_ids AS (
        SELECT affair_id AS id FROM v5 WHERE affair_id IS NOT NULL
    UNION SELECT item_affair_id FROM ag5 WHERE item_affair_id IS NOT NULL
    UNION SELECT affair_id FROM c5 WHERE affair_id IS NOT NULL
    UNION SELECT affair_id FROM d5 WHERE affair_id IS NOT NULL
    UNION SELECT affair_id FROM e5 WHERE affair_id IS NOT NULL
),
af_src AS ( SELECT a.*, COUNT(*) OVER () AS _total FROM affairs a INNER JOIN af_ids ON a.id = af_ids.id ),
af_agg AS (
    SELECT COALESCE(MAX(_total),0) AS total_count,
        list({
            id: id, body_id: body_id, body_key: body_key, number: number, external_id: external_id,
            external_alternative_id: external_alternative_id, type_harmonized_id: type_harmonized_id,
            type_harmonized_wikidata_id: type_harmonized_wikidata_id, state_name_harmonized_id: state_name_harmonized_id,
            active: active, type_external_id: type_external_id, state_external_id: state_external_id,
            begin_date: begin_date, end_date: end_date, created_at: created_at, updated_at: updated_at,
            updated_external_at: updated_external_at,
            title:      loc(title_de, title_fr, title_it, title_rm, NULL, $2,$3,$4,$5,$6),
            title_long: loc(title_long_de, title_long_fr, title_long_it, title_long_rm, NULL, $2,$3,$4,$5,$6),
            type_harmonized: loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $2,$3,$4,$5,$6),
            type_name:  loc(type_name_de, type_name_fr, type_name_it, type_name_rm, NULL, $2,$3,$4,$5,$6),
            state_name_harmonized: loc(state_name_harmonized_de, state_name_harmonized_fr, state_name_harmonized_it, state_name_harmonized_rm, NULL, $2,$3,$4,$5,$6),
            state_name: loc(state_name_de, state_name_fr, state_name_it, NULL, NULL, $2,$3,$4,$5,$6),
            url_external: loc(url_external_de, url_external_fr, url_external_it, url_external_rm, NULL, $2,$3,$4,$5,$6)
        } ORDER BY id) AS items
    FROM af_src
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
    { total_count: CAST(ag5agg.total_count AS INTEGER), items: COALESCE(ag5agg.items, []) } AS agendas,
    { total_count: CAST(v5agg.total_count  AS INTEGER), items: COALESCE(v5agg.items,  []) } AS votings,
    { total_count: CAST(sp5agg.total_count AS INTEGER), items: COALESCE(sp5agg.items, []) } AS speeches,
    { total_count: CAST(d5agg.total_count  AS INTEGER), items: COALESCE(d5agg.items,  []) } AS docs,
    { total_count: CAST(e5agg.total_count  AS INTEGER), items: COALESCE(e5agg.items,  []) } AS events,
    { total_count: CAST(c5agg.total_count  AS INTEGER), items: COALESCE(c5agg.items,  []) } AS contributors,
    { total_count: CAST(g_agg.total_count  AS INTEGER), items: COALESCE(g_agg.items,  []) } AS groups,
    { total_count: CAST(b_agg.total_count  AS INTEGER), items: COALESCE(b_agg.items,  []) } AS bodies,
    { total_count: CAST(p_agg.total_count  AS INTEGER), items: COALESCE(p_agg.items,  []) } AS persons,
    { total_count: CAST(af_agg.total_count AS INTEGER), items: COALESCE(af_agg.items, []) } AS affairs
FROM mt, ag5agg, v5agg, sp5agg, d5agg, e5agg, c5agg, g_agg, b_agg, p_agg, af_agg;