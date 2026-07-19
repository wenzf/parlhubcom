-- ============================================================================
-- voting_by_id.sql                      → ~/server/db/sql/votings/voting_by_id.sql
--
-- The overview payload for ONE voting (a voting EVENT) by primary key, localized
-- to the requested language priority. A voting is a LEAF entity (no sub-feeds),
-- so this returns:
--   • the voting itself (title, type, date, decision, chamber tally, the
--     meaning-of-yes / meaning-of-no texts, external url, parent affair), and
--   • a response-scoped `bodies` lookup: the single body that held the voting
--     (b.id = voting.body_id), localized — 0 or 1 item — so the overview can
--     label / link the parliament.
-- The parent affair is denormalized on the voting row (affair_id + affair_title),
-- so no separate affair lookup is needed; the page links to /affairs/:affair_id.
-- Requires macro_loc.sql on the same connection. Run with runByIdLocalized.
--
-- Parameters
--   $1     INTEGER  - primary key of the voting to fetch
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--
-- Output columns
--   voting  STRUCT  one localized VotingClient. ZERO rows when no voting matches
--                   $1 (runByIdLocalized → undefined).
--   bodies  STRUCT { total_count, items }  PaginatedList<BodyClient> — the voting's
--                   body (b.id = voting.body_id), 0 or 1 item.
-- The voting row also denormalizes group_name + group_abbreviation
-- (g.id = voting.group_id), localized, for the body/group line in VotingBase.
-- ============================================================================

WITH
v AS (
    SELECT * FROM votings WHERE id = $1
),
-- the voting's body (0 or 1), localized with the page langs $2..$6
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total
    FROM bodies b
    INNER JOIN (SELECT DISTINCT body_id AS id FROM v WHERE body_id IS NOT NULL) bi
        ON b.id = bi.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
)
SELECT
    {
        id:                      v.id,
        body_id:                 v.body_id,
        body_key:                v.body_key,
        external_id:             v.external_id,
        date:                    v.date,
        external_alternative_id: v.external_alternative_id,
        affair_id:               v.affair_id,
        results_yes:             v.results_yes,
        results_no:              v.results_no,
        results_abstention:      v.results_abstention,
        results_absent:          v.results_absent,
        results_string:          v.results_string,
        decision:                v.decision,
        meeting_id:              v.meeting_id,
        group_id:                v.group_id,
        group_external_id:       v.group_external_id,
        created_at:              v.created_at,
        updated_at:              v.updated_at,
        updated_external_at:     v.updated_external_at,
        -- localized voting fields
        title:          loc(v.title_de,          v.title_fr,          v.title_it,          NULL, NULL, $2, $3, $4, $5, $6),
        url_external:   loc(v.url_external_de,   v.url_external_fr,   v.url_external_it,   NULL, NULL, $2, $3, $4, $5, $6),
        "type":         loc(v.type_de,           v.type_fr,           v.type_it,           NULL, NULL, $2, $3, $4, $5, $6),
        meaning_of_yes: loc(v.meaning_of_yes_de, v.meaning_of_yes_fr, v.meaning_of_yes_it, NULL, NULL, $2, $3, $4, $5, $6),
        meaning_of_no:  loc(v.meaning_of_no_de,  v.meaning_of_no_fr,  v.meaning_of_no_it,  NULL, NULL, $2, $3, $4, $5, $6),
        affair_title:   loc(v.affair_title_de,   v.affair_title_fr,   v.affair_title_it,   NULL, NULL, $2, $3, $4, $5, $6),
        -- denormalized group (g.id = v.group_id), localized
        group_name:         (SELECT loc(g.name_de,         g.name_fr,         g.name_it,         g.name_rm,         NULL, $2, $3, $4, $5, $6) FROM groups g WHERE g.id = v.group_id),
        group_abbreviation: (SELECT loc(g.abbreviation_de, g.abbreviation_fr, g.abbreviation_it, g.abbreviation_rm, NULL, $2, $3, $4, $5, $6) FROM groups g WHERE g.id = v.group_id)
    } AS voting,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies
FROM v
CROSS JOIN b_agg;