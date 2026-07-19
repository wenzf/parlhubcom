-- ============================================================================
-- person_interests_by_id.sql
--
-- One person (full, localized) + a single PAGINATED related list: interests,
-- now with SERVER-SIDE search / filter / sort over the person's WHOLE set
-- (not just the visible page). Companion to person_by_id.sql; requires
-- macro_loc.sql on the same connection.
--
-- Parameters
--   $1  INTEGER  - person primary key
--   $2..$6 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7  INTEGER  - page size  (LIMIT)
--   $8  INTEGER  - page start (OFFSET; the `from` index, 0-based)
--   -- filter slots (all optional; NULL disables that predicate) --------------
--   $9  VARCHAR  - search term         (substring, case-insensitive; NULL = none)
--   $10 VARCHAR  - payment 'paid'|'unpaid'                     (NULL = any)
--   $11 BOOLEAN  - ex_officio                                  (NULL = any)
--   $12 INTEGER  - body_id                                     (NULL = any)
--   $13 DOUBLE   - begin_date >= (epoch millis)                (NULL = open)
--   $14 DOUBLE   - begin_date <= (epoch millis)                (NULL = open)
--
-- ORDER BY
--   The ORDER BY placeholder token (in i_lim AND the i_agg list) is replaced by
--   runPersonPaginatedFiltered() with a WHITELISTED fragment (descriptor sorts).
--   Default fragment: `begin_date DESC NULLS LAST, id DESC`.
--
-- Output columns
--   persons STRUCT                          - PersonClientSchema (flat)
--   interests STRUCT { total_count, items } - InterestClientSchema, paginated.
--     total_count is the FILTERED count (matches the rows the predicates select),
--     so "showing X of N" and the pager stay correct.
--
-- Identity scope
--   The list (and its count) is widened to the person's identity group via the
--   shared sibling_ids($1) macro. Collapses to {$1} when there are none.
--
-- Performance
--   With every filter slot NULL and the default ORDER BY, i_filtered's WHERE
--   collapses to just the person scope and the read stays on the
--   (person_id, begin_date DESC NULLS LAST) clustering — i.e. the original fast
--   path is preserved for the unfiltered case. Active filters/sorts trade that
--   for a predicate scan + sort over the (small) per-person block.
-- ============================================================================

WITH
-- All of the person's interests that satisfy the active predicates. Single
-- source for BOTH the page slice and the count, so total_count tracks the rows.
i_filtered AS (
    SELECT * FROM interests
    WHERE person_id IN (SELECT person_id FROM sibling_ids($1))
      -- search ($9): substring over the resolved localized text + place
      AND ($9 IS NULL OR (
               contains(lower(coalesce(loc(name_de,              name_fr,              name_it,              NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(loc(name_short_de,        name_short_fr,        name_short_it,        NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(loc(name_abbreviation_de, name_abbreviation_fr, name_abbreviation_it, NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(loc(role_name_de,         role_name_fr,         role_name_it,         NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(loc(group_de,             group_fr,             group_it,             NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(place, '')), lower($9))
      ))
      -- payment ($10): classify on the authoritative harmonized vocabulary.
      -- Known values: 'paid' → paid; 'honorary'/'unpaid' → unpaid. Extend the
      -- unpaid set here if more harmonized values appear (keep classifyPayment()
      -- in PersonInterests.tsx in sync).
      AND ($10 IS NULL OR (
            CASE $10
              WHEN 'unpaid' THEN lower(coalesce(type_payment_harmonized, '')) IN ('unpaid', 'honorary')
              WHEN 'paid'   THEN lower(coalesce(type_payment_harmonized, '')) = 'paid'
              ELSE TRUE
            END
      ))
      -- ex_officio ($11)
      AND ($11 IS NULL OR ex_officio = $11)
      -- granting body ($12): stable body PK (interests.body_id → bodies.id)
      AND ($12 IS NULL OR body_id = $12)
      -- begin_date range ($13 lower, $14 upper; epoch millis)
      AND ($13 IS NULL OR begin_date >= $13)
      AND ($14 IS NULL OR begin_date <= $14)
),
i_lim AS (
    SELECT * FROM i_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
i_agg AS (
    SELECT
        (SELECT count(*) FROM i_filtered) AS total_count,
        list({
            id:                      id,
            body_id:                 body_id,
            body_key:                body_key,
            person_id:               person_id,
            external_id:             external_id,
            begin_date:              begin_date,
            end_date:                end_date,
            ex_officio:              ex_officio,
            name_id:                 name_id,
            place:                   place,
            role_external_id:        role_external_id,
            type_external_id:        type_external_id,
            type_payment_harmonized: type_payment_harmonized,
            url:                     url,
            declaration_doc_title:   declaration_doc_title,
            declaration_doc_url:     declaration_doc_url,
            created_at:              created_at,
            updated_at:              updated_at,
            updated_external_at:     updated_external_at,
            -- localized
            "type":            loc(type_de,              type_fr,              type_it,              NULL, NULL, $2, $3, $4, $5, $6),
            name:              loc(name_de,              name_fr,              name_it,              NULL, NULL, $2, $3, $4, $5, $6),
            name_short:        loc(name_short_de,        name_short_fr,        name_short_it,        NULL, NULL, $2, $3, $4, $5, $6),
            "group":           loc(group_de,             group_fr,             group_it,             NULL, NULL, $2, $3, $4, $5, $6),
            name_abbreviation: loc(name_abbreviation_de, name_abbreviation_fr, name_abbreviation_it, NULL, NULL, $2, $3, $4, $5, $6),
            role_name:         loc(role_name_de,         role_name_fr,         role_name_it,         NULL, NULL, $2, $3, $4, $5, $6),
            type_payment:      loc(type_payment_de,      type_payment_fr,      type_payment_it,      NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM i_lim
)
, b_ids AS (
        SELECT body_id AS id   FROM persons           WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM i_lim             WHERE body_id IS NOT NULL
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
    { total_count: CAST(i_agg.total_count AS INTEGER), items: COALESCE(i_agg.items, []) } AS interests,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM persons p
CROSS JOIN i_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg
WHERE p.id = $1;