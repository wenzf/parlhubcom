-- ============================================================================
-- organizations_list.sql          → ~/server/db/sql/organizations/organizations_list.sql
--
-- Top-level, paginated, localized DIRECTORY of ORGANIZATIONS — the /organizations
-- catalogue. Organizations are not a table: they are the register-of-interests
-- entries (`interests`) GROUPED BY the normalized organization name (org_key =
-- lower(localized display name)). One row per distinct organization with roll-up
-- stats; each row links to /organizations/:id where :id = base64url(org_key)
-- (encoded client-side; see ~/lib/utils/org_id.ts).
--
-- runListPaginatedFiltered family (langs $1..$5, limit $6, offset $7, filters $8+).
-- Requires macro_loc.sql. Mirrors interests_list.sql's list+lookup shape, minus the
-- lookups (organizations are self-contained aggregates).
--
-- Parameters
--   $1..$5 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $6  INTEGER  - page size  (LIMIT)
--   $7  INTEGER  - page start (OFFSET; 0-based)
--   $8  VARCHAR  - search over the organization name (NULL = none)
--   ORDER BY at g_lim + g_agg is the literal token /* __ORDER_BY__ */.
--
-- Output
--   organizations STRUCT { total_count, items }  — total_count = distinct-org count
--     (filtered); items = the page slice. Each item:
--       key (normalized), name (display), n_members (distinct people),
--       n_mandates (interest rows), n_paid, n_bodies (distinct granting bodies).
-- ============================================================================

WITH
irow AS (
    SELECT
        i.person_id,
        i.body_id,
        COALESCE(
            NULLIF(trim(loc(i.name_de,              i.name_fr,              i.name_it,              NULL, NULL, $1, $2, $3, $4, $5)), ''),
            NULLIF(trim(loc(i.name_short_de,        i.name_short_fr,        i.name_short_it,        NULL, NULL, $1, $2, $3, $4, $5)), ''),
            NULLIF(trim(loc(i.name_abbreviation_de, i.name_abbreviation_fr, i.name_abbreviation_it, NULL, NULL, $1, $2, $3, $4, $5)), '')
        ) AS org_name,
        CASE
            WHEN lower(trim(COALESCE(i.type_payment_harmonized, ''))) = 'paid'                  THEN 'paid'
            WHEN lower(trim(COALESCE(i.type_payment_harmonized, ''))) IN ('unpaid', 'honorary') THEN 'unpaid'
            ELSE 'unknown'
        END AS payment
    FROM interests i
),
iv AS (
    SELECT person_id, body_id, org_name, lower(org_name) AS org_key, payment
    FROM irow
    WHERE org_name IS NOT NULL AND trim(org_name) <> ''
),
g AS (
    SELECT
        org_key,
        org_key                                      AS id,   -- deterministic tiebreak for resolveOrderBy (… , id DESC)
        any_value(org_name)                          AS name,
        count(*)                                     AS n_mandates,
        count(DISTINCT person_id)                    AS n_members,
        count(*) FILTER (WHERE payment = 'paid')     AS n_paid,
        count(DISTINCT body_id)                      AS n_bodies
    FROM iv
    GROUP BY org_key
),
g_filtered AS (
    SELECT * FROM g
    WHERE ($8 IS NULL OR contains(lower(name), lower($8)))
),
g_lim AS (
    SELECT * FROM g_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $6 OFFSET $7
),
g_agg AS (
    SELECT
        (SELECT count(*) FROM g_filtered) AS total_count,
        list({
            key:        org_key,
            name:       name,
            n_members:  CAST(n_members  AS INTEGER),
            n_mandates: CAST(n_mandates AS INTEGER),
            n_paid:     CAST(n_paid     AS INTEGER),
            n_bodies:   CAST(n_bodies   AS INTEGER)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM g_lim
)

SELECT
    { total_count: CAST(g_agg.total_count AS INTEGER), items: COALESCE(g_agg.items, []) } AS organizations
FROM g_agg;