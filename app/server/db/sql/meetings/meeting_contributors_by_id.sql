-- ============================================================================
-- meeting_contributors_by_id.sql → ~/server/db/sql/meetings/meeting_contributors_by_id.sql
--
-- Paginated, localized feed of the CONTRIBUTORS of ONE meeting:
-- contributors.meeting_id = $1. Each item is a person in a role (author, etc.).
-- PERSON family ($1 = meeting id → runPersonPaginatedFiltered, filters $9+).
-- Returns the single localized `meeting` + a `persons` lookup (p.id =
-- contributor.person_id) + an `affairs` lookup (a.id = contributor.affair_id).
-- macro_loc.sql required.
--
-- Params: $1 id · $2..$6 langs · $7 limit · $8 offset
--   $9 VARCHAR search (fullname + lastname + localized role)  NULL = none
-- ============================================================================

WITH
c_filtered AS (
    SELECT * FROM contributors c
    WHERE c.meeting_id = $1
      AND ($9 IS NULL
            OR contains(lower(coalesce(c.fullname, '')), lower($9))
            OR contains(lower(coalesce(c.lastname, '')), lower($9))
            OR contains(lower(coalesce(loc(c.role_harmonized_de, c.role_harmonized_fr, c.role_harmonized_it, c.role_harmonized_rm, c.role_harmonized_en, $2,$3,$4,$5,$6), '')), lower($9)))
),
c_lim AS (
    SELECT * FROM c_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
c_agg AS (
    SELECT
        (SELECT count(*) FROM c_filtered) AS total_count,
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
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM c_lim
),
p_ids AS (
    SELECT DISTINCT person_id AS id FROM c_lim WHERE person_id IS NOT NULL
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
af_ids AS (
    SELECT DISTINCT affair_id AS id FROM c_lim WHERE affair_id IS NOT NULL
),
af_src AS (
    SELECT a.*, COUNT(*) OVER () AS _total FROM affairs a INNER JOIN af_ids ON a.id = af_ids.id
),
af_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list({
            id: id, body_id: body_id, body_key: body_key, number: number, external_id: external_id,
            external_alternative_id: external_alternative_id, type_harmonized_id: type_harmonized_id,
            type_harmonized_wikidata_id: type_harmonized_wikidata_id,
            state_name_harmonized_id: state_name_harmonized_id, active: active,
            type_external_id: type_external_id, state_external_id: state_external_id,
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
    { total_count: CAST(c_agg.total_count AS INTEGER),  items: COALESCE(c_agg.items, [])  } AS contributors,
    { total_count: CAST(p_agg.total_count AS INTEGER),  items: COALESCE(p_agg.items, [])  } AS persons,
    { total_count: CAST(af_agg.total_count AS INTEGER), items: COALESCE(af_agg.items, []) } AS affairs
FROM c_agg, p_agg, af_agg, mt;
