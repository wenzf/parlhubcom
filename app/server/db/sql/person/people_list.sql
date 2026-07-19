-- ============================================================================
-- people_list.sql
--
-- Top-level, paginated, localized DIRECTORY of persons with server-side
-- search / filter / sort (the people listing page). NOT person-scoped, but
-- IDENTITY-AWARE: a person matches when the primary `persons` row OR any of their
-- sibling `person_identities` rows satisfies the (single) set of active filters,
-- so people are not missed when a mandate (parliament/party/active state) is
-- recorded on a sibling identity rather than the primary row. Still ONE row per
-- primary person (no duplicates); each row links to the primary /people/:id.
-- This is the runListPaginatedFiltered family (langs/limit/offset, filters $8+).
-- Requires macro_loc.sql on the same connection.
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (matched over the persons + identities CLAIMS set, single claim):
--   $8  VARCHAR  - search (fullname / firstname / lastname / city / postal_code)  NULL = none
--   $9  VARCHAR  - party ABBREVIATION (matched vs harmonized/raw party)           NULL = any
--   $10 VARCHAR  - parliamentary_group_external_id (PRIMARY row only; identities   NULL = any
--                  carry no group code)
--   $11 INTEGER  - body_id (parliament)                                          NULL = any
--   $12 BOOLEAN  - active                                                        NULL = any
--   $13 VARCHAR  - gender                                                        NULL = any
--   $14 BOOLEAN  - deceased (deathday IS NOT NULL)                               NULL = any
--   $15 VARCHAR  - country_key (via the claim's body; 'CHE' | 'LIE')             NULL = any
--   $16 VARCHAR  - electoral district name (vs electoral_district_de/fr/it)       NULL = any
--   ORDER BY at p_lim + p_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns
--   people            STRUCT { total_count, items }  PaginatedList<PersonClient> (filtered page)
--   person_identities STRUCT { total_count, items }  IdentityClient; response-scoped: every
--                                                     identity whose identity_primary_id is on
--                                                     the page — the person's other mandates
--                                                     (canton / federal / communal), for the
--                                                     "also active in" display. Link to primary.
--   bodies            STRUCT { total_count, items }  BodyClient; bodies behind the page persons
--                                                     AND their identities (for parliament labels).
-- ============================================================================

WITH
-- All identity-claims per primary person: the primary `persons` row UNION its
-- sibling identities. Filters match a SINGLE claim, so "body X + party Y" means
-- one mandate satisfies both. parliamentary_group_external_id exists only on
-- persons (identities carry no group code) -> NULL for identity claims, so the
-- group filter is effectively primary-row-only.
claims AS (
        SELECT
            id AS primary_id,
            fullname, firstname, lastname, city, postal_code, gender, deathday,
            body_id, active,
            party_de, party_fr, party_it, party_harmonized_de, party_harmonized_en,
            party_harmonized_wikidata_id,
            electoral_district_de, electoral_district_fr, electoral_district_it,
            parliamentary_group_external_id
        FROM persons
    UNION ALL
        SELECT
            identity_primary_id AS primary_id,
            fullname, firstname, lastname, city, postal_code, gender, deathday,
            body_id, active,
            party_de, party_fr, party_it, party_harmonized_de, party_harmonized_en,
            party_harmonized_wikidata_id,
            electoral_district_de, electoral_district_fr, electoral_district_it,
            NULL::VARCHAR AS parliamentary_group_external_id
        FROM person_identities
),
-- A primary person is kept iff at least one of their claims satisfies ALL filters.
p_filtered AS (
    SELECT p.* FROM persons p
    WHERE EXISTS (
        SELECT 1 FROM claims c
        WHERE c.primary_id = p.id
          AND ($8  IS NULL OR contains(lower(coalesce(c.fullname,    '')), lower($8))
                           OR contains(lower(coalesce(c.firstname,   '')), lower($8))
                           OR contains(lower(coalesce(c.lastname,    '')), lower($8))
                           OR contains(lower(coalesce(c.city,        '')), lower($8))
                           OR contains(lower(coalesce(c.postal_code, '')), lower($8)))
          AND ($9  IS NULL OR c.party_harmonized_wikidata_id = $9
                           OR upper($9) IN (
                                upper(coalesce(c.party_harmonized_de, '')),
                                upper(coalesce(c.party_harmonized_en, '')),
                                upper(coalesce(c.party_de,            '')),
                                upper(coalesce(c.party_fr,            '')),
                                upper(coalesce(c.party_it,            ''))))
          AND ($10 IS NULL OR c.parliamentary_group_external_id = $10)
          AND ($11 IS NULL OR c.body_id = $11)
          AND ($12 IS NULL OR c.active  = $12)
          AND ($13 IS NULL OR c.gender  = $13)
          AND ($14 IS NULL OR (c.deathday IS NOT NULL) = $14)
          AND ($15 IS NULL OR EXISTS (
                  SELECT 1 FROM bodies bc WHERE bc.id = c.body_id AND bc.country_key = $15))
          AND ($16 IS NULL OR $16 IN (c.electoral_district_de, c.electoral_district_fr, c.electoral_district_it))
    )
),
-- The page slice (pagination unit = primary person row).
p_lim AS (
    SELECT * FROM p_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
),
p_agg AS (
    SELECT
        (SELECT count(*) FROM p_filtered) AS total_count,  -- filtered primary-person count
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
                parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                  $1, $2, $3, $4, $5),
                party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                          NULL,                  $1, $2, $3, $4, $5),
                party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                          party_harmonized_en, $1, $2, $3, $4, $5),
                website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                          NULL,                  $1, $2, $3, $4, $5),
                occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                          NULL,                  $1, $2, $3, $4, $5),
                marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                          NULL,                  $1, $2, $3, $4, $5),
                electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                          NULL,                  $1, $2, $3, $4, $5),
                function_latest:          loc(function_latest_de,          function_latest_fr,          function_latest_it,          function_latest_rm,          NULL,                  $1, $2, $3, $4, $5)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM p_lim
),
-- The page persons' sibling identities (their other mandates), for display.
pi_agg AS (
    SELECT
        (SELECT count(*) FROM person_identities
          WHERE identity_primary_id IN (SELECT id FROM p_lim)) AS total_count,
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
                -- localized
                party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,                $1, $2, $3, $4, $5),
                party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en, $1, $2, $3, $4, $5),
                occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,                $1, $2, $3, $4, $5),
                marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,                $1, $2, $3, $4, $5),
                electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,                $1, $2, $3, $4, $5),
                parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                $1, $2, $3, $4, $5),
                website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,                $1, $2, $3, $4, $5)
        } ORDER BY is_primary DESC NULLS LAST, identity_primary_id, id) AS items
    FROM person_identities
    WHERE identity_primary_id IN (SELECT id FROM p_lim)
),
-- Bodies behind the page persons AND their identities (parliament labels + body facet).
b_ids AS (
        SELECT DISTINCT body_id AS id FROM p_lim WHERE body_id IS NOT NULL
    UNION
        SELECT DISTINCT body_id FROM person_identities
        WHERE identity_primary_id IN (SELECT id FROM p_lim) AND body_id IS NOT NULL
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
    { total_count: CAST(p_agg.total_count AS INTEGER),  items: COALESCE(p_agg.items, []) }  AS people,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER),  items: COALESCE(b_agg.items, []) }  AS bodies
FROM p_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg;