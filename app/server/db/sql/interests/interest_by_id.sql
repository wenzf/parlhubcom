-- ============================================================================
-- interest_by_id.sql                    → ~/server/db/sql/interests/interest_by_id.sql
--
-- The overview payload for ONE declared interest by primary key, localized to
-- the requested language priority. An interest is a LEAF entity (no sub-feeds),
-- so this returns:
--   • the interest itself (type, name, role, group, place, period, payment,
--     ex_officio, declaration doc, external url), and
--   • persons — the ONE holder of the interest (p.id = interest.person_id;
--     0 or 1 item), full localized PersonClient, so the page can label / link
--     the member and describe them (party, group, function, body).
--   • person_identities — the holder's identity group (identity_primary_id =
--     interest.person_id): the same person across parliaments / bodies.
--   • bodies — the bodies that help describe the record: the interest's granting
--     body (b.id = interest.body_id) UNION the holder's body (persons.body_id)
--     UNION the holder's identity bodies (person_identities.body_id). Keyed
--     client-side by id (granting body vs the member's chamber).
--
-- Requires macro_loc.sql on the same connection. Run with runByIdLocalized.
--
-- Parameters
--   $1     INTEGER  - primary key of the interest to fetch
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--
-- Output columns
--   interest          STRUCT  one localized InterestClient. ZERO rows when no
--                             interest matches $1 (runByIdLocalized → undefined).
--   persons           STRUCT { total_count, items }  PaginatedList<PersonClient> (0/1).
--   person_identities STRUCT { total_count, items }  PaginatedList<IdentityClient>.
--   bodies            STRUCT { total_count, items }  PaginatedList<BodyClient>.
-- ============================================================================

WITH
i AS (
    SELECT * FROM interests WHERE id = $1
),
-- the holder (0 or 1), localized with the page langs $2..$6
p_src AS (
    SELECT p.*, COUNT(*) OVER () AS _total
    FROM persons p
    INNER JOIN (SELECT DISTINCT person_id AS id FROM i WHERE person_id IS NOT NULL) pi
        ON p.id = pi.id
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
            parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,              $2, $3, $4, $5, $6),
            party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,              $2, $3, $4, $5, $6),
            party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en, $2, $3, $4, $5, $6),
            website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,              $2, $3, $4, $5, $6),
            occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,              $2, $3, $4, $5, $6),
            marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,              $2, $3, $4, $5, $6),
            electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,              $2, $3, $4, $5, $6),
            function_latest:          loc(function_latest_de,          function_latest_fr,          function_latest_it,          function_latest_rm,          NULL,              $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM p_src
),
-- the holder's identity group (the same member across parliaments/bodies)
pi_agg AS (
    SELECT
        (SELECT count(*) FROM person_identities WHERE identity_primary_id = (SELECT person_id FROM i)) AS total_count,
        list({
            id:                           id,
            identity_primary_id:          identity_primary_id,
            body_id:                      body_id,
            body_key:                     body_key,
            external_id:                  external_id,
            fullname:                     fullname,
            firstname:                    firstname,
            lastname:                     lastname,
            party_harmonized_wikidata_id: party_harmonized_wikidata_id,
            image_url_external:           image_url_external,
            email:                        email,
            phone:                        phone,
            birthday:                     birthday,
            birthday_format:              birthday_format,
            deathday:                     deathday,
            street:                       street,
            postal_code:                  postal_code,
            city:                         city,
            title:                        title,
            website_personal:             website_personal,
            gender:                       gender,
            active:                       active,
            "language":                   language,
            wikidata_id:                  wikidata_id,
            is_primary:                   is_primary,
            created_at:                   created_at,
            updated_at:                   updated_at,
            updated_external_at:          updated_external_at,
            party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,              $2, $3, $4, $5, $6),
            party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en, $2, $3, $4, $5, $6),
            occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,              $2, $3, $4, $5, $6),
            marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,              $2, $3, $4, $5, $6),
            electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,              $2, $3, $4, $5, $6),
            parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,              $2, $3, $4, $5, $6),
            website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,              $2, $3, $4, $5, $6)
        } ORDER BY is_primary DESC NULLS LAST, id) AS items
    FROM person_identities
    WHERE identity_primary_id = (SELECT person_id FROM i)
),
-- bodies that help describe the record: granting body (interest.body_id) UNION
-- holder's body (persons.body_id) UNION holder's identity bodies.
b_ids AS (
        SELECT body_id AS id   FROM i                                                       WHERE body_id IS NOT NULL
    UNION
        SELECT body_id         FROM persons           WHERE id                  = (SELECT person_id FROM i) AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = (SELECT person_id FROM i) AND body_id IS NOT NULL
),
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total
    FROM bodies b
    INNER JOIN b_ids ON b.id = b_ids.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
)
SELECT
    {
        id:                      i.id,
        body_id:                 i.body_id,
        body_key:                i.body_key,
        person_id:               i.person_id,
        external_id:             i.external_id,
        begin_date:              i.begin_date,
        end_date:                i.end_date,
        ex_officio:              i.ex_officio,
        name_id:                 i.name_id,
        place:                   i.place,
        role_external_id:        i.role_external_id,
        type_external_id:        i.type_external_id,
        type_payment_harmonized: i.type_payment_harmonized,
        url:                     i.url,
        declaration_doc_title:   i.declaration_doc_title,
        declaration_doc_url:     i.declaration_doc_url,
        created_at:              i.created_at,
        updated_at:              i.updated_at,
        updated_external_at:     i.updated_external_at,
        -- localized
        "type":            loc(i.type_de,              i.type_fr,              i.type_it,              NULL, NULL, $2, $3, $4, $5, $6),
        name:              loc(i.name_de,              i.name_fr,              i.name_it,              NULL, NULL, $2, $3, $4, $5, $6),
        name_short:        loc(i.name_short_de,        i.name_short_fr,        i.name_short_it,        NULL, NULL, $2, $3, $4, $5, $6),
        "group":           loc(i.group_de,             i.group_fr,             i.group_it,             NULL, NULL, $2, $3, $4, $5, $6),
        name_abbreviation: loc(i.name_abbreviation_de, i.name_abbreviation_fr, i.name_abbreviation_it, NULL, NULL, $2, $3, $4, $5, $6),
        role_name:         loc(i.role_name_de,         i.role_name_fr,         i.role_name_it,         NULL, NULL, $2, $3, $4, $5, $6),
        type_payment:      loc(i.type_payment_de,      i.type_payment_fr,      i.type_payment_it,      NULL, NULL, $2, $3, $4, $5, $6)
    } AS interest,
    { total_count: CAST(p_agg.total_count AS INTEGER),  items: COALESCE(p_agg.items,  []) } AS persons,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER),  items: COALESCE(b_agg.items,  []) } AS bodies
FROM i
CROSS JOIN p_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg;
