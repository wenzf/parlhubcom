-- ============================================================================
-- sitemap/organization_keys.sql
--
-- Enumerate every distinct organization KEY for one language priority, for the
-- sitemap. Organizations are not a table — they are `interests` grouped by the
-- normalized (lower-cased) LOCALIZED display name. The `/organizations/:id` param
-- is base64url(org_key), so the key IS language-dependent: the same org resolves
-- to a different key/URL per language. This query is therefore run once per site
-- language (with that language's loc priority) and the sitemap emits one <url>
-- per (language, org).
--
-- The org_name / org_key derivation MUST stay identical to organizations_list.sql
-- (the page's own grouping) or the encoded ids would not match a real detail page.
-- Requires macro_loc.sql on the same connection (loc()).
--
-- Parameters
--   $1..$5 VARCHAR — language priority codes ('de'|'fr'|'it'|'rm'|'en'|'')
--
-- Columns
--   key VARCHAR — normalized org key (lower(org_name)); base64url-encode → :id
--   lm  DOUBLE  — newest COALESCE(updated_at, created_at) in the group (epoch ms)
-- ============================================================================
WITH irow AS (
    SELECT
        COALESCE(
            NULLIF(trim(loc(i.name_de,              i.name_fr,              i.name_it,              NULL, NULL, $1, $2, $3, $4, $5)), ''),
            NULLIF(trim(loc(i.name_short_de,        i.name_short_fr,        i.name_short_it,        NULL, NULL, $1, $2, $3, $4, $5)), ''),
            NULLIF(trim(loc(i.name_abbreviation_de, i.name_abbreviation_fr, i.name_abbreviation_it, NULL, NULL, $1, $2, $3, $4, $5)), '')
        ) AS org_name,
        COALESCE(i.updated_at, i.created_at) AS lm
    FROM interests i
),
iv AS (
    SELECT lower(org_name) AS org_key, lm
    FROM irow
    WHERE org_name IS NOT NULL AND trim(org_name) <> ''
)
SELECT org_key AS key, max(lm) AS lm
FROM iv
GROUP BY org_key
ORDER BY org_key;
