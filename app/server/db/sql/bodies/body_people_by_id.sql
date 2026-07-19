-- ============================================================================
-- body_people_by_id.sql
--
-- Paginated, localized DIRECTORY of the people linked to ONE body (parliament /
-- canton / communal institution), IDENTITY-AWARE: a primary person is included
-- when their primary `persons` row OR any sibling `person_identities` row has
-- body_id = $1 (the route body). Still ONE row per primary person (no
-- duplicates); each row links to the primary /people/:id. Adapted from
-- people_list.sql, but PERSON family ($1 = the body id at the scope slot, so it
-- runs through runPersonPaginatedFiltered) and the body facet is fixed to $1
-- instead of a URL value. Requires macro_loc.sql on the same connection.
--
-- Parameters
--   $1     INTEGER  - the body id (scope; matched on the claim's body_id)
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7     INTEGER  - page size  (LIMIT)
--   $8     INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror bodyPeopleDescriptor.toSqlParams; matched on the body claim):
--   $9   VARCHAR  - search (fullname / firstname / lastname / city / postal_code)  NULL = none
--   $10  BOOLEAN  - active (in this body)                                          NULL = any
--   $11  VARCHAR  - gender                                                         NULL = any
--   $12  VARCHAR  - party_harmonized_wikidata_id (stable party key)                NULL = any
--   $13  INTEGER  - chamber (groups.id): person has a membership in that group     NULL = any
--   ORDER BY at p_lim + p_agg is the literal token /* __ORDER_BY__ */.
--
-- Output columns (extends people_list.sql with the route body itself)
--   body              STRUCT  the single localized route body (for the BodyBase
--                             header in the layout; same shape as body_by_id.sql).
--                             ZERO rows when no body matches $1.
--   people            STRUCT { total_count, items }  PaginatedList<PersonClient> (filtered page)
--   person_identities STRUCT { total_count, items }  IdentityClient; the page persons' sibling
--                             identities (their OTHER mandates), for the "also active in" display.
--   bodies            STRUCT { total_count, items }  BodyClient; bodies behind the page persons
--                             AND their identities (for parliament labels).
--   chambers          LIST    the body's voting chambers (chamber-list rule, same as
--                             body_votings_by_id.sql) + active-membership seat counts.
--   chamber_members   STRUCT { total_count, items }  per-chamber active rosters (via
--                             memberships), ONLY for multi-chamber bodies (else empty) —
--                             one hemicycle per chamber. Members carry `chamber_id`.
--   executives        LIST    active `council_executive` groups with active members
--                             (CH: Bundesrat · 7) — shown separately, never in a hemicycle.
--   members           STRUCT  jurisdiction-wide active roster (persons.body_id = $1 AND
--                             active), ONLY for single-chamber bodies (else empty) — the
--                             legacy single seat diagram. Membership data below the federal
--                             level is too patchy to scope it per council there.
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
          AND c.body_id = $1                                  -- linked to THIS body (primary OR sibling identity)
          AND ($9  IS NULL OR contains(lower(coalesce(c.fullname,    '')), lower($9))
                           OR contains(lower(coalesce(c.firstname,   '')), lower($9))
                           OR contains(lower(coalesce(c.lastname,    '')), lower($9))
                           OR contains(lower(coalesce(c.city,        '')), lower($9))
                           OR contains(lower(coalesce(c.postal_code, '')), lower($9)))
          AND ($10 IS NULL OR c.active = $10)                 -- active IN this body
          AND ($11 IS NULL OR c.gender = $11)
          AND ($12 IS NULL OR c.party_harmonized_wikidata_id = $12)
    )
    -- chamber facet: membership (any time) in that chamber group. memberships.person_id
    -- references the PRIMARY persons row, so no identity widening is needed here.
    AND ($13 IS NULL OR EXISTS (
        SELECT 1 FROM memberships mm
        WHERE mm.person_id = p.id AND mm.group_id = $13
    ))
),
-- The page slice (pagination unit = primary person row).
p_lim AS (
    SELECT * FROM p_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
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
                parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                  $2, $3, $4, $5, $6),
                party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                          NULL,                  $2, $3, $4, $5, $6),
                party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                          party_harmonized_en, $2, $3, $4, $5, $6),
                website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                          NULL,                  $2, $3, $4, $5, $6),
                occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                          NULL,                  $2, $3, $4, $5, $6),
                marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                          NULL,                  $2, $3, $4, $5, $6),
                electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                          NULL,                  $2, $3, $4, $5, $6),
                function_latest:          loc(function_latest_de,          function_latest_fr,          function_latest_it,          function_latest_rm,          NULL,                  $2, $3, $4, $5, $6)
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
                party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,                $2, $3, $4, $5, $6),
                party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en, $2, $3, $4, $5, $6),
                occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,                $2, $3, $4, $5, $6),
                marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,                $2, $3, $4, $5, $6),
                electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,                $2, $3, $4, $5, $6),
                parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                $2, $3, $4, $5, $6),
                website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,                $2, $3, $4, $5, $6)
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
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
),
-- The body's voting chambers (chamber-list rule, identical to body_votings_by_id
-- / body_alignment_by_id): active legislative-council groups of THIS body that
-- actually appear on votings — drops duplicate/historical/noise council rows.
-- `seats` = active membership headcount (memberships, NOT persons.active).
ch AS (
    SELECT
        g.id,
        loc(g.name_de,         g.name_fr,         g.name_it,         g.name_rm,         NULL, $2, $3, $4, $5, $6) AS name,
        loc(g.abbreviation_de, g.abbreviation_fr, g.abbreviation_it, g.abbreviation_rm, NULL, $2, $3, $4, $5, $6) AS abbreviation,
        (SELECT count(DISTINCT m.person_id) FROM memberships m
          WHERE m.group_id = g.id AND m.active)::INTEGER AS seats
    FROM groups g
    WHERE g.body_id = $1
      AND g.type_harmonized = 'council_legislative'
      AND g.active
      AND EXISTS (SELECT 1 FROM votings vv WHERE vv.body_id = $1 AND vv.group_id = g.id)
),
ch_agg AS (
    SELECT list({ id: id, name: name, abbreviation: abbreviation, seats: seats } ORDER BY id) AS items
    FROM ch
),
-- Per-chamber ACTIVE rosters via memberships — one hemicycle per chamber. Only
-- for multi-chamber bodies (CH federal): below that, membership data is patchy
-- (several cantons have none / stale rows), so single-chamber bodies keep the
-- jurisdiction-wide m_agg roster instead. memberships.person_id = primary
-- persons.id (verified: 252/253 exact fullname matches on the CH councils).
cm AS (
    SELECT DISTINCT
        m.group_id AS chamber_id,
        p.id, p.fullname, p.party_harmonized_wikidata_id,
        p.parliament_seat, p.parliament_sector,
        loc(p.party_de,                    p.party_fr,                    p.party_it,                    NULL,                          NULL, $2, $3, $4, $5, $6) AS party,
        loc(p.parliamentary_group_name_de, p.parliamentary_group_name_fr, p.parliamentary_group_name_it, p.parliamentary_group_name_rm, NULL, $2, $3, $4, $5, $6) AS parliamentary_group_name
    FROM memberships m
    JOIN persons p ON p.id = m.person_id
    WHERE m.active
      AND m.group_id IN (SELECT id FROM ch)
      AND (SELECT count(*) FROM ch) >= 2
),
cm_agg AS (
    SELECT
        count(*) AS total_count,
        list({
                chamber_id:                   chamber_id,
                id:                           id,
                fullname:                     fullname,
                party_harmonized_wikidata_id: party_harmonized_wikidata_id,
                parliament_seat:              parliament_seat,
                parliament_sector:            parliament_sector,
                party:                        party,
                parliamentary_group_name:     parliamentary_group_name
        } ORDER BY chamber_id, id) AS items
    FROM cm
),
-- Active executive councils with active members (CH: Bundesrat) — displayed as a
-- separate count, NEVER mixed into a chamber hemicycle.
ex_agg AS (
    SELECT list({ id: id, name: name, abbreviation: abbreviation, seats: seats } ORDER BY id) AS items
    FROM (
        SELECT
            g.id,
            loc(g.name_de,         g.name_fr,         g.name_it,         g.name_rm,         NULL, $2, $3, $4, $5, $6) AS name,
            loc(g.abbreviation_de, g.abbreviation_fr, g.abbreviation_it, g.abbreviation_rm, NULL, $2, $3, $4, $5, $6) AS abbreviation,
            (SELECT count(DISTINCT m.person_id) FROM memberships m
              WHERE m.group_id = g.id AND m.active)::INTEGER AS seats
        FROM groups g
        WHERE g.body_id = $1
          AND g.type_harmonized = 'council_executive'
          AND g.active
    )
    WHERE seats > 0
),
-- ALL active members affiliated to THIS body (identity-aware), UNPAGINATED — the
-- full roster for the single seat diagram. A primary person is included iff some
-- claim has body_id = $1 AND active. Chart-only fields (no localized free-text
-- beyond party + group name). NO offset/limit, NO descriptor filters. SKIPPED
-- for multi-chamber bodies (the per-chamber cm_agg rosters replace it there).
m_filtered AS (
    SELECT p.* FROM persons p
    WHERE (SELECT count(*) FROM ch) < 2
      AND EXISTS (
        SELECT 1 FROM claims c
        WHERE c.primary_id = p.id
          AND c.body_id = $1
          AND c.active = TRUE
    )
),
m_agg AS (
    SELECT
        (SELECT count(*) FROM m_filtered) AS total_count,
        list({
                id:                           id,
                fullname:                     fullname,
                party_harmonized_wikidata_id: party_harmonized_wikidata_id,
                parliament_seat:              parliament_seat,
                parliament_sector:            parliament_sector,
                party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL, $2, $3, $4, $5, $6),
                parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL, $2, $3, $4, $5, $6)
        }) AS items
    FROM m_filtered
),
bd AS (
    SELECT
        body_struct(bodies, $2, $3, $4, $5, $6) AS body
    FROM bodies WHERE id = $1
)
SELECT
    bd.body AS body,
    { total_count: CAST(p_agg.total_count AS INTEGER),  items: COALESCE(p_agg.items, []) }  AS people,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER),  items: COALESCE(b_agg.items, []) }  AS bodies,
    { total_count: CAST(m_agg.total_count AS INTEGER),  items: COALESCE(m_agg.items, []) }  AS members,
    COALESCE(ch_agg.items, []) AS chambers,
    { total_count: CAST(cm_agg.total_count AS INTEGER), items: COALESCE(cm_agg.items, []) } AS chamber_members,
    COALESCE(ex_agg.items, []) AS executives
FROM p_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg
CROSS JOIN bd
CROSS JOIN m_agg
CROSS JOIN ch_agg
CROSS JOIN cm_agg
CROSS JOIN ex_agg;