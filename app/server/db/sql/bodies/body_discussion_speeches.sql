-- body_discussion_speeches.sql
--
-- Per-member word counts for the /parliaments/:id/discussion Wordfish prototype:
-- the ACTIVE members of one body (a parliament/chamber) and, for each, their
-- word frequencies over a SHARED time window. One SHARED window for everyone
-- (not each member's own begin_date) so the scaling axis reflects word choice,
-- not "old vs new member".
--
-- Tokenizing + per-language stopword removal + counting all happen in DuckDB —
-- same convention as person_vocabulary_by_id.sql: each speech is tokenized in
-- its OWN language (loc_lang) and filtered against the `stopwords` table for
-- that language (a French speech drops fr stopwords, a German one de, etc.). The
-- JS side (body_discussion.ts) only trims rare words, builds the document-term
-- matrix and runs Wordfish.
--
-- Requires macro_loc.sql (loc / loc_lang) + the `stopwords` table (lang, word;
-- both lowercased) on the same connection.
--
-- Slot map (bind in this exact order):
--   $1      INTEGER  body_id
--   $2..$6  VARCHAR  language priority for loc() (highest first, '' padded)
--   $7      DOUBLE   window_start (epoch-ms); keep speeches with date_start >= $7
--
-- Returns ONE ROW PER MEMBER who spoke in the window:
--   person_id       INTEGER
--   person_fullname VARCHAR
--   party_key       VARCHAR  stable party key (wikidata id / harmonized name) — colour
--   party_label     VARCHAR  localized party name — legend
--   n_speeches      INTEGER  speeches in the window
--   n_words         INTEGER  non-stopword tokens (length > 1)
--   date_from       DOUBLE   earliest speech date_start (epoch-ms)
--   date_to         DOUBLE   latest   speech date_start (epoch-ms)
--   words           LIST({ word VARCHAR, count INTEGER })  per-word counts
--
-- Zero rows when $1 matches no body, or the body's members made no speeches in
-- the window.

WITH

-- ── MEMBERS: active MPs of this body, with harmonized party for colouring ─────
members AS (
    SELECT
        p.id AS person_id,
        p.fullname AS person_fullname,
        -- stable colour key: harmonized wikidata id, else harmonized/raw name
        coalesce(
            p.party_harmonized_wikidata_id,
            p.party_harmonized_de,
            p.party_de
        ) AS party_key,
        -- localized display label for the legend
        coalesce(
            loc(p.party_harmonized_de, p.party_harmonized_fr, p.party_harmonized_it,
                NULL, p.party_harmonized_en, $2, $3, $4, $5, $6),
            p.party_de
        ) AS party_label
    FROM persons p
    WHERE p.body_id = $1
      AND p.active = TRUE
),

-- ── PICKED: one row per member speech in the window, carrying its language ────
picked AS (
    SELECT
        s.person_id,
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
    JOIN members mem ON mem.person_id = s.person_id
    WHERE s.date_start >= $7
),

-- ── TOKENS: unnest per speech, keeping the source speech's language ───────────
-- lower() is UTF-8 aware; \p{L} keeps accents (ü/é/à …), drops digits/punct.
tok AS (
    SELECT
        picked.person_id,
        picked.lang,
        unnest(regexp_split_to_array(lower(picked.text), '[^\p{L}]+')) AS word
    FROM picked
),

-- ── COUNTS: per-language stopword removal (anti-join on the speech's lang) ─────
wc AS (
    SELECT t.person_id, t.word, count(*) AS n
    FROM tok t
    LEFT JOIN stopwords sw
           ON sw.lang = t.lang
          AND sw.word = t.word
    WHERE length(t.word) > 1
      AND sw.word IS NULL
    GROUP BY t.person_id, t.word
),

-- ── PER-MEMBER speech tallies (independent of the vocabulary) ─────────────────
tally AS (
    SELECT
        person_id,
        count(*)        AS n_speeches,
        min(date_start) AS date_from,
        max(date_start) AS date_to
    FROM picked
    GROUP BY person_id
)

SELECT
    mem.person_id,
    mem.person_fullname,
    mem.party_key,
    mem.party_label,
    CAST(COALESCE(tal.n_speeches, 0) AS INTEGER) AS n_speeches,
    CAST(COALESCE((SELECT sum(n) FROM wc WHERE wc.person_id = mem.person_id), 0) AS INTEGER) AS n_words,
    tal.date_from,
    tal.date_to,
    COALESCE(
        (SELECT list({ word: word, count: CAST(n AS INTEGER) } ORDER BY n DESC, word)
         FROM wc WHERE wc.person_id = mem.person_id),
        []
    ) AS words
FROM members mem
JOIN tally tal ON tal.person_id = mem.person_id
ORDER BY mem.person_id;
