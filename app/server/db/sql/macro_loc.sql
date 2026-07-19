-- ============================================================================
-- macros.sql
--
-- Execute once per connection before running any query that uses loc().
-- ============================================================================

-- loc(v_de, v_fr, v_it, v_rm, v_en, l1, l2, l3, l4, l5)
--
-- Returns the first non-null value that matches the caller's language priority
-- list (l1 = highest priority … l5 = lowest).
--
-- Usage rules:
--   • Pass NULL for v_rm / v_en when the field has no such language variant.
--   • Pass NULL for unused l* slots  (e.g. loc(..., 'de', 'fr', NULL, NULL, NULL)).
--   • If no priority slot matches a non-null value the macro falls back to the
--     first non-null value found across all variants (any-language fallback).
CREATE OR REPLACE TEMP MACRO loc(v_de, v_fr, v_it, v_rm, v_en, l1, l2, l3, l4, l5) AS (
    COALESCE(
        CASE l1 WHEN 'de' THEN v_de WHEN 'fr' THEN v_fr WHEN 'it' THEN v_it WHEN 'rm' THEN v_rm WHEN 'en' THEN v_en END,
        CASE l2 WHEN 'de' THEN v_de WHEN 'fr' THEN v_fr WHEN 'it' THEN v_it WHEN 'rm' THEN v_rm WHEN 'en' THEN v_en END,
        CASE l3 WHEN 'de' THEN v_de WHEN 'fr' THEN v_fr WHEN 'it' THEN v_it WHEN 'rm' THEN v_rm WHEN 'en' THEN v_en END,
        CASE l4 WHEN 'de' THEN v_de WHEN 'fr' THEN v_fr WHEN 'it' THEN v_it WHEN 'rm' THEN v_rm WHEN 'en' THEN v_en END,
        CASE l5 WHEN 'de' THEN v_de WHEN 'fr' THEN v_fr WHEN 'it' THEN v_it WHEN 'rm' THEN v_rm WHEN 'en' THEN v_en END,
        v_de, v_fr, v_it, v_rm, v_en   -- any-language fallback
    )
);

-- loc_lang(v_de, v_fr, v_it, v_rm, v_en, l1, l2, l3, l4, l5)
--
-- The COMPANION of loc(): returns the LANGUAGE TAG ('de'|'fr'|'it'|'rm'|'en') of
-- the exact variant loc() would return for the same arguments — i.e. which
-- language version the localized value actually came from. Uses the identical
-- priority order and any-language fallback (de → fr → it → rm → en), and yields a
-- tag only where that variant is non-null, so loc()/loc_lang() always agree.
-- Returns NULL when every variant is NULL (loc() also returns NULL).
--
-- Pass NULL for v_rm / v_en exactly as with loc() when the field has no such
-- variant; that branch then never produces a tag.
CREATE OR REPLACE TEMP MACRO loc_lang(v_de, v_fr, v_it, v_rm, v_en, l1, l2, l3, l4, l5) AS (
    COALESCE(
        CASE l1 WHEN 'de' THEN (CASE WHEN v_de IS NOT NULL THEN 'de' END) WHEN 'fr' THEN (CASE WHEN v_fr IS NOT NULL THEN 'fr' END) WHEN 'it' THEN (CASE WHEN v_it IS NOT NULL THEN 'it' END) WHEN 'rm' THEN (CASE WHEN v_rm IS NOT NULL THEN 'rm' END) WHEN 'en' THEN (CASE WHEN v_en IS NOT NULL THEN 'en' END) END,
        CASE l2 WHEN 'de' THEN (CASE WHEN v_de IS NOT NULL THEN 'de' END) WHEN 'fr' THEN (CASE WHEN v_fr IS NOT NULL THEN 'fr' END) WHEN 'it' THEN (CASE WHEN v_it IS NOT NULL THEN 'it' END) WHEN 'rm' THEN (CASE WHEN v_rm IS NOT NULL THEN 'rm' END) WHEN 'en' THEN (CASE WHEN v_en IS NOT NULL THEN 'en' END) END,
        CASE l3 WHEN 'de' THEN (CASE WHEN v_de IS NOT NULL THEN 'de' END) WHEN 'fr' THEN (CASE WHEN v_fr IS NOT NULL THEN 'fr' END) WHEN 'it' THEN (CASE WHEN v_it IS NOT NULL THEN 'it' END) WHEN 'rm' THEN (CASE WHEN v_rm IS NOT NULL THEN 'rm' END) WHEN 'en' THEN (CASE WHEN v_en IS NOT NULL THEN 'en' END) END,
        CASE l4 WHEN 'de' THEN (CASE WHEN v_de IS NOT NULL THEN 'de' END) WHEN 'fr' THEN (CASE WHEN v_fr IS NOT NULL THEN 'fr' END) WHEN 'it' THEN (CASE WHEN v_it IS NOT NULL THEN 'it' END) WHEN 'rm' THEN (CASE WHEN v_rm IS NOT NULL THEN 'rm' END) WHEN 'en' THEN (CASE WHEN v_en IS NOT NULL THEN 'en' END) END,
        CASE l5 WHEN 'de' THEN (CASE WHEN v_de IS NOT NULL THEN 'de' END) WHEN 'fr' THEN (CASE WHEN v_fr IS NOT NULL THEN 'fr' END) WHEN 'it' THEN (CASE WHEN v_it IS NOT NULL THEN 'it' END) WHEN 'rm' THEN (CASE WHEN v_rm IS NOT NULL THEN 'rm' END) WHEN 'en' THEN (CASE WHEN v_en IS NOT NULL THEN 'en' END) END,
        -- any-language fallback, SAME order as loc(): de → fr → it → rm → en
        CASE WHEN v_de IS NOT NULL THEN 'de' END,
        CASE WHEN v_fr IS NOT NULL THEN 'fr' END,
        CASE WHEN v_it IS NOT NULL THEN 'it' END,
        CASE WHEN v_rm IS NOT NULL THEN 'rm' END,
        CASE WHEN v_en IS NOT NULL THEN 'en' END
    )
);

