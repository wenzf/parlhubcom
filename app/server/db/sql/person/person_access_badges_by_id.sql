-- ============================================================================
-- person_access_badges_by_id.sql
--
-- One person (full, localized) + a single PAGINATED related list: access_badges.
-- Companion to person_by_id.sql; requires macro_loc.sql on the same connection.
--
-- Parameters
--   $1  INTEGER  - person primary key
--   $2..$6 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7  INTEGER  - page size  (LIMIT)
--   $8  INTEGER  - page start (OFFSET; the `from` index, 0-based)
--   -- filter slots (all optional; NULL disables that predicate) --------------
--   $9  VARCHAR  - search term  (beneficiary_person_fullname / beneficiary_group;
--                  substring, case-insensitive; NULL = none)
--   $10 VARCHAR  - type_harmonized  (stable code, e.g. 'lobbyist')   (NULL = any)
--   $11 INTEGER  - body_id                                           (NULL = any)
--   $12 DOUBLE   - valid_from >= (epoch millis)                      (NULL = open)
--   $13 DOUBLE   - valid_from <= (epoch millis)                      (NULL = open)
--
-- ORDER BY
--   The ORDER BY placeholder token (in a_lim AND the a_agg list) is replaced by
--   runPersonPaginatedFiltered() with a WHITELISTED fragment (descriptor sorts).
--   Default fragment: `valid_from DESC NULLS LAST, id DESC`.
--
-- Output columns
--   persons STRUCT                          - PersonClientSchema (flat)
--   access_badges STRUCT { total_count, items } - AccessBadgeClientSchema, paginated.
--     total_count is the FILTERED count (matches the rows the predicates select),
--     so "showing X of N" and the pager stay correct under active filters.
--
-- Identity scope
--   The list (and its total_count) is WIDENED to the person's whole identity
--   group via the shared sibling_ids($1) macro (macro_loc.sql): it scopes to
--   person_id IN (SELECT person_id FROM sibling_ids($1)), so rows recorded under
--   any sibling identity are included. Collapses to {$1} when there are none.
--
-- Performance
--   With every filter slot NULL and the default ORDER BY, a_filtered's WHERE
--   collapses to just the person scope and the read stays on the
--   (person_id, valid_from DESC NULLS LAST) clustering from db.server.ts — i.e.
--   the original fast path is preserved for the unfiltered case. Active
--   filters/sorts trade that for a predicate scan + sort over the (small)
--   per-person block. OFFSET only skips within the identity set's block(s).
-- ============================================================================

