-- ============================================================================
-- group_by_id.sql
--
-- The overview payload for ONE group (a parliamentary group / faction /
-- committee) by primary key, localized to the requested language priority.
-- Returns:
--   • the group itself (every overview field lives on the one `groups` row),
--   • two SNIPPET slices for the overview embeds: the most recent contributions
--     (contributors.group_id = $1) and meetings (meetings.group_id = $1), latest 5
--     each, with the FULL total_count so the "view all (N)" links show totals, and
--   • a response-scoped `bodies` lookup — every body referenced by the group and
--     the two snippet slices (group.body_id, contributors.body_id, meetings.body_id),
--     so the client can resolve each row's body by id.
--
-- The snippet slices feed <GroupContributions variant="snippet"> /
-- <GroupMeetings variant="snippet">; the full feeds live at /groups/:id/contributions
-- and /groups/:id/meetings. Requires macro_loc.sql. Run with runByIdLocalized.
--
-- Parameters
--   $1     INTEGER  - primary key of the group to fetch (scope)
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--
-- Output columns
--   group         STRUCT  one localized GroupClient. ZERO rows → undefined.
--   contributions STRUCT { total_count, items }  PaginatedList<ContributorClient> — newest 5.
--   meetings      STRUCT { total_count, items }  PaginatedList<MeetingClient>     — newest 5.
--   bodies        STRUCT { total_count, items }  PaginatedList<BodyClient>        — lookup.
--   affairs       STRUCT { total_count, items }  PaginatedList<AffairClient>      — lookup
--                 (a.id = contributions snippet's affair_id; links to /affairs/:id).
-- ============================================================================

WITH
g AS (
    SELECT * FROM groups WHERE id = $1
),

-- recent contributions snippet (contributors.group_id = $1; newest 5 by position) --
c_snip AS (
    SELECT * FROM contributors WHERE group_id = $1 ORDER BY position NULLS LAST, id DESC LIMIT 5
),
c_agg AS (
    SELECT
        (SELECT count(*) FROM contributors WHERE group_id = $1) AS total_count,
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
            role:             loc(role_de,             role_fr,             role_it,             role_rm,            NULL,               $2, $3, $4, $5, $6),
            role_harmonized:  loc(role_harmonized_de,  role_harmonized_fr,  role_harmonized_it,  role_harmonized_rm, role_harmonized_en, $2, $3, $4, $5, $6),
            party:            loc(party_de,            party_fr,            party_it,            party_rm,           NULL,               $2, $3, $4, $5, $6),
            party_harmonized: loc(party_harmonized_de, party_harmonized_fr, party_harmonized_it, NULL,               NULL,               $2, $3, $4, $5, $6)
        } ORDER BY position NULLS LAST, id DESC) AS items
    FROM c_snip
),

-- recent meetings snippet (meetings.group_id = $1; newest 5 by begin_date) --------
m_snip AS (
    SELECT * FROM meetings WHERE group_id = $1 ORDER BY begin_date DESC NULLS LAST LIMIT 5
),
m_agg AS (
    SELECT
        (SELECT count(*) FROM meetings WHERE group_id = $1) AS total_count,
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
            "number":            number,
            begin_date:          begin_date,
            end_date:            end_date,
            location:            location,
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            name:          loc(name_de,         name_fr,         name_it,         name_rm, NULL, $2, $3, $4, $5, $6),
            description:   loc(description_de,  description_fr,  description_it,  NULL,    NULL, $2, $3, $4, $5, $6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL,  NULL, $2, $3, $4, $5, $6),
            url_external:  loc(url_external_de,  url_external_fr,  url_external_it,  url_external_rm, NULL, $2, $3, $4, $5, $6)
        } ORDER BY begin_date DESC NULLS LAST) AS items
    FROM m_snip
),

