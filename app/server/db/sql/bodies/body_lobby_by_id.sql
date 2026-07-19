-- ============================================================================
-- body_lobby_by_id.sql            → ~/server/db/sql/bodies/body_lobby_by_id.sql
--
-- /bodies/:id/lobby — the LOBBY / register-of-interests network for one chamber.
-- From the declared interests of this body's members we build the bipartite
-- person ↔ organization graph and keep only the SHARED ties (organizations tied
-- to ≥ $7 members) — that pruning is what surfaces coalition structure: the orgs
-- several members share are the connective tissue, singletons are noise.
--
--   body     STRUCT  BodyClientSchema (for the layout + <BodyBase/>)
--   people   { total_count, items[] } — one row per member WITH ≥1 interest:
--              person_id, fullname, party, party_key (colour), n_interests,
--              n_paid, degree (how many SHARED orgs they connect to)
--   orgs     { items[] } — the shared organizations: { key, name, n_members }
--   edges    { items[] } — member→shared-org ties (collapsed per pair):
--              { person_id, org_key, payment 'paid'|'unpaid'|'unknown' }
--   payment  STRUCT  { paid, unpaid, unknown } — counts over ALL member
--              interests (not just the shared ones), for the split panel
--
-- PAYMENT is classified exactly like classifyPayment() / interests_list.sql:
--   harmonized 'paid' → paid; 'unpaid'|'honorary' → unpaid; else unknown.
--
-- MEMBERSHIP is identity-aware (mirrors body_people_by_id.sql): a person belongs
-- to the body when their persons row OR any sibling identity has body_id = $1.
--
-- Requires macro_loc.sql. Run via body_lobby.ts (which lays out the force graph).
--
-- Parameters
--   $1      INTEGER  body_id (scope)
--   $2..$6  VARCHAR  language priority ('de'|'fr'|'it'|'rm'|'en'|NULL), padded
--   $7      INTEGER  min_members — least members sharing an org to keep it (e.g. 2)
--   $8      DOUBLE   window_start epoch-ms (interests.begin_date >= $8) or NULL
--   $9      DOUBLE   window_end   epoch-ms (interests.begin_date <= $9) or NULL
--   $10     INTEGER  chamber (groups.id): member has a membership in that group;
--                    NULL = BOTH (all members of the body, no chamber scope)
--
-- Zero rows when $1 matches no body (→ 404). All lists are [] when there are no
-- qualifying interests. `chambers` lists the body's voting chambers (≥ 2 → the UI
-- offers the BOTH / per-chamber switcher).
-- ============================================================================

WITH
b AS ( SELECT * FROM bodies WHERE id = $1 ),

-- the body's voting chambers (chamber-list rule, identical to body_people /
-- body_alignment): active legislative-council groups that actually carry votings.
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

-- primary persons linked to this body (persons row OR sibling identity). $10
-- chamber (NULL = BOTH) scopes to members holding a membership in that chamber
-- group — memberships.person_id references the PRIMARY persons row (as in
-- body_people_by_id), so no identity widening is needed for the chamber test.
members AS (
    SELECT DISTINCT primary_id AS id
    FROM (
        SELECT id                  AS primary_id, body_id FROM persons
        UNION ALL
        SELECT identity_primary_id AS primary_id, body_id FROM person_identities
    )
    WHERE body_id = $1
      AND ($10 IS NULL OR EXISTS (
          SELECT 1 FROM memberships mm
          WHERE mm.person_id = primary_id AND mm.group_id = $10
      ))
),

-- resolve each interest's organization name (localized) once
irow AS (
    SELECT
        i.person_id,
        i.begin_date,
        i.end_date,
        i.type_payment_harmonized,
        loc(i.role_name_de, i.role_name_fr, i.role_name_it, NULL, NULL, $2, $3, $4, $5, $6) AS role,
        COALESCE(
            NULLIF(trim(loc(i.name_de,              i.name_fr,              i.name_it,              NULL, NULL, $2, $3, $4, $5, $6)), ''),
            NULLIF(trim(loc(i.name_short_de,        i.name_short_fr,        i.name_short_it,        NULL, NULL, $2, $3, $4, $5, $6)), ''),
            NULLIF(trim(loc(i.name_abbreviation_de, i.name_abbreviation_fr, i.name_abbreviation_it, NULL, NULL, $2, $3, $4, $5, $6)), '')
        ) AS org_name
    FROM interests i
    JOIN members m ON m.id = i.person_id
    WHERE ($8 IS NULL OR i.begin_date >= $8)
      AND ($9 IS NULL OR i.begin_date <= $9)
),

