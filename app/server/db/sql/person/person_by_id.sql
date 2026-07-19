-- ============================================================================
-- person_full.sql
--
-- Fetches one person plus all their related data, fully localized.
-- Requires macros.sql to be executed first on the same connection.
--
-- Parameters
--   $1  INTEGER   — primary key of the person to fetch
--   $2..$6   VARCHAR   — language priority codes in order of preference
--                           ('de' | 'fr' | 'it' | 'rm' | 'en' | NULL)
--                           Pass NULL for unused slots.
--   $7      INTEGER   — max items returned per related-entity list
--
-- Output columns
--   persons           STRUCT   — PersonClientSchema (flat, single record)
--   membership_groups STRUCT   — { total_count, items[] }  MembershipGroupClientSchema
--                                  (memberships collected by group; roles nested)
--   access_badges     STRUCT   — { total_count, items[] }  AccessBadgeClientSchema
--   person_identities STRUCT   — { total_count, items[] }  IdentityClientSchema
--   person_images     STRUCT   — { total_count, items[] }  PersonImageSchema
--   interests         STRUCT   — { total_count, items[] }  InterestClientSchema
--   contributors      STRUCT   — { total_count, items[] }  ContributorClientSchema
--   votes             STRUCT   — { total_count, items[] }  VoteClientSchema (+ embedded voting)
--   speeches          STRUCT   — { total_count, items[] }  SpeechClientSchema
--   affairs           STRUCT   — { total_count, items[] }  AffairClientSchema
--   groups            STRUCT   — { total_count, items[] }  GroupClientSchema
--   meetings          STRUCT   — { total_count, items[] }  MeetingClientSchema
--   agendas           STRUCT   — { total_count, items[] }  AgendaSchema
--   bodies            STRUCT   — { total_count, items[] }  BodyClientSchema
--
-- Identity scope
--   Every related list (and its count) is scoped to the person's whole identity
--   group via the materialized `sib` CTE (same logic as the sibling_ids($1)
--   macro in macro_loc.sql) — person_id IN (SELECT person_id FROM sib) — so rows recorded under
--   any sibling identity are included. The derived id-sets (gr_ids, pv_votings)
--   widen the same way. person_identities / bodies were already group-aware.
--   Collapses to {$1} when the person has no identity rows.
--
-- Performance notes
--   • The sibling-id set is materialized ONCE (CTE `sib`) instead of inlining the
--     sibling_ids($1) macro ~16× — each related-list filter reads that one tiny
--     set rather than re-scanning person_identities + re-running the UNION dedup.
--   • All related-table CTEs filter to the `sib` set before any
--     windowing, so window functions operate over this person's rows only.
--   • COUNT(*) OVER () runs before QUALIFY/row-limit, giving the true total.
--   • The bodies set is built with a UNION of direct FK lookups — no CROSS JOIN
--     of all persons × all bodies.
--   • Each _agg CTE is a single scan + aggregate; the final SELECT is just
--     a CROSS JOIN of nine single-row results.
-- ============================================================================

WITH