-- recent memberships snippet (memberships.group_id = $1; newest 5 by begin_date) --
mem_snip AS (
    SELECT * FROM memberships WHERE group_id = $1 ORDER BY begin_date DESC NULLS LAST LIMIT 5
),
mem_agg AS (
    SELECT
        (SELECT count(*) FROM memberships WHERE group_id = $1) AS total_count,
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
            type_harmonized:      loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $2, $3, $4, $5, $6),
            type_harmonized_code: type_harmonized,
            group_name:    loc(group_name_de,    group_name_fr,    group_name_it,    NULL, NULL, $2, $3, $4, $5, $6),
            role_name:     loc(role_name_de,     role_name_fr,     role_name_it,     NULL, NULL, $2, $3, $4, $5, $6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY begin_date DESC NULLS LAST) AS items
    FROM mem_snip
),

-- recent votings snippet (votings.group_id = $1; newest 5 by date) ----------------
vot_snip AS (
    SELECT * FROM votings WHERE group_id = $1 ORDER BY date DESC NULLS LAST LIMIT 5
),
vot_agg AS (
    SELECT
        (SELECT count(*) FROM votings WHERE group_id = $1) AS total_count,
        list({
            id:                      id,
            body_id:                 body_id,
            body_key:                body_key,
            external_id:             external_id,
            date:                    date,
            external_alternative_id: external_alternative_id,
            affair_id:               affair_id,
            results_yes:             results_yes,
            results_no:              results_no,
            results_abstention:      results_abstention,
            results_absent:          results_absent,
            results_string:          results_string,
            decision:                decision,
            meeting_id:              meeting_id,
            group_id:                group_id,
            group_external_id:       group_external_id,
            created_at:              created_at,
            updated_at:              updated_at,
            updated_external_at:     updated_external_at,
            title:          loc(title_de,          title_fr,          title_it,          NULL, NULL, $2, $3, $4, $5, $6),
            url_external:   loc(url_external_de,   url_external_fr,   url_external_it,   NULL, NULL, $2, $3, $4, $5, $6),
            "type":         loc(type_de,           type_fr,           type_it,           NULL, NULL, $2, $3, $4, $5, $6),
            meaning_of_yes: loc(meaning_of_yes_de, meaning_of_yes_fr, meaning_of_yes_it, NULL, NULL, $2, $3, $4, $5, $6),
            meaning_of_no:  loc(meaning_of_no_de,  meaning_of_no_fr,  meaning_of_no_it,  NULL, NULL, $2, $3, $4, $5, $6),
            affair_title:   loc(affair_title_de,   affair_title_fr,   affair_title_it,   NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY date DESC NULLS LAST) AS items
    FROM vot_snip
),

-- Response-scoped body lookup: distinct bodies of the group + the snippet rows.
b_ids AS (
    SELECT body_id AS id FROM g                  WHERE body_id IS NOT NULL
    UNION
    SELECT body_id AS id FROM c_snip             WHERE body_id IS NOT NULL
    UNION
    SELECT body_id AS id FROM m_snip             WHERE body_id IS NOT NULL
    UNION
    SELECT body_id AS id FROM mem_snip           WHERE body_id IS NOT NULL
    UNION
    SELECT body_id AS id FROM vot_snip           WHERE body_id IS NOT NULL
),
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total
    FROM bodies b
    INNER JOIN (SELECT DISTINCT id FROM b_ids) bi ON b.id = bi.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
),
-- Response-scoped affair lookup (a.id = contributions/votings snippet's affair_id).
a_ids AS (
    SELECT DISTINCT affair_id AS id FROM c_snip   WHERE affair_id IS NOT NULL
    UNION
    SELECT DISTINCT affair_id AS id FROM vot_snip WHERE affair_id IS NOT NULL
),
a_src AS (
    SELECT a.*, COUNT(*) OVER () AS _total
    FROM affairs a
    INNER JOIN a_ids ON a.id = a_ids.id
),
a_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
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
            title:                 loc(title_de,                 title_fr,                 title_it,                 title_rm,                 NULL,               $2, $3, $4, $5, $6),
            title_long:            loc(title_long_de,            title_long_fr,            title_long_it,            title_long_rm,            NULL,               $2, $3, $4, $5, $6),
            type_harmonized:       loc(type_harmonized_de,       type_harmonized_fr,       type_harmonized_it,       type_harmonized_rm,       type_harmonized_en, $2, $3, $4, $5, $6),
            type_name:             loc(type_name_de,             type_name_fr,             type_name_it,             type_name_rm,             NULL,               $2, $3, $4, $5, $6),
            state_name_harmonized: loc(state_name_harmonized_de, state_name_harmonized_fr, state_name_harmonized_it, state_name_harmonized_rm, NULL,               $2, $3, $4, $5, $6),
            state_name:            loc(state_name_de,            state_name_fr,            state_name_it,            NULL,                     NULL,               $2, $3, $4, $5, $6),
            url_external:          loc(url_external_de,          url_external_fr,          url_external_it,          url_external_rm,          NULL,               $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM a_src
)
SELECT
    {
        id:                        id,
        body_id:                   body_id,
        body_key:                  body_key,
        external_id:               external_id,
        external_alternative_id:   external_alternative_id,
        type_harmonized_id:        type_harmonized_id,
        type_harmonized_position:  type_harmonized_position,
        type_harmonized_wikidata_id: type_harmonized_wikidata_id,
        active:                    active,
        type_external_id:          type_external_id,
        begin_date:                begin_date,
        end_date:                  end_date,
        wikidata_id:               wikidata_id,
        parent_group_external_id:  parent_group_external_id,
        child_group_external_id:   child_group_external_id,
        parent_council_external_id: parent_council_external_id,
        contact:                   contact,
        created_at:                created_at,
        updated_at:                updated_at,
        updated_external_at:       updated_external_at,
        name:            loc(name_de,            name_fr,            name_it,            name_rm,            NULL,               $2, $3, $4, $5, $6),
        abbreviation:    loc(abbreviation_de,    abbreviation_fr,    abbreviation_it,    abbreviation_rm,    NULL,               $2, $3, $4, $5, $6),
        description:     loc(description_de,     description_fr,     description_it,     description_rm,     NULL,               $2, $3, $4, $5, $6),
        -- -- the language tag the value above was resolved from, via loc_lang — same
        -- args as its loc(), so the two always agree. Consumed as the rendered
        -- block's lang attribute (WCAG 3.1.2 Language of Parts).
        description_lang: loc_lang(description_de, description_fr, description_it, description_rm, NULL, $2, $3, $4, $5, $6),
        type_harmonized: loc(type_harmonized_de, type_harmonized_fr, type_harmonized_it, type_harmonized_rm, type_harmonized_en, $2, $3, $4, $5, $6),
        type_external:   loc(type_external_de,   type_external_fr,   type_external_it,   type_external_rm,   NULL,               $2, $3, $4, $5, $6),
        url_external:    loc(url_external_de,    url_external_fr,    url_external_it,    url_external_rm,    NULL,               $2, $3, $4, $5, $6)
    } AS "group",
    { total_count: CAST(c_agg.total_count AS INTEGER), items: COALESCE(c_agg.items, []) } AS contributions,
    { total_count: CAST(m_agg.total_count AS INTEGER), items: COALESCE(m_agg.items, []) } AS meetings,
    { total_count: CAST(mem_agg.total_count AS INTEGER), items: COALESCE(mem_agg.items, []) } AS memberships,
    { total_count: CAST(vot_agg.total_count AS INTEGER), items: COALESCE(vot_agg.items, []) } AS votings,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies,
    { total_count: CAST(a_agg.total_count AS INTEGER), items: COALESCE(a_agg.items, []) } AS affairs
FROM g
CROSS JOIN c_agg
CROSS JOIN m_agg
CROSS JOIN mem_agg
CROSS JOIN vot_agg
CROSS JOIN b_agg
CROSS JOIN a_agg;