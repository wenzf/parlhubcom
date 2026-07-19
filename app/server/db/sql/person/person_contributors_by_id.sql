-- ============================================================================
-- person_contributors_by_id.sql
--
-- One person (full, localized) + a single PAGINATED related list: contributors.
-- Companion to person_by_id.sql; requires macro_loc.sql on the same connection.
--
-- Parameters
--   $1  INTEGER  - person primary key
--   $2..$6 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7  INTEGER  - page size  (LIMIT)
--   $8  INTEGER  - page start (OFFSET; the `from` index, 0-based)
--   -- filter slots (all optional; NULL disables that predicate) --------------
--   $9  VARCHAR  - search term  (substring, case-insensitive; NULL = none) over
--                  the contribution's affair title / long title / state name
--                  (localized via loc()) + the plain affair number. Affair-less
--                  contributions never match.
--
-- ORDER BY
--   The ORDER BY placeholder token (in c_lim AND the c_agg list) is replaced by
--   runPersonPaginatedFiltered() with a WHITELISTED fragment (descriptor sorts).
--   Default fragment: `af_begin_date DESC NULLS LAST, id DESC`. Sortable columns:
--   role_harmonized (loc), af_type_harmonized (loc), af_begin_date, af_number —
--   the af_* ones come from the affair LEFT-JOINed/flattened in c_filtered.
--
-- Output columns
--   persons STRUCT                              - PersonClientSchema (flat)
--   contributors STRUCT { total_count, items }  - ContributorClientSchema, paginated.
--     total_count is the FILTERED count (matches the rows the search selects), so
--     "showing X of N" and the pager stay correct.
--   person_identities STRUCT { total_count, items } - IdentityClientSchema
--   bodies STRUCT { total_count, items }        - BodyClientSchema
--   affairs STRUCT { total_count, items }       - AffairClientSchema, response-scoped
--                                                 (affairs.id = contributors.affair_id)
--   groups STRUCT { total_count, items }        - GroupClientSchema, response-scoped
--                                                 (groups.id = contributors.group_id)
--   both response-scoped lists are limited to the returned page (c_lim)
--
-- Identity scope
--   The list (and its total_count) is WIDENED to the person's whole identity
--   group via the shared sibling_ids($1) macro (macro_loc.sql): it scopes to
--   person_id IN (SELECT person_id FROM sibling_ids($1)), so rows recorded under
--   any sibling identity are included. Collapses to {$1} when there are none.
--
-- Performance
--   With $9 NULL and the default ORDER BY, c_filtered's WHERE collapses to just
--   the person scope; the affair LEFT JOIN is keyed on affairs.id (PK), and the
--   read stays close to the (person_id, id) clustering. An active search/sort
--   trades that for a predicate scan + sort over the (small) per-person block.
-- ============================================================================

