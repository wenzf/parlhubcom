-- ============================================================================
-- interests_list.sql                    → ~/server/db/sql/interests/interests_list.sql
--
-- Top-level, paginated, localized DIRECTORY of declared interests (register-of-
-- interests entries) with server-side search / filter / sort — the /interests
-- catalogue. NOT scoped to one person: the scope is the whole `interests` table.
-- ONE row per interest; each row links to /interests/:id, to its holder
-- /people/:person_id (via the response-scoped `persons` lookup), and shows its
-- granting body (via the response-scoped `bodies` lookup).
--
-- runListPaginatedFiltered family (langs/limit/offset, filters $8+). Requires
-- macro_loc.sql on the same connection. Mirrors votings_list.sql: the single
-- list column `interests` plus two response-scoped lookups:
--   • persons (p.id = interest.person_id) — label + link each row's holder.
--   • bodies  (b.id = interest.body_id)   — label each row's granting body.
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   -- filters (mirror interestsCatalogDescriptor.toSqlParams order EXACTLY):
--   $8  VARCHAR  - search: interest name/short/abbrev/role/group + place  NULL = none
--   $9  VARCHAR  - payment 'paid'|'unpaid' (harmonized classifier)        NULL = any
--   $10 BOOLEAN  - ex_officio                                            NULL = any
--   $11 INTEGER  - body_id (the granting body PK)                        NULL = any
--   $12 DOUBLE   - begin_date >= (epoch-ms)                              NULL = open
--   $13 DOUBLE   - begin_date <= (epoch-ms)                              NULL = open
--   ORDER BY at i_lim + i_agg is the literal token /* __ORDER_BY__ */.
--
-- NOTE: payment is classified on the authoritative harmonized vocabulary
-- (type_payment_harmonized): 'paid' → paid; 'unpaid'|'honorary' → unpaid. Keep
-- this predicate in sync with person_interests_by_id.sql ($10) and the
-- classifyPayment() helper in the interest components.
--
-- Output columns
--   interests STRUCT { total_count, items }  PaginatedList<InterestClient> (filtered page).
--   persons   STRUCT { total_count, items }  PaginatedList<PersonClient> — response-scoped
--             LOOKUP of the people referenced by this page's interests (p.id =
--             interest.person_id), localized. Keyed client-side by id for row labels/links.
--   bodies    STRUCT { total_count, items }  PaginatedList<BodyClient> — response-scoped
--             LOOKUP of the bodies referenced by this page (b.id = interest.body_id).
-- ============================================================================

WITH
i_filtered AS (
    SELECT * FROM interests i
    WHERE
        ($8 IS NULL OR (
               contains(lower(coalesce(loc(name_de,              name_fr,              name_it,              NULL, NULL, $1, $2, $3, $4, $5), '')), lower($8))
            OR contains(lower(coalesce(loc(name_short_de,        name_short_fr,        name_short_it,        NULL, NULL, $1, $2, $3, $4, $5), '')), lower($8))
            OR contains(lower(coalesce(loc(name_abbreviation_de, name_abbreviation_fr, name_abbreviation_it, NULL, NULL, $1, $2, $3, $4, $5), '')), lower($8))
            OR contains(lower(coalesce(loc(role_name_de,         role_name_fr,         role_name_it,         NULL, NULL, $1, $2, $3, $4, $5), '')), lower($8))
            OR contains(lower(coalesce(loc(group_de,             group_fr,             group_it,             NULL, NULL, $1, $2, $3, $4, $5), '')), lower($8))
            OR contains(lower(coalesce(place, '')), lower($8))
        ))
      -- payment ($9): classify on the harmonized vocabulary (see header note).
      AND ($9 IS NULL OR (
            CASE $9
              WHEN 'unpaid' THEN lower(coalesce(type_payment_harmonized, '')) IN ('unpaid', 'honorary')
              WHEN 'paid'   THEN lower(coalesce(type_payment_harmonized, '')) = 'paid'
              ELSE TRUE
            END
      ))
      AND ($10 IS NULL OR ex_officio = $10)              -- ex_officio
      AND ($11 IS NULL OR body_id = $11)                 -- granting body PK
      AND ($12 IS NULL OR begin_date >= $12)             -- begin_date lower
      AND ($13 IS NULL OR begin_date <= $13)             -- begin_date upper
),
i_lim AS (
    SELECT * FROM i_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
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
            -- localized (LIST family langs $1..$5)
            "type":            loc(type_de,              type_fr,              type_it,              NULL, NULL, $1, $2, $3, $4, $5),
            name:              loc(name_de,              name_fr,              name_it,              NULL, NULL, $1, $2, $3, $4, $5),
            name_short:        loc(name_short_de,        name_short_fr,        name_short_it,        NULL, NULL, $1, $2, $3, $4, $5),
            "group":           loc(group_de,             group_fr,             group_it,             NULL, NULL, $1, $2, $3, $4, $5),
            name_abbreviation: loc(name_abbreviation_de, name_abbreviation_fr, name_abbreviation_it, NULL, NULL, $1, $2, $3, $4, $5),
            role_name:         loc(role_name_de,         role_name_fr,         role_name_it,         NULL, NULL, $1, $2, $3, $4, $5),
            type_payment:      loc(type_payment_de,      type_payment_fr,      type_payment_it,      NULL, NULL, $1, $2, $3, $4, $5)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM i_lim
),
-- Response-scoped holder lookup: the distinct people referenced by THIS page's
-- interests (p.id = interest.person_id). Small set (<= page size), localized $1..$5.
p_ids AS (
    SELECT DISTINCT person_id AS id FROM i_lim WHERE person_id IS NOT NULL
),
p_src AS (
    SELECT p.*, COUNT(*) OVER () AS _total
    FROM persons p
    INNER JOIN p_ids ON p.id = p_ids.id
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
            parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,              $1, $2, $3, $4, $5),
            party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,              $1, $2, $3, $4, $5),
            party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en, $1, $2, $3, $4, $5),
            website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,              $1, $2, $3, $4, $5),
            occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,              $1, $2, $3, $4, $5),
            marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,              $1, $2, $3, $4, $5),
            electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,              $1, $2, $3, $4, $5),
            function_latest:          loc(function_latest_de,          function_latest_fr,          function_latest_it,          function_latest_rm,          NULL,              $1, $2, $3, $4, $5)
        } ORDER BY id) AS items
    FROM p_src
),
-- Response-scoped body lookup: the distinct bodies referenced by THIS page's
-- interests (b.id = interest.body_id). Localized $1..$5.
b_ids AS (
    SELECT DISTINCT body_id AS id FROM i_lim WHERE body_id IS NOT NULL
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
    { total_count: CAST(i_agg.total_count AS INTEGER), items: COALESCE(i_agg.items, []) } AS interests,
    { total_count: CAST(p_agg.total_count AS INTEGER), items: COALESCE(p_agg.items, []) } AS persons,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM i_agg, p_agg, b_agg;
