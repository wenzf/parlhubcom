-- ============================================================================
-- person_votes_by_id.sql   (search / filter / sort enabled)
--
-- One person (full, localized) + paginated `votes` + the person's identity group.
--
-- ROOT ARRAYS for the votes ON THIS PAGE (each `{ total_count, items[] }`,
-- mirroring person_by_id.sql; scoped via pg_votings so they cover only the
-- response's votes, never the full history):
--   groups   ← votings.group_id   (GroupClientSchema)
--   meetings ← votings.meeting_id  (MeetingClientSchema)
--   affairs  ← votings.affair_id   (AffairClientSchema)
--
-- SEARCH / FILTER / SORT (mirrors person_interests_by_id.sql):
--   Each vote is JOINED to its voting up-front (v_joined) so the predicates and
--   the ORDER BY can reference the voting's title / affair title / date / body.
--   v_filtered applies the optional, NULL-disabled predicates; v_lim is the
--   ordered + paginated slice; v_agg's total_count counts the FILTERED set.
--   ORDER BY is the only templated SQL: the token /* __ORDER_BY__ */ (at BOTH
--   the v_lim slice and the v_agg list) is replaced at runtime by a whitelisted
--   fragment from the descriptor (resolveOrderBy). With every filter slot NULL
--   and the default order, this collapses to the original clustered read.
--
-- IDENTITY HANDLING: the `pi_agg` CTE + `person_identities` output are additive
--   (copied from person_by_id.sql); the vote list still scopes to person_id = $1.
--   OPTIONAL widen-to-all-identities: uncomment the `sibling_ids` CTE and swap the
--   `WHERE person_id = $1` in v_joined for `IN (SELECT person_id FROM sibling_ids)`.
--
-- Parameters
--   $1  INTEGER   - person primary key (PRIMARY id; identities group on it)
--   $2..$6 VARCHAR - language priority codes
--   $7  INTEGER   - page size (LIMIT)
--   $8  INTEGER   - page start (OFFSET)
--   -- filter slots (all optional; NULL = disabled). Order MUST match
--   -- votesDescriptor.toSqlParams in dimension_descriptors.ts:
--   $9  VARCHAR   - search term         (voting.title / voting.affair_title; NULL = no search)
--   $10 VARCHAR   - vote   'yes'|'no'    (NULL = any)            → votes.vote
--   $11 INTEGER   - body_id              (NULL = any)            → votes.body_id
--   $12 DOUBLE    - voting.date >= epoch ms (NULL = open lower bound)
--   $13 DOUBLE    - voting.date <= epoch ms (NULL = open upper bound)
-- ============================================================================

WITH
-- [WIDEN] uncomment to span all sibling identities:
-- sibling_ids AS (
--     SELECT $1 AS person_id
--     UNION
--     SELECT id FROM person_identities WHERE identity_primary_id = $1
-- ),

-- Join each vote to its voting up-front, flattening the voting columns to vt_*
-- so the filter/search/sort can reference them. `body_id` (unqualified) stays the
-- VOTE's body (what the bodies lookup keys on); vt_body_id is the voting's body.
v_joined AS (
    SELECT
        v.*,
        vt.id                       AS vt_id,
        vt.body_id                  AS vt_body_id,
        vt.body_key                 AS vt_body_key,
        vt.external_id              AS vt_external_id,
        vt.date                     AS vt_date,
        vt.external_alternative_id  AS vt_external_alternative_id,
        vt.affair_id                AS vt_affair_id,
        vt.results_yes              AS vt_results_yes,
        vt.results_no               AS vt_results_no,
        vt.results_abstention       AS vt_results_abstention,
        vt.results_absent           AS vt_results_absent,
        vt.results_string           AS vt_results_string,
        vt.decision                 AS vt_decision,
        vt.meeting_id               AS vt_meeting_id,
        vt.group_id                 AS vt_group_id,
        vt.group_external_id        AS vt_group_external_id,
        vt.created_at               AS vt_created_at,
        vt.updated_at               AS vt_updated_at,
        vt.updated_external_at      AS vt_updated_external_at,
        vt.title_de                 AS vt_title_de,
        vt.title_fr                 AS vt_title_fr,
        vt.title_it                 AS vt_title_it,
        vt.url_external_de          AS vt_url_external_de,
        vt.url_external_fr          AS vt_url_external_fr,
        vt.url_external_it          AS vt_url_external_it,
        vt.type_de                  AS vt_type_de,
        vt.type_fr                  AS vt_type_fr,
        vt.type_it                  AS vt_type_it,
        vt.meaning_of_yes_de        AS vt_meaning_of_yes_de,
        vt.meaning_of_yes_fr        AS vt_meaning_of_yes_fr,
        vt.meaning_of_yes_it        AS vt_meaning_of_yes_it,
        vt.meaning_of_no_de         AS vt_meaning_of_no_de,
        vt.meaning_of_no_fr         AS vt_meaning_of_no_fr,
        vt.meaning_of_no_it         AS vt_meaning_of_no_it,
        vt.affair_title_de          AS vt_affair_title_de,
        vt.affair_title_fr          AS vt_affair_title_fr,
        vt.affair_title_it          AS vt_affair_title_it
    FROM votes v
    LEFT JOIN votings vt ON vt.id = v.voting_id
    WHERE v.person_id = $1                  -- [WIDEN] -> IN (SELECT person_id FROM sibling_ids)
),

-- Optional, NULL-disabled predicates. Same set as the descriptor's $9..$13 map.
v_filtered AS (
    SELECT * FROM v_joined
    WHERE
        -- $9 search: voting title OR affair title (localized), case-insensitive substring
        ($9 IS NULL OR (
                 contains(lower(coalesce(loc(vt_title_de,        vt_title_fr,        vt_title_it,        NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9))
              OR contains(lower(coalesce(loc(vt_affair_title_de, vt_affair_title_fr, vt_affair_title_it, NULL, NULL, $2, $3, $4, $5, $6), '')), lower($9))
        ))
        -- $10 the person's vote ('yes' | 'no')
        AND ($10 IS NULL OR vote = $10)
        -- $11 body (the vote's body_id — matches the bodies lookup options)
        AND ($11 IS NULL OR body_id = $11)
        -- $12/$13 voting.date range (epoch ms)
        AND ($12 IS NULL OR vt_date >= $12)
        AND ($13 IS NULL OR vt_date <= $13)
),

-- Ordered + paginated slice. ORDER BY is the templated token (resolveOrderBy);
-- the sort sqlExprs reference vt_date / loc(vt_title_*) / id (= votes.id).
v_lim AS (
    SELECT * FROM v_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),

-- The votings behind the votes ON THIS PAGE (from the already-flattened vt_*),
-- single source for the group / meeting / affair id-sets below.
pg_votings AS (
    SELECT DISTINCT vt_id AS id, vt_group_id AS group_id, vt_meeting_id AS meeting_id, vt_affair_id AS affair_id
    FROM v_lim
    WHERE vt_id IS NOT NULL
),

-- total_count is the FILTERED count (tracks the predicates); items are built
-- directly from v_lim (vt_* already present, no re-join needed).
v_agg AS (
    SELECT
        (SELECT count(*) FROM v_filtered) AS total_count,
        list({
            id:                 id,
            body_id:            body_id,
            body_key:           body_key,
            external_id:        external_id,
            voting_id:          voting_id,
            voting_external_id: voting_external_id,
            person_id:          person_id,
            vote:               vote,
            person_fullname:    person_fullname,
            created_at:         created_at,
            -- localized vote fields
            vote_display:                    loc(vote_display_de,                    vote_display_fr,                    vote_display_it,                    NULL,                               NULL, $2, $3, $4, $5, $6),
            person_party:                    loc(person_party_de,                    person_party_fr,                    person_party_it,                    person_party_rm,                    NULL, $2, $3, $4, $5, $6),
            person_parliamentary_group_name: loc(person_parliamentary_group_name_de, person_parliamentary_group_name_fr, person_parliamentary_group_name_it, person_parliamentary_group_name_rm, NULL, $2, $3, $4, $5, $6),
            -- embedded voting (VotingClientSchema); join-miss yields a struct of nulls
            voting: {
                id:                      vt_id,
                body_id:                 vt_body_id,
                body_key:                vt_body_key,
                external_id:             vt_external_id,
                date:                    vt_date,
                external_alternative_id: vt_external_alternative_id,
                affair_id:               vt_affair_id,
                results_yes:             vt_results_yes,
                results_no:              vt_results_no,
                results_abstention:      vt_results_abstention,
                results_absent:          vt_results_absent,
                results_string:          vt_results_string,
                decision:                vt_decision,
                meeting_id:              vt_meeting_id,
                group_id:                vt_group_id,
                group_external_id:       vt_group_external_id,
                created_at:              vt_created_at,
                updated_at:              vt_updated_at,
                updated_external_at:     vt_updated_external_at,
                -- localized voting fields
                title:          loc(vt_title_de,          vt_title_fr,          vt_title_it,          NULL, NULL, $2, $3, $4, $5, $6),
                url_external:   loc(vt_url_external_de,   vt_url_external_fr,   vt_url_external_it,   NULL, NULL, $2, $3, $4, $5, $6),
                "type":         loc(vt_type_de,           vt_type_fr,           vt_type_it,           NULL, NULL, $2, $3, $4, $5, $6),
                meaning_of_yes: loc(vt_meaning_of_yes_de, vt_meaning_of_yes_fr, vt_meaning_of_yes_it, NULL, NULL, $2, $3, $4, $5, $6),
                meaning_of_no:  loc(vt_meaning_of_no_de,  vt_meaning_of_no_fr,  vt_meaning_of_no_it,  NULL, NULL, $2, $3, $4, $5, $6),
                affair_title:   loc(vt_affair_title_de,   vt_affair_title_fr,   vt_affair_title_it,   NULL, NULL, $2, $3, $4, $5, $6)
            }
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM v_lim
),

-- ── BODIES (added; mirrors person_by_id.sql) ────────────────────────────────
b_ids AS (
        SELECT body_id AS id   FROM persons           WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM v_lim             WHERE body_id IS NOT NULL
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
),

-- ── GROUPS  (GroupClientSchema) — votings.group_id of the votes on this page ─
gr_ids AS (
    SELECT DISTINCT group_id AS id FROM pg_votings WHERE group_id IS NOT NULL
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
),

-- ── MEETINGS  (MeetingClientSchema) — votings.meeting_id of those votes ──────
mt_ids AS (
    SELECT DISTINCT meeting_id AS id FROM pg_votings WHERE meeting_id IS NOT NULL
),
mt_src AS (
    SELECT mt.*
    FROM meetings mt
    INNER JOIN mt_ids ON mt.id = mt_ids.id
),
mt_agg AS (
    SELECT
        COUNT(*) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            "type":              type,
            group_id:            group_id,
            parent_type:         parent_type,
            parent_external_id:  parent_external_id,
            parent_oparl_id:     parent_oparl_id,
            state:               state,
            abbreviation:        abbreviation,
            number:              number,
            begin_date:          begin_date,
            end_date:            end_date,
            location:            location,
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            -- localized
            name:          loc(name_de,          name_fr,          name_it,          name_rm, NULL, $2, $3, $4, $5, $6),
            description:   loc(description_de,   description_fr,   description_it,   NULL,    NULL, $2, $3, $4, $5, $6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL,    NULL, $2, $3, $4, $5, $6),
            url_external:  loc(url_external_de,  url_external_fr,  url_external_it,  url_external_rm, NULL, $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM mt_src
),

-- ── AFFAIRS  (AffairClientSchema) — votings.affair_id of those votes ─────────
af_ids AS (
    SELECT DISTINCT affair_id AS id FROM pg_votings WHERE affair_id IS NOT NULL
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
    { total_count: CAST(v_agg.total_count AS INTEGER), items: COALESCE(v_agg.items, []) } AS votes,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies,
    { total_count: CAST(af_agg.total_count AS INTEGER), items: COALESCE(af_agg.items, []) } AS affairs,
    { total_count: CAST(gr_agg.total_count AS INTEGER), items: COALESCE(gr_agg.items, []) } AS groups,
    { total_count: CAST(mt_agg.total_count AS INTEGER), items: COALESCE(mt_agg.items, []) } AS meetings
FROM persons p
CROSS JOIN v_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg
CROSS JOIN af_agg
CROSS JOIN gr_agg
CROSS JOIN mt_agg
WHERE p.id = $1;