WITH
-- All of the person's contributions that satisfy the active predicates, with each
-- contribution's affair LEFT-JOINED and flattened to af_* so search/sort can reach
-- the affair's title + metadata. Contributions without an affair (session/news/
-- meeting/group rows) survive with null af_* — they sort NULLS LAST and don't match
-- an affair-title search. Single source for BOTH the page slice and the count, so
-- total_count tracks the rows.
c_filtered AS (
    SELECT
        c.*,
        af.begin_date         AS af_begin_date,
        af.number             AS af_number,
        af.type_harmonized_de AS af_type_harmonized_de,
        af.type_harmonized_fr AS af_type_harmonized_fr,
        af.type_harmonized_it AS af_type_harmonized_it,
        af.type_harmonized_rm AS af_type_harmonized_rm,
        af.type_harmonized_en AS af_type_harmonized_en
    FROM contributors c
    LEFT JOIN affairs af ON af.id = c.affair_id
    WHERE c.person_id IN (SELECT person_id FROM sibling_ids($1))
      -- search ($9): substring over the affair's localized title / long title /
      -- state, plus the plain affair number (e.g. "23.456").
      AND ($9 IS NULL OR (
               contains(lower(coalesce(loc(af.title_de,      af.title_fr,      af.title_it,      af.title_rm,      NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(loc(af.title_long_de, af.title_long_fr, af.title_long_it, af.title_long_rm, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(loc(af.state_name_de, af.state_name_fr, af.state_name_it, af.state_name_rm, NULL, $2, $3, $4, $5, $6), '')), lower($9))
            OR contains(lower(coalesce(af.number, '')), lower($9))
      ))
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
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            affair_id:           affair_id,
            news_id:             news_id,
            person_id:           person_id,
            group_id:            group_id,
            meeting_id:          meeting_id,
            session_id:          session_id,
            "type":              type,
            role_external_id:    role_external_id,
            firstname:           firstname,
            lastname:            lastname,
            fullname:            fullname,
            party_wikidata_id:   party_wikidata_id,
            "position":          position,
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            -- localized
            role:             loc(role_de,             role_fr,             role_it,             role_rm,            NULL,               $2, $3, $4, $5, $6),
            role_harmonized:  loc(role_harmonized_de,  role_harmonized_fr,  role_harmonized_it,  role_harmonized_rm, role_harmonized_en, $2, $3, $4, $5, $6),
            party:            loc(party_de,            party_fr,            party_it,            party_rm,           NULL,               $2, $3, $4, $5, $6),
            party_harmonized: loc(party_harmonized_de, party_harmonized_fr, party_harmonized_it, NULL,               NULL,               $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM c_lim
)
, b_ids AS (
        SELECT body_id AS id   FROM persons           WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM c_lim             WHERE body_id IS NOT NULL
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
, -- ──────────────────────────────────────────────────────────────────────────────
-- AFFAIRS  (AffairClientSchema) — response-scoped
--   Only affairs linked to the contributor rows actually returned on this page
--   (affairs.id = contributors.affair_id, sourced from c_lim — NOT full history).
-- ──────────────────────────────────────────────────────────────────────────────
af_ids AS (
    SELECT DISTINCT affair_id AS id FROM c_lim WHERE affair_id IS NOT NULL
),
af_src AS (
    SELECT af.*
    FROM affairs af
    INNER JOIN af_ids ON af.id = af_ids.id
),
af_agg AS (
    SELECT
        COUNT(*) AS total_count,
        list({
            id:                          id,
            body_id:                     body_id,
            body_key:                    body_key,
            number:                      number,
            external_id:                 external_id,
            external_alternative_id:     external_alternative_id,
            type_harmonized_id:          type_harmonized_id,
            type_harmonized_wikidata_id: type_harmonized_wikidata_id,
            state_name_harmonized_id:    state_name_harmonized_id,
            active:                      active,
            type_external_id:            type_external_id,
            state_external_id:           state_external_id,
            begin_date:                  begin_date,
            end_date:                    end_date,
            created_at:                  created_at,
            updated_at:                  updated_at,
            updated_external_at:         updated_external_at,
            -- localized
            type_harmonized:       loc(type_harmonized_de,       type_harmonized_fr,       type_harmonized_it,       type_harmonized_rm,       type_harmonized_en, $2, $3, $4, $5, $6),
            state_name_harmonized: loc(state_name_harmonized_de, state_name_harmonized_fr, state_name_harmonized_it, state_name_harmonized_rm, NULL,               $2, $3, $4, $5, $6),
            title:                 loc(title_de,                 title_fr,                 title_it,                 title_rm,                 NULL,               $2, $3, $4, $5, $6),
            title_long:            loc(title_long_de,            title_long_fr,            title_long_it,            title_long_rm,            NULL,               $2, $3, $4, $5, $6),
            type_name:             loc(type_name_de,             type_name_fr,             type_name_it,             type_name_rm,             NULL,               $2, $3, $4, $5, $6),
            state_name:            loc(state_name_de,            state_name_fr,            state_name_it,            state_name_rm,            NULL,               $2, $3, $4, $5, $6),
            url_external:          loc(url_external_de,          url_external_fr,          url_external_it,          url_external_rm,          NULL,               $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM af_src
),
-- ──────────────────────────────────────────────────────────────────────────────
-- GROUPS  (GroupClientSchema) — response-scoped
--   Only groups linked to the contributor rows actually returned on this page
--   (groups.id = contributors.group_id, sourced from c_lim — NOT full history).
-- ──────────────────────────────────────────────────────────────────────────────
gr_ids AS (
    SELECT DISTINCT group_id AS id FROM c_lim WHERE group_id IS NOT NULL
),
gr_src AS (
    SELECT gr.*
    FROM groups gr
    INNER JOIN gr_ids ON gr.id = gr_ids.id
),
gr_agg AS (
    SELECT
        COUNT(*) AS total_count,
        list({
            id:                          id,
            body_id:                     body_id,
            body_key:                    body_key,
            external_id:                 external_id,
            external_alternative_id:     external_alternative_id,
            type_harmonized_id:          type_harmonized_id,
            type_harmonized_position:    type_harmonized_position,
            type_harmonized_wikidata_id: type_harmonized_wikidata_id,
            active:                      active,
            type_external_id:            type_external_id,
            begin_date:                  begin_date,
            end_date:                    end_date,
            wikidata_id:                 wikidata_id,
            parent_group_external_id:    parent_group_external_id,
            child_group_external_id:     child_group_external_id,
            parent_council_external_id:  parent_council_external_id,
            contact:                     contact,
            created_at:                  created_at,
            updated_at:                  updated_at,
            updated_external_at:         updated_external_at,
            -- localized
            url_external:    loc(url_external_de,    url_external_fr,    url_external_it,    url_external_rm,    NULL,               $2, $3, $4, $5, $6),
            type_harmonized: loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $2, $3, $4, $5, $6),
            name:            loc(name_de,            name_fr,            name_it,            name_rm,            NULL,               $2, $3, $4, $5, $6),
            abbreviation:    loc(abbreviation_de,    abbreviation_fr,    abbreviation_it,    abbreviation_rm,    NULL,               $2, $3, $4, $5, $6),
            description:     loc(description_de,     description_fr,     description_it,     description_rm,     NULL,               $2, $3, $4, $5, $6),
            type_external:   loc(type_external_de,   type_external_fr,   type_external_it,   type_external_rm,   NULL,               $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM gr_src
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
    { total_count: CAST(c_agg.total_count AS INTEGER), items: COALESCE(c_agg.items, []) } AS contributors,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies, -- added
    { total_count: CAST(af_agg.total_count AS INTEGER), items: COALESCE(af_agg.items, []) } AS affairs, -- added
    { total_count: CAST(gr_agg.total_count AS INTEGER), items: COALESCE(gr_agg.items, []) } AS groups  -- added
FROM persons p
CROSS JOIN c_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg  -- added
CROSS JOIN af_agg  -- added
CROSS JOIN gr_agg  -- added
WHERE p.id = $1;