-- ──────────────────────────────────────────────────────────────────────────────
-- 0. SIBLING SET  (materialized once)
--    The person-scope id set — the primary id plus every identity that groups
--    under it — evaluated EXACTLY ONCE for the whole query. Previously the
--    sibling_ids($1) table macro was inlined ~16× (every _lim slice and its
--    count(*) twin re-scanned person_identities and re-ran the UNION dedup).
--    AS MATERIALIZED forces a single evaluation; every related-list filter below
--    reads this tiny set instead. Collapses to {$1} when the person has no
--    identity rows, so behaviour is identical to the macro.
-- ──────────────────────────────────────────────────────────────────────────────
sib AS MATERIALIZED (
    SELECT $1 AS person_id
    UNION
    SELECT id FROM person_identities WHERE identity_primary_id = $1
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. MEMBERSHIPS  (MembershipGroupClientSchema) — COLLECTED BY GROUP
--    A person can hold several memberships in the SAME group over time (member,
--    then president, …). Rows are collapsed to ONE block per group_id, each
--    carrying that group's full role timeline; NULL-group rows stay one block per
--    row. The snippet takes the top $7 GROUPS (most recent first); total_count is
--    the DISTINCT-GROUP count. Matches person_memberships_by_id.sql (minus OFFSET).
-- ──────────────────────────────────────────────────────────────────────────────
mem AS (
    SELECT
        id, body_id, body_key, person_id, person_fullname, group_id, external_id,
        begin_date, end_date, active, type_harmonized_oparl_id,
        created_at, updated_at, updated_external_at,
        loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $2, $3, $4, $5, $6) AS type_harmonized_loc,
        loc(group_name_de,      group_name_fr,      group_name_it,      NULL,               NULL,               $2, $3, $4, $5, $6) AS group_name_loc,
        loc(role_name_de,       role_name_fr,       role_name_it,       NULL,               NULL,               $2, $3, $4, $5, $6) AS role_name_loc,
        loc(type_external_de,   type_external_fr,   type_external_it,   NULL,               NULL,               $2, $3, $4, $5, $6) AS type_external_loc,
        COALESCE('g:' || CAST(group_id AS VARCHAR), 'r:' || CAST(id AS VARCHAR)) AS grp_key
    FROM memberships
    WHERE person_id IN (SELECT person_id FROM sib)
),
mg AS (
    SELECT
        grp_key,
        any_value(group_id)       AS group_id,
        any_value(group_name_loc) AS group_name,
        max(begin_date)           AS latest_begin,
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
            group_name:      group_name_loc,
            role_name:       role_name_loc,
            type_external:   type_external_loc
        } ORDER BY begin_date DESC NULLS LAST) AS roles
    FROM mem
    GROUP BY grp_key
),
mg_lim AS (
    SELECT * FROM mg ORDER BY latest_begin DESC NULLS LAST LIMIT $7
),
m_agg AS (
    SELECT
        (SELECT count(*) FROM mg) AS total_count,  -- distinct-group count
        list({
            group_id:   group_id,
            group_name: group_name,
            roles:      roles
        } ORDER BY latest_begin DESC NULLS LAST) AS items
    FROM mg_lim
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. ACCESS BADGES  (AccessBadgeClientSchema)
-- ──────────────────────────────────────────────────────────────────────────────
a_lim AS (
    SELECT * FROM access_badges WHERE person_id IN (SELECT person_id FROM sib) ORDER BY valid_from DESC NULLS LAST LIMIT $7
),
a_agg AS (
    SELECT
        (SELECT count(*) FROM access_badges WHERE person_id IN (SELECT person_id FROM sib)) AS total_count,
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
        } ORDER BY valid_from DESC NULLS LAST) AS items
    FROM a_lim
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. PERSON IDENTITIES  (IdentityClientSchema)
-- ──────────────────────────────────────────────────────────────────────────────
pi_lim AS (
    SELECT * FROM person_identities WHERE identity_primary_id = $1 ORDER BY id LIMIT $7
),
pi_agg AS (
    SELECT
        (SELECT count(*) FROM person_identities WHERE identity_primary_id = $1) AS total_count,
        list({
            id:                          id,
            identity_primary_id:         identity_primary_id,
            body_id:                     body_id,
            body_key:                    body_key,
            external_id:                 external_id,
            fullname:                    fullname,
            firstname:                   firstname,
            lastname:                    lastname,
            party_harmonized_wikidata_id: party_harmonized_wikidata_id,
            image_url_external:          image_url_external,
            email:                       email,
            phone:                       phone,
            birthday:                    birthday,
            birthday_format:             birthday_format,
            deathday:                    deathday,
            street:                      street,
            postal_code:                 postal_code,
            city:                        city,
            title:                       title,
            website_personal:            website_personal,
            gender:                      gender,
            active:                      active,
            "language":                    language,
            wikidata_id:                 wikidata_id,
            is_primary:                  is_primary,
            created_at:                  created_at,
            updated_at:                  updated_at,
            updated_external_at:         updated_external_at,
            -- localized
            party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,                  $2, $3, $4, $5, $6),
            party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en,   $2, $3, $4, $5, $6),
            occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,                  $2, $3, $4, $5, $6),
            marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,                  $2, $3, $4, $5, $6),
            electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,                  $2, $3, $4, $5, $6),
            parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                  $2, $3, $4, $5, $6),
            website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,                  $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM pi_lim
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. PERSON IMAGES  (PersonImageSchema — no localized fields)
-- ──────────────────────────────────────────────────────────────────────────────
pim_lim AS (
    SELECT * FROM person_images WHERE person_id IN (SELECT person_id FROM sib) ORDER BY id LIMIT $7
),
pim_agg AS (
    SELECT
        (SELECT count(*) FROM person_images WHERE person_id IN (SELECT person_id FROM sib)) AS total_count,
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
        } ORDER BY id) AS items
    FROM pim_lim
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. INTERESTS  (InterestClientSchema)
-- ──────────────────────────────────────────────────────────────────────────────
i_lim AS (
    SELECT * FROM interests WHERE person_id IN (SELECT person_id FROM sib) ORDER BY begin_date DESC NULLS LAST LIMIT $7
),
i_agg AS (
    SELECT
        (SELECT count(*) FROM interests WHERE person_id IN (SELECT person_id FROM sib)) AS total_count,
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
            "type":              loc(type_de,              type_fr,              type_it,              NULL, NULL, $2, $3, $4, $5, $6),
            name:              loc(name_de,              name_fr,              name_it,              NULL, NULL, $2, $3, $4, $5, $6),
            name_short:        loc(name_short_de,        name_short_fr,        name_short_it,        NULL, NULL, $2, $3, $4, $5, $6),
            "group":             loc(group_de,             group_fr,             group_it,             NULL, NULL, $2, $3, $4, $5, $6),
            name_abbreviation: loc(name_abbreviation_de, name_abbreviation_fr, name_abbreviation_it, NULL, NULL, $2, $3, $4, $5, $6),
            role_name:         loc(role_name_de,         role_name_fr,         role_name_it,         NULL, NULL, $2, $3, $4, $5, $6),
            type_payment:      loc(type_payment_de,      type_payment_fr,      type_payment_it,      NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY begin_date DESC NULLS LAST) AS items
    FROM i_lim
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. CONTRIBUTORS  (ContributorClientSchema)
-- ──────────────────────────────────────────────────────────────────────────────
c_lim AS (
    SELECT * FROM contributors WHERE person_id IN (SELECT person_id FROM sib) ORDER BY id DESC LIMIT $7
),
c_agg AS (
    SELECT
        (SELECT count(*) FROM contributors WHERE person_id IN (SELECT person_id FROM sib)) AS total_count,
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
        } ORDER BY id DESC) AS items
    FROM c_lim
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. VOTES  (VoteClientSchema + embedded VotingClientSchema)
-- ──────────────────────────────────────────────────────────────────────────────
v_lim AS (
    SELECT * FROM votes WHERE person_id IN (SELECT person_id FROM sib) ORDER BY id DESC LIMIT $7
),
v_agg AS (
    SELECT
        (SELECT count(*) FROM votes WHERE person_id IN (SELECT person_id FROM sib)) AS total_count,
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
            vote_display:                    loc(vote_display_de,                    vote_display_fr,                    vote_display_it,                    NULL,            NULL, $2, $3, $4, $5, $6),
            person_party:                    loc(person_party_de,                    person_party_fr,                    person_party_it,                    person_party_rm, NULL, $2, $3, $4, $5, $6),
            person_parliamentary_group_name: loc(person_parliamentary_group_name_de, person_parliamentary_group_name_fr, person_parliamentary_group_name_it, person_parliamentary_group_name_rm, NULL, $2, $3, $4, $5, $6),
            -- embedded voting (VotingClientSchema)
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
        } ORDER BY id DESC) AS items
    FROM (
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
        FROM v_lim v
        LEFT JOIN votings vt ON vt.id = v.voting_id
    )
),
-- ──────────────────────────────────────────────────────────────────────────────
-- 8. SPEECHES  (SpeechClientSchema) — the person's speeches, newest first.
--    sp_lim is the top-$7 by date_start DESC; it also seeds the speech-linked
--    bodies / affairs / meetings / agendas id-sets below (response-scoped).
-- ──────────────────────────────────────────────────────────────────────────────
sp_lim AS (
    SELECT * FROM speeches WHERE person_id IN (SELECT person_id FROM sib) ORDER BY date_start DESC NULLS LAST LIMIT $7
),
sp_agg AS (
    SELECT
        (SELECT count(*) FROM speeches WHERE person_id IN (SELECT person_id FROM sib)) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            person_id:           person_id,
            date_start:          date_start,
            date_end:            date_end,
            type_external_id:    type_external_id,
            affair_id:           affair_id,
            meeting_id:          meeting_id,
            agenda_external_id:  agenda_external_id,
            agenda_id:           agenda_id,
            url:                 url,
            audio_url:           audio_url,
            video_url:           video_url,
            meeting_external_id: meeting_external_id,
            meeting_type:        meeting_type,
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            -- localized
            person_role:   COALESCE(loc(person_role_de,   person_role_fr,   person_role_it,   NULL, NULL, $2, $3, $4, $5, $6), person_role),
            text_content:  loc(text_content_de,  text_content_fr,  text_content_it,  NULL, NULL, $2, $3, $4, $5, $6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY date_start DESC NULLS LAST) AS items
    FROM sp_lim
),
-- ──────────────────────────────────────────────────────────────────────────────
-- 9/10. MT_IDS hoisted first so gr_ids can JOIN it cleanly
--       Meetings are scoped to the rows actually returned in the response:
--         • c_lim          — the top-$7 contributors → contributors.meeting_id
--         • v_lim → votings — the top-$7 votes        → votings.meeting_id
--       (Not the person's full contributor/vote history.)
-- ──────────────────────────────────────────────────────────────────────────────
pv_votings AS (
    -- group_id for ALL of the person's votings. Used by gr_ids only; the
    -- meetings path no longer reads this CTE.
    SELECT DISTINCT vt.group_id
    FROM votes v
    INNER JOIN votings vt ON vt.id = v.voting_id
    WHERE v.person_id IN (SELECT person_id FROM sib)
),
mt_ids AS (
        SELECT meeting_id AS id FROM c_lim WHERE meeting_id IS NOT NULL
    UNION
        SELECT vt.meeting_id AS id
        FROM v_lim
        INNER JOIN votings vt ON vt.id = v_lim.voting_id
        WHERE vt.meeting_id IS NOT NULL
    UNION
        SELECT meeting_id AS id FROM sp_lim WHERE meeting_id IS NOT NULL
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. GROUPS  (GroupClientSchema)
--    Sources: contributors.group_id  +  memberships.group_id
--             + votes → votings.group_id  +  meetings.group_id
-- ──────────────────────────────────────────────────────────────────────────────
gr_ids AS (
        SELECT group_id AS id FROM contributors WHERE person_id IN (SELECT person_id FROM sib) AND group_id IS NOT NULL
    UNION
        SELECT group_id AS id FROM memberships  WHERE person_id IN (SELECT person_id FROM sib) AND group_id IS NOT NULL
    UNION
        SELECT group_id FROM pv_votings WHERE group_id IS NOT NULL
    UNION
        SELECT m.group_id FROM meetings m
        INNER JOIN mt_ids ON m.id = mt_ids.id
        WHERE m.group_id IS NOT NULL
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
        }) AS items
    FROM gr_src
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. MEETINGS  (MeetingClientSchema)  — sorted newest first
-- ──────────────────────────────────────────────────────────────────────────────
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
        }) AS items
    FROM mt_src
),


