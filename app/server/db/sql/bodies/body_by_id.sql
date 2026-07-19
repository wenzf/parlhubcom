-- ============================================================================
-- body_by_id.sql
--
-- The overview payload for ONE body (parliament / canton / communal institution)
-- by primary key, localized to the requested language priority. Returns:
--   • the body itself (every overview field lives on the one `bodies` row), and
--   • two SNIPPET slices for the overview embeds: the most recent votings and the
--     most recent affairs of this body (latest OVERVIEW_SNIPPET_LIMIT = 5 each),
--     each with the FULL total_count so the "view all (N)" links can show totals.
-- The snippet slices feed <BodyVotings variant="snippet"> / <BodyAffairs
-- variant="snippet">; the full feeds live at /bodies/:id/votings and
-- /bodies/:id/affairs (body_votings_by_id.sql / body_affairs_by_id.sql).
-- Requires macro_loc.sql on the same connection. Run with runByIdLocalized.
--
-- Parameters
--   $1     INTEGER  - primary key of the body to fetch
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--
-- Output columns
--   body     STRUCT  one localized BodyClient. ZERO rows when no body matches $1
--                    (runByIdLocalized → undefined).
--   votings  STRUCT { total_count, items }  PaginatedList<VotingClient> — newest 5.
--   affairs  STRUCT { total_count, items }  PaginatedList<AffairClient> — newest 5.
--   chambers LIST    BodyChamber[] — the body's voting chambers (chamber-list rule,
--                    identical to body_people_by_id / body_votings_by_id), with
--                    `seats` = active membership headcount. The overview renders
--                    chamber cards only when ≥ 2 (CH federal); [] otherwise.
-- ============================================================================

WITH
b AS (
    SELECT * FROM bodies WHERE id = $1
),

-- recent votings snippet (newest 5 by date; total_count is the FULL count) --------
-- LIMIT is pushed onto the table scan (only 5 wide rows materialized); the full
-- count is a separate scalar aggregate (reads keys only, no SELECT *).
v_snip AS (
    SELECT * FROM votings WHERE body_id = $1 ORDER BY date DESC NULLS LAST LIMIT 5
),
v_agg AS (
    SELECT
        (SELECT count(*) FROM votings WHERE body_id = $1) AS total_count,
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
                affair_title:   loc(affair_title_de,   affair_title_fr,   affair_title_it,   NULL, NULL, $2, $3, $4, $5, $6),
                group_name:         (SELECT loc(g.name_de,         g.name_fr,         g.name_it,         g.name_rm,         NULL, $2, $3, $4, $5, $6) FROM groups g WHERE g.id = group_id),
                group_abbreviation: (SELECT loc(g.abbreviation_de, g.abbreviation_fr, g.abbreviation_it, g.abbreviation_rm, NULL, $2, $3, $4, $5, $6) FROM groups g WHERE g.id = group_id)
        } ORDER BY date DESC NULLS LAST) AS items
    FROM v_snip
),

-- recent affairs snippet (newest 5 by begin_date; total_count is the FULL count) --
a_snip AS (
    SELECT * FROM affairs WHERE body_id = $1 ORDER BY begin_date DESC NULLS LAST LIMIT 5
),
a_agg AS (
    SELECT
        (SELECT count(*) FROM affairs WHERE body_id = $1) AS total_count,
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
        } ORDER BY begin_date DESC NULLS LAST) AS items
    FROM a_snip
),

-- recent texts snippet (newest 5 by text_date; total_count is the FULL count) --
t_snip AS (
    SELECT * FROM texts WHERE body_id = $1 ORDER BY text_date DESC NULLS LAST LIMIT 5
),
t_agg AS (
    SELECT
        (SELECT count(*) FROM texts WHERE body_id = $1) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            affair_id:           affair_id,
            type_en:             type_en,
            text_format:         text_format,
            text_date:           CAST(text_date AS VARCHAR),
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            "type": loc(type_de, type_fr, type_it, type_rm, type_en, $2, $3, $4, $5, $6),
            "text": loc(text_de, text_fr, text_it, text_rm, NULL,    $2, $3, $4, $5, $6),
            affair_title: (SELECT loc(a.title_de, a.title_fr, a.title_it, a.title_rm, NULL, $2, $3, $4, $5, $6) FROM affairs a WHERE a.id = affair_id)
        } ORDER BY text_date DESC NULLS LAST) AS items
    FROM t_snip
),

-- The body's voting chambers (chamber-list rule, identical to body_people_by_id /
-- body_votings_by_id / body_alignment_by_id): active legislative-council groups of
-- THIS body that actually appear on votings — drops duplicate/historical/noise
-- council rows. `seats` = active membership headcount (memberships, NOT persons).
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
)

SELECT
    body_struct(b, $2, $3, $4, $5, $6) AS body,
    { total_count: CAST(v_agg.total_count AS INTEGER), items: COALESCE(v_agg.items, []) } AS votings,
    { total_count: CAST(a_agg.total_count AS INTEGER), items: COALESCE(a_agg.items, []) } AS affairs,
    { total_count: CAST(t_agg.total_count AS INTEGER), items: COALESCE(t_agg.items, []) } AS texts,
    COALESCE(ch_agg.items, []) AS chambers
FROM b
CROSS JOIN v_agg
CROSS JOIN a_agg
CROSS JOIN t_agg
CROSS JOIN ch_agg;