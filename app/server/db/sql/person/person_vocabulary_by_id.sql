-- ============================================================================
-- person_topics_by_id.sql        → ~/server/db/sql/person/person_topics_by_id.sql
--
-- The /people/:id/vocabulary payload, in ONE localized row — same shape family
-- as person_votes_by_id.sql:
--   persons           STRUCT  PersonClientSchema (for the layout + <PersonBase/>)
--   person_identities STRUCT  { total_count, items[] } IdentityClientSchema
--   bodies            STRUCT  { total_count, items[] } BodyClientSchema
--                             (the person's OWN body via persons + identities —
--                              all <PersonBase/> labels)
--   topics            STRUCT  word-frequency for the treemap, computed here:
--                             { n_speeches, n_words, n_distinct, data_from,
--                               data_to, words:[{word,count}] }
--
-- Word counting is done in DuckDB: pick each speech's localized transcript AND
-- its language tag (loc / loc_lang), strip tags, tokenize, then remove stopwords
-- by anti-joining the `stopwords` table ON THAT SPEECH'S OWN LANGUAGE — a French
-- speech is filtered against fr stopwords, a German one against de, etc.
--
-- Requires macro_loc.sql (loc/loc_lang) + the `stopwords` table (lang, word;
-- both lowercased) on the same connection. person_topics.ts binds the params
-- and wraps `topics` with the window presets / iso formatting.
--
-- Parameters
--   $1      INTEGER  person_id (PRIMARY id; identities group on it)
--   $2..$6  VARCHAR  language priority ('de'|'fr'|'it'|'rm'|'en'|NULL), padded
--   $7      DOUBLE   window_start (epoch-ms) or NULL = open
--   $8      DOUBLE   window_end   (epoch-ms) or NULL = open
--   $9      INTEGER  min_count — drop words said fewer than this many times
--   $10     INTEGER  top_n     — max words returned in the treemap
--
-- Zero rows when $1 matches no person (→ 404).
-- ============================================================================

WITH

-- ── PERSON IDENTITIES (IdentityClientSchema) — the person's identity group ────
pi_lim AS (
    SELECT * FROM person_identities WHERE identity_primary_id = $1 ORDER BY id
),
pi_agg AS (
    SELECT
        (SELECT count(*) FROM person_identities WHERE identity_primary_id = $1) AS total_count,
        list({
            id:                          id,
            identity_primary_id:         identity_primary_id,
            body_id:                     body_id,
            body_key:                    body_key,
            external_id:                 external_id,
            fullname:                    fullname,
            firstname:                   firstname,
            lastname:                    lastname,
            party_harmonized_wikidata_id: party_harmonized_wikidata_id,
            image_url_external:          image_url_external,
            email:                       email,
            phone:                       phone,
            birthday:                    birthday,
            birthday_format:             birthday_format,
            deathday:                    deathday,
            street:                      street,
            postal_code:                 postal_code,
            city:                        city,
            title:                       title,
            website_personal:            website_personal,
            gender:                      gender,
            active:                      active,
            "language":                    language,
            wikidata_id:                 wikidata_id,
            is_primary:                  is_primary,
            created_at:                  created_at,
            updated_at:                  updated_at,
            updated_external_at:         updated_external_at,
            -- localized
            party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,                  $2, $3, $4, $5, $6),
            party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en,   $2, $3, $4, $5, $6),
            occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,                  $2, $3, $4, $5, $6),
            marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,                  $2, $3, $4, $5, $6),
            electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,                  $2, $3, $4, $5, $6),
            parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                  $2, $3, $4, $5, $6),
            website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,                  $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM pi_lim
),

-- ── BODIES (BodyClientSchema) — the person's OWN body(ies) only ───────────────
b_ids AS (
        SELECT body_id AS id FROM persons            WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id       FROM person_identities  WHERE identity_primary_id = $1 AND body_id IS NOT NULL
),
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total
    FROM bodies b
    INNER JOIN b_ids ON b.id = b_ids.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
),

