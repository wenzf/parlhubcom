-- ============================================================================
-- body_alignment_by_id.sql        → ~/server/db/sql/bodies/body_alignment_by_id.sql
--
-- /bodies/:id/alignment — the co-voting SPATIAL MODEL for one chamber over a date
-- window. From the member×vote matrix of this body we derive three things a
-- single query can produce (the 2-D scatter is finished in the loader — see
-- body_alignment.ts — because eigen-decomposition is not SQL's job):
--
--   body          STRUCT  BodyClientSchema (for the layout + <BodyBase/>)
--   members       { total_count, items[] } — one row per qualifying member:
--                   person_id, fullname, party, party_key (stable colour key),
--                   parliamentary_group, n_ballots
--   pairs         { items[] } — UPPER-TRIANGLE member×member agreement over the
--                   ballots BOTH cast: { a, b, shared, agreed, agreement }.
--                   Feeds the loader's classical MDS → per-member (x,y) scatter.
--   chambers      LIST — the body's voting chambers (chamber-list rule, as in
--                   body_votings_by_id.sql): { id, name, abbreviation }. Feeds
--                   the chamber switcher; < 2 entries = single-chamber body.
--   chamber_id    INTEGER — the EFFECTIVE chamber scope applied to the matrix:
--                   $11 when given, else the busiest chamber for multi-chamber
--                   bodies (pooling both chambers would put two disconnected
--                   components into one MDS — NR–SR pairs share zero ballots),
--                   else NULL (single-chamber bodies stay unscoped).
--   party_matrix  { items[] } — party×party MEAN pairwise agreement (incl. the
--                   diagonal = intra-party cohesion): { party_a, party_b,
--                   agreement, sd, n }. `sd` is the stddev of the member-pair
--                   agreements in the cell and `n` their count — together they
--                   give the loader a 95% confidence half-width (significance of
--                   the alignment). The coalition heatmap reads this directly.
--   parties       { items[] } — { party_key, party, size } for legend + axes.
--
-- METHOD
--   • A "shared ballot" is one voting_id BOTH members appear on — so members are
--     only ever compared where their records overlap (same voting = same session
--     + chamber + moment); cross-session pairs simply share nothing.
--   • agreement = (ballots voted identically) / (shared ballots). `absent` is its
--     OWN matching value (absent–absent = agreement); `o.vote = me.vote` encodes it.
--   • A member must have ≥ $10 ballots in the window to enter (mem_ballots); a
--     pair must share ≥ $9 ballots to be scored (drops noisy low-overlap pairs).
--   • party_matrix averages the member-pair agreements grouped by the unordered
--     party pair, so coalition structure falls out without any per-party model.
--
-- Requires macro_loc.sql on the same connection. Run via body_alignment.ts.
--
-- Parameters
--   $1      INTEGER  body_id (scope; votes.body_id = $1)
--   $2..$6  VARCHAR  language priority ('de'|'fr'|'it'|'rm'|'en'|NULL), padded
--   $7      DOUBLE   window_start epoch-ms, or NULL = open  (votings.date >= $7)
--   $8      DOUBLE   window_end   epoch-ms, or NULL = open  (votings.date <= $8)
--   $9      INTEGER  min_shared  — min shared ballots for a PAIR to be scored
--   $10     INTEGER  min_ballots — min ballots for a MEMBER to appear
--   $11     INTEGER  chamber (votings.group_id), or NULL = auto (see chamber_id)
--
-- Zero rows when $1 matches no body (→ 404). All lists are [] when the body has
-- no qualifying votes in the window.
-- ============================================================================

WITH
b AS ( SELECT * FROM bodies WHERE id = $1 ),

-- the body's voting chambers (chamber-list rule: active legislative-council
-- groups that actually carry votings) + each chamber's voting count.
ch AS (
    SELECT
        g.id,
        loc(g.name_de,         g.name_fr,         g.name_it,         g.name_rm,         NULL, $2, $3, $4, $5, $6) AS name,
        loc(g.abbreviation_de, g.abbreviation_fr, g.abbreviation_it, g.abbreviation_rm, NULL, $2, $3, $4, $5, $6) AS abbreviation,
        cnt.n_votings
    FROM groups g
    JOIN (
        SELECT group_id, count(*) AS n_votings
        FROM votings WHERE body_id = $1 AND group_id IS NOT NULL
        GROUP BY group_id
    ) cnt ON cnt.group_id = g.id
    WHERE g.body_id = $1
      AND g.type_harmonized = 'council_legislative'
      AND g.active
),

-- effective chamber scope: explicit $11 wins; multi-chamber bodies default to
-- their busiest chamber (CH: Nationalrat); single-chamber bodies stay unscoped.
eff AS (
    SELECT CASE
        WHEN $11 IS NOT NULL THEN $11
        WHEN (SELECT count(*) FROM ch) >= 2
            THEN (SELECT id FROM ch ORDER BY n_votings DESC, id LIMIT 1)
    END AS chamber_id
),

ch_agg AS (
    SELECT list({ id: id, name: name, abbreviation: abbreviation } ORDER BY id) AS items
    FROM ch
),