WITH
-- All of the person's access badges that satisfy the active predicates. Single
-- source for BOTH the page slice and the count, so total_count tracks the rows.
a_filtered AS (
    SELECT * FROM access_badges
    WHERE person_id IN (SELECT person_id FROM sibling_ids($1))
      -- search ($9): substring over the plain guest columns (not localized).
      AND ($9 IS NULL OR (
               contains(lower(coalesce(beneficiary_person_fullname, '')), lower($9))
            OR contains(lower(coalesce(beneficiary_group, '')), lower($9))
      ))
      -- type ($10): stable harmonized code (e.g. 'lobbyist'); never the localized type.
      AND ($10 IS NULL OR type_harmonized = $10)
      -- granting body ($11): stable body PK (access_badges.body_id → bodies.id)
      AND ($11 IS NULL OR body_id = $11)
      -- valid_from range ($12 lower, $13 upper; epoch millis)
      AND ($12 IS NULL OR valid_from >= $12)
      AND ($13 IS NULL OR valid_from <= $13)
),
a_lim AS (
    SELECT * FROM a_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
a_agg AS (
    SELECT
        (SELECT count(*) FROM a_filtered) AS total_count,
        list({
            id:                          id,
            body_id:                     body_id,
            body_key:                    body_key,
            person_id:                   person_id,
            person_external_id:          person_external_id,
            external_id:                 external_id,
            person_fullname:             person_fullname,
            beneficiary_person_id:       beneficiary_person_id,
            beneficiary_person_fullname: beneficiary_person_fullname,
            beneficiary_group:           beneficiary_group,
            type_harmonized:             type_harmonized,
            valid_from:                  valid_from,
            valid_to:                    valid_to,
            version:                     version,
            latest:                      latest,
            created_at:                  created_at,
            updated_at:                  updated_at,
            updated_external_at:         updated_external_at,
            -- localized
            "type": loc(type_de, type_fr, type_it, NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM a_lim
)
, b_ids AS (
        SELECT body_id AS id   FROM persons           WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM a_lim             WHERE body_id IS NOT NULL
),
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total, ROW_NUMBER() OVER (ORDER BY b.id) AS _rn
    FROM bodies b
    INNER JOIN b_ids ON b.id = b_ids.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
    WHERE _rn <= $7
),
pi_agg AS (
    SELECT
        (SELECT count(*) FROM person_identities WHERE identity_primary_id = $1) AS total_count,
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
        } ORDER BY is_primary DESC NULLS LAST, id) AS items
    FROM person_identities
    WHERE identity_primary_id = $1
)
SELECT
    {
        id:                              p.id,
        body_id:                         p.body_id,
        body_key:                        p.body_key,
        external_id:                     p.external_id,
        external_alternative_id:         p.external_alternative_id,
        firstname:                       p.firstname,
        lastname:                        p.lastname,
        fullname:                        p.fullname,
        birthday:                        p.birthday,
        birthday_format:                 p.birthday_format,
        deathday:                        p.deathday,
        gender:                          p.gender,
        party_external_id:               p.party_external_id,
        party_harmonized_wikidata_id:    p.party_harmonized_wikidata_id,
        parliamentary_group_external_id: p.parliamentary_group_external_id,
        image_url_external:              p.image_url_external,
        image_url_oparl:                 p.image_url_oparl,
        email:                           p.email,
        phone:                           p.phone,
        street:                          p.street,
        postal_code:                     p.postal_code,
        city:                            p.city,
        title:                           p.title,
        website_personal:                p.website_personal,
        parliament_sector:               p.parliament_sector,
        parliament_seat:                 p.parliament_seat,
        active:                          p.active,
        "language":                      p.language,
        function_latest_external_id:     p.function_latest_external_id,
        wikidata_id:                     p.wikidata_id,
        created_at:                      p.created_at,
        updated_at:                      p.updated_at,
        updated_external_at:             p.updated_external_at,
        -- localized
        parliamentary_group_name: loc(p.parliamentary_group_name_de, p.parliamentary_group_name_fr, p.parliamentary_group_name_it, p.parliamentary_group_name_rm, NULL,                  $2, $3, $4, $5, $6),
        party:                    loc(p.party_de,                    p.party_fr,                    p.party_it,                    NULL,                          NULL,                  $2, $3, $4, $5, $6),
        party_harmonized:         loc(p.party_harmonized_de,         p.party_harmonized_fr,         p.party_harmonized_it,         NULL,                          p.party_harmonized_en, $2, $3, $4, $5, $6),
        website_parliament_url:   loc(p.website_parliament_url_de,   p.website_parliament_url_fr,   p.website_parliament_url_it,   NULL,                          NULL,                  $2, $3, $4, $5, $6),
        occupation:               loc(p.occupation_de,               p.occupation_fr,               p.occupation_it,               NULL,                          NULL,                  $2, $3, $4, $5, $6),
        marital_status:           loc(p.marital_status_de,           p.marital_status_fr,           p.marital_status_it,           NULL,                          NULL,                  $2, $3, $4, $5, $6),
        electoral_district:       loc(p.electoral_district_de,       p.electoral_district_fr,       p.electoral_district_it,       NULL,                          NULL,                  $2, $3, $4, $5, $6),
        function_latest:          loc(p.function_latest_de,          p.function_latest_fr,          p.function_latest_it,          p.function_latest_rm,          NULL,                  $2, $3, $4, $5, $6)
    } AS persons,
    { total_count: CAST(a_agg.total_count AS INTEGER), items: COALESCE(a_agg.items, []) } AS access_badges,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies  -- added
FROM persons p
CROSS JOIN a_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg  -- added
WHERE p.id = $1;