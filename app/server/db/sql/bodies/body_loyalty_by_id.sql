-- ============================================================================
-- body_loyalty_by_id.sql          → ~/server/db/sql/bodies/body_loyalty_by_id.sql
--
-- /bodies/:id/loyalty — per-member PARTY-LOYALTY (dissent rate) for every MP of
-- one body over a date window. Same single-row shape as body_votings_by_id.sql:
--   body     STRUCT  BodyClientSchema (for the layout + <BodyBase/>)
--   loyalty  STRUCT  { total_count, items[] } — one row per qualifying member:
--              person_id, fullname, party, party_key (stable colour key),
--              parliamentary_group, n_ballots, n_dissents, dissent_rate (0..1)
--
-- METHOD (all knobs are parameters):
--   • Decisive positions = yes / no / ABSTAIN (abstain is a real position here:
--     if a group's plurality is to abstain, the loyal act is to abstain too).
--   • Group per ballot = the voter's group AT VOTE TIME
--     (votes.person_parliamentary_group_name_de — historically correct, no join).
--   • Per (voting, group): the group's plurality among yes/no/abstain, but only
--     if the group fielded ≥ $9 decisive voters on that ballot (min group size).
--   • TIES excluded: a ballot counts for a group only when ONE position strictly
--     holds the max (no shared top count) — otherwise "the majority line" is
--     undefined and the ballot is dropped for that group.
--   • A member DISSENTS on a counted ballot when their position ≠ the group
--     plurality. dissent_rate = dissents / counted ballots.
--   • Members with < $10 counted ballots in the window are dropped (too noisy).
--
-- Display party/group/name + the stable colour key come from persons (current),
-- matching /bodies/:id/people; for group-switchers the displayed group may differ
-- from the vote-time group the rate was computed against (rate stays correct).
--
-- Requires macro_loc.sql on the same connection. Run via body_loyalty.ts.
--
-- Parameters
--   $1      INTEGER  body_id (scope; votes.body_id = $1)
--   $2..$6  VARCHAR  language priority ('de'|'fr'|'it'|'rm'|'en'|NULL), padded
--   $7      DOUBLE   window_start epoch-ms, or NULL = open  (votings.date >= $7)
--   $8      DOUBLE   window_end   epoch-ms, or NULL = open  (votings.date <= $8)
--   $9      INTEGER  min_group   — min decisive voters in a group on a ballot (e.g. 4)
--   $10     INTEGER  min_ballots — min counted ballots for a member to appear (e.g. 10)
--   $11     INTEGER  chamber (votings.group_id), or NULL = BOTH (pool all chambers)
--
-- Zero rows when $1 matches no body (→ 404). `loyalty.items` is [] when the body
-- has no qualifying votes in the window. `chambers` lists the body's voting
-- chambers (≥ 2 → the UI offers the BOTH / per-chamber switcher).
-- ============================================================================

WITH
b AS ( SELECT * FROM bodies WHERE id = $1 ),

-- the body's voting chambers (chamber-list rule, identical to body_alignment /
-- body_votings): active legislative-council groups that actually carry votings.
-- Feeds the BOTH/NR/SR switcher; < 2 entries = single-chamber body.
ch AS (
    SELECT
        g.id,
        loc(g.name_de,         g.name_fr,         g.name_it,         g.name_rm,         NULL, $2, $3, $4, $5, $6) AS name,
        loc(g.abbreviation_de, g.abbreviation_fr, g.abbreviation_it, g.abbreviation_rm, NULL, $2, $3, $4, $5, $6) AS abbreviation
    FROM groups g
    WHERE g.body_id = $1
      AND g.type_harmonized = 'council_legislative'
      AND g.active
      AND EXISTS (SELECT 1 FROM votings vv WHERE vv.body_id = $1 AND vv.group_id = g.id)
),
ch_agg AS (
    SELECT list({ id: id, name: name, abbreviation: abbreviation } ORDER BY id) AS items
    FROM ch
),

-- decisive votes cast in this body, in the window (+ optional chamber scope), with
-- the voter's vote-time group. $11 chamber = NULL pools both chambers (BOTH).
-- Fallback: some bodies never carry the vote-time group snapshot (e.g.
-- Liechtenstein — every person_parliamentary_group_name_* is NULL), so the group
-- key falls back to the voter's CURRENT party from persons. Vote-time correctness
-- is preserved wherever the snapshot exists (COALESCE only fills the gaps).
v AS (
    SELECT
        vo.person_id,
        vo.voting_id,
        vo.vote,
        COALESCE(vo.person_parliamentary_group_name_de, p.party_de) AS grp_key,
        COALESCE(vo.person_parliamentary_group_name_fr, p.party_fr) AS grp_fr,
        COALESCE(vo.person_parliamentary_group_name_it, p.party_it) AS grp_it,
        vo.person_parliamentary_group_name_rm                       AS grp_rm
    FROM votes vo
    JOIN votings vt ON vt.id = vo.voting_id
    JOIN persons p  ON p.id  = vo.person_id
    WHERE vo.body_id = $1
      AND vo.vote IN ('yes', 'no', 'abstain')
      AND COALESCE(vo.person_parliamentary_group_name_de, p.party_de) IS NOT NULL
      AND ($7 IS NULL OR vt.date >= $7)
      AND ($8 IS NULL OR vt.date <= $8)
      AND ($11 IS NULL OR vt.group_id = $11)
),