-- every vote cast in this body, in the window and chamber scope
v AS (
    SELECT vo.person_id, vo.voting_id, vo.vote
    FROM votes vo
    JOIN votings vt ON vt.id = vo.voting_id
    WHERE vo.body_id = $1
      AND ($7 IS NULL OR vt.date >= $7)
      AND ($8 IS NULL OR vt.date <= $8)
      AND ((SELECT chamber_id FROM eff) IS NULL
            OR vt.group_id = (SELECT chamber_id FROM eff))
),

-- members with enough ballots in the window to be placed
mem_ballots AS (
    SELECT person_id, count(*) AS n
    FROM v
    GROUP BY person_id
    HAVING count(*) >= $10
),

-- votes restricted to the qualifying members
vv AS (
    SELECT v.*
    FROM v
    JOIN mem_ballots mb ON mb.person_id = v.person_id
),

-- upper-triangle member×member agreement over shared ballots
pairs AS (
    SELECT
        a.person_id                                 AS a,
        b2.person_id                                AS b,
        count(*)                                    AS shared,
        count(*) FILTER (WHERE a.vote = b2.vote)    AS agreed
    FROM vv a
    JOIN vv b2 ON b2.voting_id = a.voting_id AND a.person_id < b2.person_id
    GROUP BY a.person_id, b2.person_id
    HAVING count(*) >= $9
),

-- member display block (current party/group + stable colour key). The colour
-- key is the harmonized party wikidata id, falling back to the localized party
-- name when a party has no harmonized id (e.g. Liechtenstein parties) so those
-- members still group into the heatmap/matrix — matching the client legend,
-- which already keys on `party_key ?? party` (see buildColorMap).
members AS (
    SELECT
        person_id, fullname, party, parliamentary_group, n_ballots,
        COALESCE(party_key_raw, party) AS party_key
    FROM (
        SELECT
            mb.person_id,
            p.fullname,
            loc(p.party_de, p.party_fr, p.party_it, NULL, NULL, $2, $3, $4, $5, $6) AS party,
            p.party_harmonized_wikidata_id AS party_key_raw,
            loc(p.parliamentary_group_name_de, p.parliamentary_group_name_fr, p.parliamentary_group_name_it, p.parliamentary_group_name_rm, NULL, $2, $3, $4, $5, $6) AS parliamentary_group,
            mb.n AS n_ballots
        FROM mem_ballots mb
        JOIN persons p ON p.id = mb.person_id
    )
),

members_agg AS (
    SELECT
        count(*) AS total_count,
        list({
            person_id:           person_id,
            fullname:            fullname,
            party:               party,
            party_key:           party_key,
            parliamentary_group: parliamentary_group,
            n_ballots:           CAST(n_ballots AS INTEGER)
        } ORDER BY party_key NULLS LAST, fullname) AS items
    FROM members
),

pairs_agg AS (
    SELECT
        list({
            a:         a,
            b:         b,
            shared:    CAST(shared AS INTEGER),
            agreed:    CAST(agreed AS INTEGER),
            agreement: agreed::DOUBLE / shared
        }) AS items
    FROM pairs
),

-- attach each pair member's party, then average by the unordered party pair
pp AS (
    SELECT
        least(ma.party_key, mb2.party_key)    AS pa,
        greatest(ma.party_key, mb2.party_key) AS pb,
        pr.agreed::DOUBLE / pr.shared         AS agr
    FROM pairs pr
    JOIN members ma  ON ma.person_id  = pr.a
    JOIN members mb2 ON mb2.person_id = pr.b
    WHERE ma.party_key IS NOT NULL AND mb2.party_key IS NOT NULL
),
party_matrix AS (
    SELECT pa, pb, avg(agr) AS agreement, stddev_samp(agr) AS sd, count(*) AS n
    FROM pp
    GROUP BY pa, pb
),
party_matrix_agg AS (
    SELECT
        list({
            party_a:   pa,
            party_b:   pb,
            agreement: agreement,
            sd:        sd,
            n:         CAST(n AS INTEGER)
        }) AS items
    FROM party_matrix
),

parties AS (
    SELECT party_key, any_value(party) AS party, count(*) AS size
    FROM members
    WHERE party_key IS NOT NULL
    GROUP BY party_key
),
parties_agg AS (
    SELECT
        list({
            party_key: party_key,
            party:     party,
            size:      CAST(size AS INTEGER)
        } ORDER BY size DESC, party_key) AS items
    FROM parties
)

SELECT
    body_struct(b, $2, $3, $4, $5, $6) AS body,

    { total_count: CAST(members_agg.total_count AS INTEGER), items: COALESCE(members_agg.items, []) } AS members,
    { items: COALESCE(pairs_agg.items, []) }        AS pairs,
    { items: COALESCE(party_matrix_agg.items, []) } AS party_matrix,
    { items: COALESCE(parties_agg.items, []) }      AS parties,
    COALESCE(ch_agg.items, [])                      AS chambers,
    (SELECT chamber_id FROM eff)                    AS chamber_id

FROM b
CROSS JOIN members_agg
CROSS JOIN pairs_agg
CROSS JOIN party_matrix_agg
CROSS JOIN parties_agg
CROSS JOIN ch_agg;