-- ──────────────────────────────────────────────────────────────────────────────
-- 11. AFFAIRS  (AffairClientSchema)
--     Source: contributors.affair_id for this person — no limit, no sort.
-- ──────────────────────────────────────────────────────────────────────────────
af_ids AS (
        SELECT affair_id AS id FROM c_lim  WHERE affair_id IS NOT NULL
    UNION
        SELECT affair_id AS id FROM sp_lim WHERE affair_id IS NOT NULL
    UNION
        -- votes → votings.affair_id (the displayed vote slice), so vote rows on
        -- the overview resolve their parent affair like the votes feed page does.
        SELECT vt.affair_id AS id
        FROM v_lim
        INNER JOIN votings vt ON vt.id = v_lim.voting_id
        WHERE vt.affair_id IS NOT NULL
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
        }) AS items
    FROM af_src
),

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. BODIES  (BodyClientSchema)
--
-- Collects the distinct set of bodies linked to this person via:
--   persons.body_id, memberships.body_id, person_identities.body_id,
--   contributors.body_id, interests.body_id
--
-- Fix vs. prototype: memberships joined on body_id (not the membership's own id).
-- ──────────────────────────────────────────────────────────────────────────────
b_ids AS (
        SELECT body_id AS id FROM persons          WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM memberships     WHERE person_id           = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM contributors    WHERE person_id           = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM interests       WHERE person_id           = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM sp_lim          WHERE body_id IS NOT NULL
),
b_src AS (
    SELECT
        b.*,
        COUNT(*) OVER ()                  AS _total,
        ROW_NUMBER() OVER (ORDER BY b.id) AS _rn
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

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. AGENDAS  (AgendaSchema) — agenda items of the in-response speeches
--     (agendas.id = speeches.agenda_id, scoped to sp_lim).
-- ──────────────────────────────────────────────────────────────────────────────
ag_ids AS (
    SELECT DISTINCT agenda_id AS id FROM sp_lim WHERE agenda_id IS NOT NULL
),
ag_src AS (
    SELECT ag.*
    FROM agendas ag
    INNER JOIN ag_ids ON ag.id = ag_ids.id
),
ag_agg AS (
    SELECT
        COUNT(*) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            meeting_id:          meeting_id,
            item_date:           item_date,
            item_external_id:    item_external_id,
            item_title:          item_title,
            item_number_display: item_number_display,
            item_category:       item_category,
            item_url:            item_url,
            item_affair_number:  item_affair_number,
            item_affair_id:      item_affair_id,
            item_language:       item_language,
            item_description:    item_description,
            item_number:         item_number,
            item_result:         item_result,
            item_status:         item_status,
            created_at:          created_at
        }) AS items
    FROM ag_src
)

