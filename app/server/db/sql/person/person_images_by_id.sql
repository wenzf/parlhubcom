-- ============================================================================
-- person_images_by_id.sql   (sort + latest filter enabled)
--
-- One person (full, localized) + a single PAGINATED related list: person_images.
-- Companion to person_by_id.sql; requires macro_loc.sql on the same connection.
--
-- person_images is a VERSIONED image set: one row per image version a person has
-- had, each carrying up to four renditions (thumb/profile/oparl/source) plus
-- version / latest and a valid_from/valid_to window. The table has NO localized
-- columns, so there are no loc() calls in the image aggregate, and NO free-text
-- search (the descriptor sets `searchable: false`).
--
-- SORT / FILTER (mirrors the other dimensions; this is the simplest case):
--   pim_filtered applies the optional `latest` predicate on top of the identity
--   scope; pim_lim is the ordered + paginated slice; pim_agg's total_count counts
--   the FILTERED set. ORDER BY is the only templated SQL: the token
--   /* __ORDER_BY__ */ (at BOTH the slice and the agg list) is replaced at runtime
--   by a whitelisted fragment (resolveOrderBy). With the filter NULL and the
--   default order, this is the original valid_from-desc clustered read.
--
-- Parameters
--   $1  INTEGER  - person primary key
--   $2..$6 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7  INTEGER  - page size  (LIMIT)
--   $8  INTEGER  - page start (OFFSET; 0-based)
--   -- filter slots (NULL = disabled). Order MUST match imagesDescriptor.toSqlParams:
--   $9  BOOLEAN  - latest (is-current flag)   (NULL = any)
--
-- Identity scope: WIDENED to the person's whole identity group via sibling_ids($1)
--   (unchanged from before).
-- ============================================================================

WITH
pim_filtered AS (
    SELECT * FROM person_images
    WHERE person_id IN (SELECT person_id FROM sibling_ids($1))
      AND ($9 IS NULL OR latest = $9)        -- optional: current-version-only
),
pim_lim AS (
    SELECT * FROM pim_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
pim_agg AS (
    SELECT
        (SELECT count(*) FROM pim_filtered) AS total_count,
        list({
            id:          id,
            person_id:   person_id,
            source_url:  source_url,
            oparl_url:   oparl_url,
            profile_url: profile_url,
            thumb_url:   thumb_url,
            version:     version,
            latest:      latest,
            valid_from:  valid_from,
            valid_to:    valid_to
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM pim_lim
),
-- ── BODIES — only the header's body (person + identities); images carry no body_id
b_ids AS (
        SELECT body_id AS id   FROM persons           WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = $1 AND body_id IS NOT NULL
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
    { total_count: CAST(pim_agg.total_count AS INTEGER), items: COALESCE(pim_agg.items, []) } AS person_images,
    { total_count: CAST(pi_agg.total_count AS INTEGER),  items: COALESCE(pi_agg.items, []) }  AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER),   items: COALESCE(b_agg.items, []) }   AS bodies
FROM persons p
CROSS JOIN pim_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg
WHERE p.id = $1;