-- per (voting, group): position counts + group size; drop groups below min size
grp AS (
    SELECT
        voting_id,
        grp_key,
        any_value(grp_fr)                        AS grp_fr,
        any_value(grp_it)                        AS grp_it,
        any_value(grp_rm)                        AS grp_rm,
        count(*)                                 AS grp_size,
        count(*) FILTER (WHERE vote = 'yes')     AS c_yes,
        count(*) FILTER (WHERE vote = 'no')      AS c_no,
        count(*) FILTER (WHERE vote = 'abstain') AS c_abs
    FROM v
    GROUP BY voting_id, grp_key
    HAVING count(*) >= $9
),

-- keep only ballots where ONE position strictly holds the max (no tie); name it
grp_ok AS (
    SELECT
        voting_id,
        grp_key,
        CASE
            WHEN c_yes >= c_no AND c_yes >= c_abs THEN 'yes'
            WHEN c_no  >= c_yes AND c_no  >= c_abs THEN 'no'
            ELSE 'abstain'
        END AS major
    FROM grp
    WHERE (
        (CASE WHEN c_yes = greatest(c_yes, c_no, c_abs) THEN 1 ELSE 0 END)
      + (CASE WHEN c_no  = greatest(c_yes, c_no, c_abs) THEN 1 ELSE 0 END)
      + (CASE WHEN c_abs = greatest(c_yes, c_no, c_abs) THEN 1 ELSE 0 END)
    ) = 1
),

-- per member: counted ballots + dissents (+ predominant group, display only)
mem AS (
    SELECT
        v.person_id,
        count(*)                                  AS n_ballots,
        count(*) FILTER (WHERE v.vote <> g.major) AS n_dissents,
        mode(v.grp_key)                           AS grp_key
    FROM v
    JOIN grp_ok g
      ON g.voting_id = v.voting_id
     AND g.grp_key   = v.grp_key
    GROUP BY v.person_id
    HAVING count(*) >= $10
),

-- per (voting, group) Agreement Index (Hix-Noury-Roland), from the same counts.
-- AI = [ max(Y,N,A) - 0.5*((Y+N+A) - max(Y,N,A)) ] / (Y+N+A); 1 = unanimous,
-- 0 = evenly split across all three positions. Abstain is a full position.
grp_ai AS (
    SELECT
        grp_key, grp_fr, grp_it, grp_rm,
        ( greatest(c_yes, c_no, c_abs)
          - 0.5 * ((c_yes + c_no + c_abs) - greatest(c_yes, c_no, c_abs))
        )::DOUBLE / (c_yes + c_no + c_abs) AS ai
    FROM grp
),
-- per group: mean AI over its ballots (= cohesion). One row per group.
grp_cohesion AS (
    SELECT
        grp_key,
        any_value(grp_fr) AS grp_fr,
        any_value(grp_it) AS grp_it,
        any_value(grp_rm) AS grp_rm,
        avg(ai)           AS cohesion,
        count(*)          AS n_ballots
    FROM grp_ai
    GROUP BY grp_key
    HAVING count(*) >= $10
),
-- collapse to a SINGLE row carrying the list of groups (localized label).
cohesion_agg AS (
    SELECT
        list({
            group_key: grp_key,
            "group":   loc(grp_key, grp_fr, grp_it, grp_rm, NULL, $2, $3, $4, $5, $6),
            n_ballots: CAST(n_ballots AS INTEGER),
            cohesion:  cohesion
        } ORDER BY cohesion DESC, grp_key) AS items
    FROM grp_cohesion
),

loyalty_agg AS (
    SELECT
        count(*) AS total_count,
        list({
            person_id:           m.person_id,
            fullname:            p.fullname,
            party:               loc(p.party_de, p.party_fr, p.party_it, NULL, NULL, $2, $3, $4, $5, $6),
            party_key:           p.party_harmonized_wikidata_id,
            parliamentary_group: loc(p.parliamentary_group_name_de, p.parliamentary_group_name_fr, p.parliamentary_group_name_it, p.parliamentary_group_name_rm, NULL, $2, $3, $4, $5, $6),
            n_ballots:           CAST(m.n_ballots  AS INTEGER),
            n_dissents:          CAST(m.n_dissents AS INTEGER),
            dissent_rate:        (m.n_dissents::DOUBLE / m.n_ballots)
        } ORDER BY (m.n_dissents::DOUBLE / m.n_ballots) DESC, p.fullname) AS items
    FROM mem m
    JOIN persons p ON p.id = m.person_id
)

SELECT
    body_struct(b, $2, $3, $4, $5, $6) AS body,

    { total_count: CAST(loyalty_agg.total_count AS INTEGER), items: COALESCE(loyalty_agg.items, []) } AS loyalty,
    { items: COALESCE(cohesion_agg.items, []) } AS cohesion,
    COALESCE(ch_agg.items, []) AS chambers

FROM b
CROSS JOIN loyalty_agg
CROSS JOIN cohesion_agg
CROSS JOIN ch_agg;