-- ── TOPICS: per-speech localized text + language, tokenized + counted ─────────
--    picked → one row per speech in the window, carrying its language tag.
picked AS (
    SELECT
        loc_lang(s.text_content_de, s.text_content_fr, s.text_content_it,
                 NULL, NULL, $2, $3, $4, $5, $6) AS lang,
        s.date_start,
        regexp_replace(
            coalesce(
                loc(s.text_content_de, s.text_content_fr, s.text_content_it,
                    NULL, NULL, $2, $3, $4, $5, $6),
                ''),
            '<[^>]*>', ' ', 'g'
        ) AS text
    FROM speeches s
    WHERE s.person_id = $1
      AND ($7 IS NULL OR s.date_start >= $7)
      AND ($8 IS NULL OR s.date_start <= $8)
),
-- tokens keep the source speech's language; lower() is UTF-8 aware, \p{L} keeps accents.
tok AS (
    SELECT
        picked.lang,
        unnest(regexp_split_to_array(lower(picked.text), '[^\p{L}]+')) AS word
    FROM picked
),
-- word counts after per-language stopword removal (anti-join on the speech's lang)
wc AS (
    SELECT t.word, count(*) AS n
    FROM tok t
    LEFT JOIN stopwords sw
           ON sw.lang = t.lang
          AND sw.word = t.word
    WHERE length(t.word) > 1
      AND sw.word IS NULL
    GROUP BY t.word
),
tp_agg AS (
    SELECT
        (SELECT count(*)              FROM picked) AS n_speeches,   -- speeches in window
        (SELECT COALESCE(sum(n), 0)   FROM wc)     AS n_words,      -- non-stopword tokens
        (SELECT count(*)              FROM wc)     AS n_distinct,   -- distinct non-stopword words
        (SELECT min(date_start)       FROM picked) AS data_from,
        (SELECT max(date_start)       FROM picked) AS data_to,
        (
            SELECT list({ word: word, count: CAST(n AS INTEGER) } ORDER BY n DESC, word)
            FROM (
                SELECT word, n FROM wc WHERE n >= $9 ORDER BY n DESC, word LIMIT $10
            )
        ) AS words
)

SELECT
    -- PERSONS — flat struct (PersonClientSchema)
    {
        id:                              p.id,
        body_id:                         p.body_id,
        body_key:                        p.body_key,
        external_id:                     p.external_id,
        external_alternative_id:         p.external_alternative_id,
        firstname:                       p.firstname,
        lastname:                        p.lastname,
        fullname:                        p.fullname,
        birthday:                        p.birthday,
        birthday_format:                 p.birthday_format,
        deathday:                        p.deathday,
        gender:                          p.gender,
        party_external_id:               p.party_external_id,
        party_harmonized_wikidata_id:    p.party_harmonized_wikidata_id,
        parliamentary_group_external_id: p.parliamentary_group_external_id,
        image_url_external:              p.image_url_external,
        image_url_oparl:                 p.image_url_oparl,
        email:                           p.email,
        phone:                           p.phone,
        street:                          p.street,
        postal_code:                     p.postal_code,
        city:                            p.city,
        title:                           p.title,
        website_personal:                p.website_personal,
        parliament_sector:               p.parliament_sector,
        parliament_seat:                 p.parliament_seat,
        active:                          p.active,
        "language":                        p.language,
        function_latest_external_id:     p.function_latest_external_id,
        wikidata_id:                     p.wikidata_id,
        created_at:                      p.created_at,
        updated_at:                      p.updated_at,
        updated_external_at:             p.updated_external_at,
        -- localized
        parliamentary_group_name: loc(p.parliamentary_group_name_de, p.parliamentary_group_name_fr, p.parliamentary_group_name_it, p.parliamentary_group_name_rm, NULL,                  $2, $3, $4, $5, $6),
        party:                    loc(p.party_de,                    p.party_fr,                    p.party_it,                    NULL,                          NULL,                  $2, $3, $4, $5, $6),
        party_harmonized:         loc(p.party_harmonized_de,         p.party_harmonized_fr,         p.party_harmonized_it,         NULL,                          p.party_harmonized_en, $2, $3, $4, $5, $6),
        website_parliament_url:   loc(p.website_parliament_url_de,   p.website_parliament_url_fr,   p.website_parliament_url_it,   NULL,                          NULL,                  $2, $3, $4, $5, $6),
        occupation:               loc(p.occupation_de,               p.occupation_fr,               p.occupation_it,               NULL,                          NULL,                  $2, $3, $4, $5, $6),
        marital_status:           loc(p.marital_status_de,           p.marital_status_fr,           p.marital_status_it,           NULL,                          NULL,                  $2, $3, $4, $5, $6),
        electoral_district:       loc(p.electoral_district_de,       p.electoral_district_fr,       p.electoral_district_it,       NULL,                          NULL,                  $2, $3, $4, $5, $6),
        function_latest:          loc(p.function_latest_de,          p.function_latest_fr,          p.function_latest_it,          p.function_latest_rm,          NULL,                  $2, $3, $4, $5, $6)
    } AS persons,

    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count  AS INTEGER), items: COALESCE(b_agg.items,  []) } AS bodies,

    -- TOPICS — treemap word data (counts CAST so BIGINT doesn't serialize as string)
    {
        n_speeches: CAST(tp_agg.n_speeches AS INTEGER),
        n_words:    CAST(tp_agg.n_words    AS INTEGER),
        n_distinct: CAST(tp_agg.n_distinct AS INTEGER),
        data_from:  tp_agg.data_from,
        data_to:    tp_agg.data_to,
        words:      COALESCE(tp_agg.words, [])
    } AS topics

FROM persons p
CROSS JOIN pi_agg
CROSS JOIN b_agg
CROSS JOIN tp_agg
WHERE p.id = $1;