-- normalize the org key + classify payment
iv AS (
    SELECT
        person_id,
        org_name,
        lower(org_name) AS org_key,
        role,
        begin_date,
        end_date,
        CASE
            WHEN lower(trim(COALESCE(type_payment_harmonized, ''))) = 'paid'                  THEN 'paid'
            WHEN lower(trim(COALESCE(type_payment_harmonized, ''))) IN ('unpaid', 'honorary') THEN 'unpaid'
            ELSE 'unknown'
        END AS payment
    FROM irow
    WHERE org_name IS NOT NULL AND trim(org_name) <> ''
),

-- organizations by distinct members; the shared set drives the graph
orgs_all AS (
    SELECT org_key, any_value(org_name) AS org_name, count(DISTINCT person_id) AS n_members
    FROM iv
    GROUP BY org_key
),
shared_orgs AS (
    SELECT * FROM orgs_all WHERE n_members >= $7
),

-- one edge per (member, shared-org); payment collapsed (paid ≻ unpaid ≻ unknown)
edges AS (
    SELECT
        iv.person_id,
        iv.org_key,
        CASE
            WHEN bool_or(iv.payment = 'paid')   THEN 'paid'
            WHEN bool_or(iv.payment = 'unpaid') THEN 'unpaid'
            ELSE 'unknown'
        END AS payment
    FROM iv
    JOIN shared_orgs s ON s.org_key = iv.org_key
    GROUP BY iv.person_id, iv.org_key
),

-- per-member roll-up (mandate counts + graph degree)
mem_stats AS (
    SELECT
        iv.person_id,
        count(*)                                    AS n_interests,
        count(*) FILTER (WHERE iv.payment = 'paid') AS n_paid,
        (SELECT count(*) FROM edges e WHERE e.person_id = iv.person_id) AS degree
    FROM iv
    GROUP BY iv.person_id
),

people_agg AS (
    SELECT
        count(*) AS total_count,
        list({
            person_id:   ms.person_id,
            fullname:    p.fullname,
            party:       loc(p.party_de, p.party_fr, p.party_it, NULL, NULL, $2, $3, $4, $5, $6),
            party_key:   p.party_harmonized_wikidata_id,
            n_interests: CAST(ms.n_interests AS INTEGER),
            n_paid:      CAST(ms.n_paid AS INTEGER),
            degree:      CAST(ms.degree AS INTEGER)
        } ORDER BY ms.n_interests DESC, p.fullname) AS items
    FROM mem_stats ms
    JOIN persons p ON p.id = ms.person_id
),

orgs_agg AS (
    SELECT
        list({
            key:       org_key,
            name:      org_name,
            n_members: CAST(n_members AS INTEGER)
        } ORDER BY n_members DESC, org_name) AS items
    FROM shared_orgs
),

edges_agg AS (
    SELECT list({ person_id: person_id, org_key: org_key, payment: payment }) AS items
    FROM edges
),

-- detailed ties over the SHARED orgs (one row per mandate) for the click panel
ties_agg AS (
    SELECT list({
        person_id:  iv.person_id,
        org_key:    iv.org_key,
        org_name:   iv.org_name,
        role:       iv.role,
        payment:    iv.payment,
        begin_date: iv.begin_date,
        end_date:   iv.end_date
    }) AS items
    FROM iv
    JOIN shared_orgs s ON s.org_key = iv.org_key
),

pay_agg AS (
    SELECT
        CAST(count(*) FILTER (WHERE payment = 'paid')    AS INTEGER) AS paid,
        CAST(count(*) FILTER (WHERE payment = 'unpaid')  AS INTEGER) AS unpaid,
        CAST(count(*) FILTER (WHERE payment = 'unknown') AS INTEGER) AS unknown
    FROM iv
)

SELECT
    body_struct(b, $2, $3, $4, $5, $6) AS body,

    { total_count: CAST(people_agg.total_count AS INTEGER), items: COALESCE(people_agg.items, []) } AS people,
    { items: COALESCE(orgs_agg.items, []) }  AS orgs,
    { items: COALESCE(edges_agg.items, []) } AS edges,
    { items: COALESCE(ties_agg.items, []) }  AS ties,
    { paid: pay_agg.paid, unpaid: pay_agg.unpaid, unknown: pay_agg.unknown } AS payment,
    COALESCE(ch_agg.items, []) AS chambers

FROM b
CROSS JOIN people_agg
CROSS JOIN orgs_agg
CROSS JOIN edges_agg
CROSS JOIN ties_agg
CROSS JOIN pay_agg
CROSS JOIN ch_agg;