-- sibling_ids(pid)
--
-- The person-scope set for `pid`: the primary id itself UNION the ids of every
-- identity that groups under it (person_identities.identity_primary_id = pid).
-- A "person" is one real individual that may appear as several identity rows
-- (e.g. a national + a cantonal mandate); this macro is the single source of
-- truth for "which person_ids count as this person".
--
-- Usage — wherever a person query scopes a related list by person, replace
--   WHERE person_id = $1
-- with
--   WHERE person_id IN (SELECT person_id FROM sibling_ids($1))
-- on BOTH the page slice and its count(*) subquery, so total_count stays in
-- step with the returned rows.
--
-- Backward-compatible: collapses to {pid} when the person has no identity rows.
-- To revert to single-person scope globally, drop the UNION line below — every
-- query that uses the macro narrows at once, with no per-file edits.
--
-- Perf note: `person_id IN (subquery)` gives up the clustered single-person read
-- in favour of a sort/hash over the identity set. Negligible at current sizes.
CREATE OR REPLACE TEMP MACRO sibling_ids(pid) AS TABLE
    SELECT pid AS person_id
    UNION
    SELECT id FROM person_identities WHERE identity_primary_id = pid;
-- body_struct(b, l1, l2, l3, l4, l5)
--
-- ONE localized BodyClient struct from a `bodies` row. `b` is the row itself
-- (pass the table alias: `body_struct(b, $2, $3, $4, $5, $6) FROM bodies b`);
-- l1..l5 are the caller's language priority slots, so a query binds whichever
-- parameter numbers it happens to use ($1..$5 for the list family, $2..$6 for
-- the by-id family) without this macro caring.
--
-- This is the single definition of the body projection. It previously stood
-- inlined and identical in 45 places across 44 .sql files, which meant adding a
-- `bodies` column was a 45-site edit — the reason to keep it here instead.
--
-- Works both standalone and inside `list(body_struct(b, …) ORDER BY …)`, the two
-- shapes the corpus uses.
CREATE OR REPLACE TEMP MACRO body_struct(b, l1, l2, l3, l4, l5) AS (
    {
        id:                        b.id,
        body_key:                  b.body_key,
        wikidata_id:               b.wikidata_id,
        lang:                      b.lang,
        indexed:                   b.indexed,
        "type":                    b.type,
        canton_key:                b.canton_key,
        canton_id_bfs:             b.canton_id_bfs,
        canton_table_id:           b.canton_table_id,
        country_key:               b.country_key,
        "position":                b.position,
        legislative_wikidata_id:   b.legislative_wikidata_id,
        legislative_seats:         b.legislative_seats,
        executive_wikidata_id:     b.executive_wikidata_id,
        executive_seats:           b.executive_seats,
        consultations_url:         b.consultations_url,
        elections_and_votings_url: b.elections_and_votings_url,
        flag_image_url:            b.flag_image_url,
        flag_image_oparl_url:      b.flag_image_oparl_url,
        has_parliament:            b.has_parliament,
        population:                b.population,
        languages:                 b.languages,
        name:             COALESCE(loc(b.name_de,             b.name_fr,             b.name_it,             NULL,           b.name_en,             l1, l2, l3, l4, l5), b.name),
        legislative_name: COALESCE(loc(b.legislative_name_de, b.legislative_name_fr, b.legislative_name_it, NULL,           b.legislative_name_en, l1, l2, l3, l4, l5), b.legislative_name),
        executive_name:   COALESCE(loc(b.executive_name_de,   b.executive_name_fr,   b.executive_name_it,   NULL,           b.executive_name_en,   l1, l2, l3, l4, l5), b.executive_name),
        type_name:                loc(b.type_name_de,         b.type_name_fr,        b.type_name_it,        b.type_name_rm, b.type_name_en,        l1, l2, l3, l4, l5)
    }
);
