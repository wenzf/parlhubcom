-- ============================================================================
-- organization_by_id.sql          → ~/server/db/sql/organizations/organization_by_id.sql
--
-- /organizations/:id — ONE organization (the register-of-interests entries grouped
-- by normalized name = $1) with its members across every chamber. :id in the URL
-- is base64url(org_key), decoded to the normalized key before binding (org_id.ts).
--
-- Single localized row: `organization` header (name + roll-up stats) + `members`
-- (one row per mandate tie, so a person appears once per role) enriched with party
-- (colour) + the granting body's name. 404 when the key matches nothing.
--
-- Requires macro_loc.sql. Run via organizations_id_overview.tsx's loader.
--
-- Parameters
--   $1     VARCHAR - the normalized org key (lower-cased localized name)
--   $2..$6 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
-- ============================================================================

WITH
irow AS (
    SELECT
        i.person_id,
        i.body_id,
        i.begin_date,
        i.end_date,
        loc(i.role_name_de, i.role_name_fr, i.role_name_it, NULL, NULL, $2, $3, $4, $5, $6) AS role,
        COALESCE(
            NULLIF(trim(loc(i.name_de,              i.name_fr,              i.name_it,              NULL, NULL, $2, $3, $4, $5, $6)), ''),
            NULLIF(trim(loc(i.name_short_de,        i.name_short_fr,        i.name_short_it,        NULL, NULL, $2, $3, $4, $5, $6)), ''),
            NULLIF(trim(loc(i.name_abbreviation_de, i.name_abbreviation_fr, i.name_abbreviation_it, NULL, NULL, $2, $3, $4, $5, $6)), '')
        ) AS org_name,
        CASE
            WHEN lower(trim(COALESCE(i.type_payment_harmonized, ''))) = 'paid'                  THEN 'paid'
            WHEN lower(trim(COALESCE(i.type_payment_harmonized, ''))) IN ('unpaid', 'honorary') THEN 'unpaid'
            ELSE 'unknown'
        END AS payment
    FROM interests i
),
o AS (
    SELECT * FROM irow
    WHERE org_name IS NOT NULL AND lower(org_name) = $1
),
mem AS (
    SELECT
        o.person_id,
        o.body_id,
        o.role,
        o.payment,
        o.begin_date,
        o.end_date,
        p.fullname,
        p.party_harmonized_wikidata_id AS party_key,
        loc(p.party_de, p.party_fr, p.party_it, NULL, NULL, $2, $3, $4, $5, $6) AS party,
        COALESCE(loc(b.name_de, b.name_fr, b.name_it, NULL, b.name_en, $2, $3, $4, $5, $6), b.name) AS body_name
    FROM o
    JOIN persons p ON p.id = o.person_id
    LEFT JOIN bodies b ON b.id = o.body_id
),
mem_agg AS (
    SELECT
        count(*) AS total_count,
        list({
            person_id:  person_id,
            fullname:   fullname,
            party:      party,
            party_key:  party_key,
            body_id:    body_id,
            body_name:  body_name,
            role:       role,
            payment:    payment,
            begin_date: begin_date,
            end_date:   end_date
        } ORDER BY fullname, begin_date DESC NULLS LAST) AS items
    FROM mem
),
org_agg AS (
    SELECT
        any_value(org_name)                      AS name,
        count(*)                                 AS n_mandates,
        count(DISTINCT person_id)                AS n_members,
        count(DISTINCT body_id)                  AS n_bodies,
        count(*) FILTER (WHERE payment = 'paid') AS n_paid
    FROM o
)

SELECT
    {
        key:        $1,
        name:       org_agg.name,
        n_members:  CAST(org_agg.n_members  AS INTEGER),
        n_mandates: CAST(org_agg.n_mandates AS INTEGER),
        n_bodies:   CAST(org_agg.n_bodies   AS INTEGER),
        n_paid:     CAST(org_agg.n_paid     AS INTEGER)
    } AS organization,
    { total_count: CAST(mem_agg.total_count AS INTEGER), items: COALESCE(mem_agg.items, []) } AS members
FROM org_agg
CROSS JOIN mem_agg
WHERE org_agg.n_mandates > 0;