-- ============================================================================
-- FINAL SELECT
-- All _agg CTEs produce exactly one row (aggregate without GROUP BY), so the
-- CROSS JOINs are safe and add no cardinality beyond the persons point-lookup.
-- ============================================================================
SELECT
    -- PERSONS — flat struct (PersonClientSchema)
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
        "language":                        p.language,
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

    -- RELATED ENTITIES — { total_count, items[] }
    { total_count: CAST(m_agg.total_count AS INTEGER),   items: COALESCE(m_agg.items,   []) } AS membership_groups,
    { total_count: CAST(a_agg.total_count AS INTEGER),   items: COALESCE(a_agg.items,   []) } AS access_badges,
    { total_count: CAST(pi_agg.total_count AS INTEGER),  items: COALESCE(pi_agg.items,  []) } AS person_identities,
    { total_count: CAST(pim_agg.total_count AS INTEGER), items: COALESCE(pim_agg.items, []) } AS person_images,
    { total_count: CAST(i_agg.total_count AS INTEGER),   items: COALESCE(i_agg.items,   []) } AS interests,
    { total_count: CAST(c_agg.total_count AS INTEGER),   items: COALESCE(c_agg.items,   []) } AS contributors,
    { total_count: CAST(v_agg.total_count AS INTEGER),   items: COALESCE(v_agg.items,   []) } AS votes,
    { total_count: CAST(sp_agg.total_count AS INTEGER),  items: COALESCE(sp_agg.items,  []) } AS speeches,
    { total_count: CAST(af_agg.total_count AS INTEGER),  items: COALESCE(af_agg.items,  []) } AS affairs,
    { total_count: CAST(gr_agg.total_count AS INTEGER),  items: COALESCE(gr_agg.items,  []) } AS groups,
    { total_count: CAST(mt_agg.total_count AS INTEGER),  items: COALESCE(mt_agg.items,  []) } AS meetings,
    { total_count: CAST(ag_agg.total_count AS INTEGER),  items: COALESCE(ag_agg.items,  []) } AS agendas,
    { total_count: CAST(b_agg.total_count AS INTEGER),   items: COALESCE(b_agg.items,   []) } AS bodies

FROM persons p
CROSS JOIN m_agg
CROSS JOIN a_agg
CROSS JOIN pi_agg
CROSS JOIN pim_agg
CROSS JOIN i_agg
CROSS JOIN c_agg
CROSS JOIN v_agg
CROSS JOIN sp_agg
CROSS JOIN af_agg
CROSS JOIN gr_agg
CROSS JOIN mt_agg
CROSS JOIN ag_agg
CROSS JOIN b_agg
WHERE p.id = $1;