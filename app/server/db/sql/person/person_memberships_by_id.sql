-- ============================================================================
-- person_memberships_by_id.sql
--
-- One person (full, localized) + a single PAGINATED related list: memberships,
-- COLLECTED BY GROUP. Companion to person_by_id.sql; requires macro_loc.sql on
-- the same connection.
--
-- Parameters
--   $1  INTEGER  - person primary key
--   $2..$6 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7  INTEGER  - page size  (LIMIT) -- counts GROUPS, not membership rows
--   $8  INTEGER  - page start (OFFSET; the `from` index, 0-based) -- in GROUPS
--   -- search / filter / sort (row-level predicates, applied in `mem_filtered`):
--   $9  VARCHAR  - search (group_name / role_name / type_harmonized, localized)  NULL = none
--   $10 VARCHAR  - type_harmonized (bare code)                                   NULL = any
--   $11 BOOLEAN  - active                                                        NULL = any
--   $12 INTEGER  - body_id                                                       NULL = any
--   $13 DOUBLE   - begin_date >= (epoch ms)                                      NULL = open lower
--   $14 DOUBLE   - begin_date <= (epoch ms)                                      NULL = open upper
--   The ORDER BY at the two GROUP-level sites (mg_lim, m_agg) is the literal token
--   /* __ORDER_BY__ */, spliced by the runner from the descriptor's allowlist.
--
-- Output columns
--   persons STRUCT                                     - PersonClientSchema (flat)
--   membership_groups STRUCT { total_count, items }    - MembershipGroupClientSchema,
--                                                        paginated BY GROUP. Each item
--                                                        is one group { group_id,
--                                                        group_name, roles[] } where
--                                                        roles is every membership the
--                                                        person holds in that group
--                                                        across the WHOLE history
--                                                        (MembershipClientSchema[]).
--   person_identities STRUCT { total_count, items }    - IdentityClientSchema
--   bodies STRUCT { total_count, items }               - BodyClientSchema
--   groups STRUCT { total_count, items }               - GroupClientSchema, response-scoped
--                                                        (groups.id = the group_ids on the
--                                                         returned group page mg_lim)
--
-- Grouping (the unit of pagination)
--   A person can hold SEVERAL memberships in the SAME group over time (member,
--   then president, …). Rows are collapsed to ONE block per group_id, carrying
--   all of that group's roles (NULL-group rows stay one block per row — there is
--   no group to collect them under). total_count is the DISTINCT-GROUP count and
--   the page slice (LIMIT/OFFSET) is over GROUPS, so a group's full role history
--   is never split across a page boundary. Blocks are ordered by their most
--   recent role's begin_date (newest first); roles within a block likewise.
--
-- Identity scope
--   The set (and its total_count) is WIDENED to the person's whole identity
--   group via the shared sibling_ids($1) macro (macro_loc.sql): it scopes to
--   person_id IN (SELECT person_id FROM sibling_ids($1)), so rows recorded under
--   any sibling identity are included. Collapses to {$1} when there are none.
-- ============================================================================

