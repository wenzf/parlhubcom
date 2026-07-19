-- ============================================================================
-- voting_votes_by_id.sql           → ~/server/db/sql/votings/voting_votes_by_id.sql
--
-- All individual votes cast in ONE voting (votes.voting_id = $1), joined to the
-- voting person (persons.id = votes.person_id) for the seat number + party, plus
-- the voting body's total seat count (bodies.legislative_seats). Feeds the
-- standalone <VotingChart /> (hemicycle + sortable vote list). Run with
-- runByIdLocalized. Requires macro_loc.sql on the same connection.
--
-- A voting holds at most one vote per member, so the set is bounded — NOT
-- paginated. The aggregate CTE always yields exactly one row (empty `items` when
-- the voting has no recorded votes), so runByIdLocalized never collapses it.
--
-- Party handling: `party_key` is the STABLE, language-independent colour key
-- (persons.party_harmonized_en, then *_de), so the ordinal colour map is the same
-- in every language; `party` is the localized display label. Both fall back to
-- the vote row's denormalized person_party_* when the person join misses.
--
-- Parameters
--   $1     INTEGER  - the voting id (scope; votes.voting_id = $1)
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--
-- Output columns
--   votes  STRUCT { total_count, items }  one row per cast vote:
--            person_id, fullname, vote (raw token), vote_display (localized),
--            party (localized), party_key (stable colour key), parliamentary_group
--            (localized), parliament_seat (INTEGER | NULL).
--   legislative_seats INTEGER | NULL  - the voting body's seat total (for the
--            hemicycle size); NULL when the voting has no body / no seat figure.
-- ============================================================================

WITH
vv AS (
    SELECT
        v.person_id AS person_id,
        COALESCE(p.fullname, v.person_fullname) AS fullname,
        v.vote AS vote,
        COALESCE(
            loc(v.vote_display_de, v.vote_display_fr, v.vote_display_it, NULL, NULL, $2, $3, $4, $5, $6),
            v.vote
        ) AS vote_display,
        COALESCE(
            loc(p.party_de, p.party_fr, p.party_it, NULL, NULL, $2, $3, $4, $5, $6),
            loc(v.person_party_de, v.person_party_fr, v.person_party_it, v.person_party_rm, NULL, $2, $3, $4, $5, $6)
        ) AS party,
        COALESCE(
            p.party_harmonized_en,
            p.party_harmonized_de,
            loc(p.party_de, p.party_fr, p.party_it, NULL, NULL, $2, $3, $4, $5, $6),
            loc(v.person_party_de, v.person_party_fr, v.person_party_it, v.person_party_rm, NULL, $2, $3, $4, $5, $6)
        ) AS party_key,
        COALESCE(
            loc(p.parliamentary_group_name_de, p.parliamentary_group_name_fr, p.parliamentary_group_name_it, p.parliamentary_group_name_rm, NULL, $2, $3, $4, $5, $6),
            loc(v.person_parliamentary_group_name_de, v.person_parliamentary_group_name_fr, v.person_parliamentary_group_name_it, v.person_parliamentary_group_name_rm, NULL, $2, $3, $4, $5, $6)
        ) AS parliamentary_group,
        p.parliament_seat AS parliament_seat,
        p.parliament_sector AS parliament_sector
    FROM votes v
    LEFT JOIN persons p ON p.id = v.person_id
    WHERE v.voting_id = $1
),
vv_agg AS (
    SELECT
        (SELECT count(*) FROM vv) AS total_count,
        list({
            person_id:           person_id,
            fullname:            fullname,
            vote:                vote,
            vote_display:        vote_display,
            party:               party,
            party_key:           party_key,
            parliamentary_group: parliamentary_group,
            parliament_seat:     parliament_seat,
            parliament_sector:   parliament_sector
        } ORDER BY parliament_seat NULLS LAST, fullname) AS items
    FROM vv
)
SELECT
    { total_count: CAST(vv_agg.total_count AS INTEGER), items: COALESCE(vv_agg.items, []) } AS votes,
    (SELECT legislative_seats FROM bodies WHERE id = (SELECT body_id FROM votings WHERE id = $1)) AS legislative_seats
FROM vv_agg;