WITH
-- All of the person's memberships (whole identity set), with localized fields
-- resolved per row and a stable grouping key: the group_id when present, else a
-- per-row key so group-less memberships never merge.
mem AS (
    SELECT
        id, body_id, body_key, person_id, person_fullname, group_id, external_id,
        begin_date, end_date, active, type_harmonized, type_harmonized_oparl_id,
        created_at, updated_at, updated_external_at,
        loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $2, $3, $4, $5, $6) AS type_harmonized_loc,
        loc(group_name_de,      group_name_fr,      group_name_it,      NULL,               NULL,               $2, $3, $4, $5, $6) AS group_name_loc,
        loc(role_name_de,       role_name_fr,       role_name_it,       NULL,               NULL,               $2, $3, $4, $5, $6) AS role_name_loc,
        loc(type_external_de,   type_external_fr,   type_external_it,   NULL,               NULL,               $2, $3, $4, $5, $6) AS type_external_loc,
        COALESCE('g:' || CAST(group_id AS VARCHAR), 'r:' || CAST(id AS VARCHAR)) AS grp_key
    FROM memberships
    WHERE person_id IN (SELECT person_id FROM sibling_ids($1))
),
-- Row-level predicates. Each ($n IS NULL OR …) clause is a no-op when its slot is
-- NULL (filter disabled), so the prepared statement stays static. Search scans the
-- localized group_name / role_name / type_harmonized aliases; the type facet keys
-- off the BARE `type_harmonized` code; active/body/begin_date are plain columns.
mem_filtered AS (
    SELECT * FROM mem
    WHERE ($9  IS NULL OR contains(lower(coalesce(group_name_loc,      '')), lower($9))
                       OR contains(lower(coalesce(role_name_loc,       '')), lower($9))
                       OR contains(lower(coalesce(type_harmonized_loc, '')), lower($9)))
      AND ($10 IS NULL OR type_harmonized = $10)
      AND ($11 IS NULL OR active = $11)
      AND ($12 IS NULL OR body_id = $12)
      AND ($13 IS NULL OR begin_date >= $13)
      AND ($14 IS NULL OR begin_date <= $14)
),
-- One row per group: its roles aggregated (newest first) and a sort key (the
-- group's most recent role begin_date).
mg AS (
    SELECT
        grp_key,
        any_value(group_id)       AS group_id,
        any_value(group_name_loc) AS group_name,
        max(begin_date)           AS latest_begin,
        max(end_date)             AS latest_end,   -- GROUP-level sort key (sort key: end)
        bool_or(active)           AS any_active,    -- GROUP-level sort key (sort key: active)
        max(id)                   AS id,            -- per-group id; resolves the `, id DESC` tiebreak resolveOrderBy appends
        list({
            id:                       id,
            body_id:                  body_id,
            body_key:                 body_key,
            person_id:                person_id,
            person_fullname:          person_fullname,
            group_id:                 group_id,
            external_id:              external_id,
            begin_date:               begin_date,
            end_date:                 end_date,
            active:                   active,
            type_harmonized_oparl_id: type_harmonized_oparl_id,
            created_at:               created_at,
            updated_at:               updated_at,
            updated_external_at:      updated_external_at,
            -- localized (resolved in `mem`)
            type_harmonized: type_harmonized_loc,
            -- bare harmonized CODE (matches the `type` facet's $10 value; the
            -- component injects facet options from this via withCodeOptions,
            -- labelled by the localized type_harmonized above).
            type_harmonized_code: type_harmonized,
            group_name:      group_name_loc,
            role_name:       role_name_loc,
            type_external:   type_external_loc
        } ORDER BY begin_date DESC NULLS LAST) AS roles
    FROM mem_filtered
    GROUP BY grp_key
),
-- The GROUP page slice (pagination unit = group).
mg_lim AS (
    SELECT * FROM mg
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
m_agg AS (
    SELECT
        (SELECT count(*) FROM mg) AS total_count,  -- distinct MATCHING-group count (mg is over mem_filtered)
        list({
            group_id:   group_id,
            group_name: group_name,
            roles:      roles
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM mg_lim
)
, b_ids AS (
        SELECT body_id AS id   FROM persons           WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = $1 AND body_id IS NOT NULL
    UNION
        -- bodies of the (matching) memberships whose GROUP is on the current page
        SELECT body_id         FROM mem_filtered WHERE grp_key IN (SELECT grp_key FROM mg_lim) AND body_id IS NOT NULL
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
-- GROUPS  (GroupClientSchema) — response-scoped
--   Only the groups on the current GROUP page (groups.id = mg_lim.group_id —
--   NOT the person's full membership history). Mirrors the gr_ids→gr_src→gr_agg
--   chain in person_by_id.sql, narrowed to the page slice.
-- ──────────────────────────────────────────────────────────────────────────────
gr_ids AS (
    SELECT DISTINCT group_id AS id FROM mg_lim WHERE group_id IS NOT NULL
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
    { total_count: CAST(m_agg.total_count AS INTEGER), items: COALESCE(m_agg.items, []) } AS membership_groups,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies, -- added
    { total_count: CAST(gr_agg.total_count AS INTEGER), items: COALESCE(gr_agg.items, []) } AS groups  -- added
FROM persons p
CROSS JOIN m_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg  -- added
CROSS JOIN gr_agg  -- added
WHERE p.id = $1;