-- ============================================================================
-- person_speeches_by_id.sql
--
-- One person (full, localized) + a single PAGINATED related list: speeches.
-- Companion to person_by_id.sql; requires macro_loc.sql on the same connection.
--
-- Parameters
--   $1  INTEGER  - person primary key
--   $2..$6 VARCHAR - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--   $7  INTEGER  - page size  (LIMIT)
--   $8  INTEGER  - page start (OFFSET; the `from` index, 0-based)
--   -- filter slots (all optional; NULL disables that predicate) --------------
--   $9  VARCHAR  - search REGEX PATTERN (built from the term + the case/word
--                  options; see buildTextSearchPattern) over the transcript
--                  text_content (localized), with XML/HTML tags stripped so
--                  markup never matches. NULL = none.
--   $10 VARCHAR  - type_external_id  (stable code; label = type_external) (NULL = any)
--   $11 BOOLEAN  - has_video  (video_url IS NOT NULL)                      (NULL = any)
--   $12 INTEGER  - body_id                                                 (NULL = any)
--   $13 DOUBLE   - date_start >= (epoch millis)                            (NULL = open)
--   $14 DOUBLE   - date_start <= (epoch millis)                            (NULL = open)
--
-- ORDER BY
--   The ORDER BY placeholder token (in sp_lim AND the sp_agg list) is replaced by
--   runPersonPaginatedFiltered() with a WHITELISTED fragment (descriptor sorts).
--   Default fragment: `date_start DESC NULLS LAST, id DESC`.
--
-- Output columns
--   persons STRUCT                              - PersonClientSchema (flat)
--   speeches STRUCT { total_count, items }      - SpeechClientSchema, paginated
--   person_identities STRUCT { total_count, items } - IdentityClientSchema
--   bodies STRUCT { total_count, items }        - BodyClientSchema
--   affairs STRUCT { total_count, items }       - AffairClientSchema, response-scoped
--                                                 (affairs.id = speeches.affair_id)
--   meetings STRUCT { total_count, items }      - MeetingClientSchema, response-scoped
--                                                 (meetings.id = speeches.meeting_id)
--   agendas STRUCT { total_count, items }       - AgendaClientSchema, response-scoped
--                                                 (agendas.id = speeches.agenda_id)
--   all three response-scoped lists are limited to the returned page (sp_lim)
--
-- Identity scope
--   The list (and its total_count) is WIDENED to the person's whole identity
--   group via the shared sibling_ids($1) macro (macro_loc.sql): it scopes to
--   person_id IN (SELECT person_id FROM sibling_ids($1)), so rows recorded under
--   any sibling identity are included. Collapses to {$1} when there are none.
--
-- Performance
--   With every filter slot NULL and the default ORDER BY, sp_filtered's WHERE
--   collapses to just the person scope and the read stays on the
--   (person_id, date_start DESC NULLS LAST) clustering from db.server.ts — the
--   original fast path. A search strips tags per row, but only over the (small)
--   per-person block and only when $9 is present.
-- ============================================================================

WITH
-- All of the person's speeches that satisfy the active predicates. Single source
-- for BOTH the page slice and the count, so total_count tracks the rows.
sp_filtered AS (
    SELECT * FROM speeches
    WHERE person_id IN (SELECT person_id FROM sibling_ids($1))
      -- search ($9): a REGEX PATTERN (built from the search term + the case/word
      -- options; see buildTextSearchPattern) matched over the transcript with
      -- XML/HTML tags stripped (regexp_replace '<...>' → space) so markup like
      -- <pd_text>/<p> never matches. Localized via loc(). Case-folding and
      -- whole-word (\b) are encoded in the pattern itself (inline (?i) prefix),
      -- so the predicate no longer lower()s either side. Mirrors speeches_list.sql
      -- ($8). Scanned only when a pattern is present ($9 IS NULL short-circuit).
      AND ($9 IS NULL OR regexp_matches(
            regexp_replace(
                coalesce(loc(text_content_de, text_content_fr, text_content_it, NULL, NULL, $2, $3, $4, $5, $6), ''),
                '<[^>]*>', ' ', 'g'),
            $9
      ))
      -- type ($10): stable type_external_id code (label localized as type_external)
      AND ($10 IS NULL OR type_external_id = $10)
      -- has video ($11): whether the speech carries a video_url
      AND ($11 IS NULL OR (video_url IS NOT NULL) = $11)
      -- source body ($12)
      AND ($12 IS NULL OR body_id = $12)
      -- date_start range ($13 lower, $14 upper; epoch millis)
      AND ($13 IS NULL OR date_start >= $13)
      AND ($14 IS NULL OR date_start <= $14)
),
sp_lim AS (
    SELECT * FROM sp_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),
sp_agg AS (
    SELECT
        (SELECT count(*) FROM sp_filtered) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            person_id:           person_id,
            date_start:          date_start,
            date_end:            date_end,
            type_external_id:    type_external_id,
            affair_id:           affair_id,
            meeting_id:          meeting_id,
            agenda_external_id:  agenda_external_id,
            agenda_id:           agenda_id,
            url:                 url,
            audio_url:           audio_url,
            video_url:           video_url,
            meeting_external_id: meeting_external_id,
            meeting_type:        meeting_type,
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            -- localized
            person_role:   COALESCE(loc(person_role_de, person_role_fr, person_role_it, NULL, NULL, $2, $3, $4, $5, $6), person_role),
            text_content:  loc(text_content_de,  text_content_fr,  text_content_it,  NULL, NULL, $2, $3, $4, $5, $6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL, NULL, $2, $3, $4, $5, $6),
            -- the language tag `text_content` was resolved from (de|fr|it), via
            -- loc_lang — same args as the loc() above, so the two always agree.
            -- Consumed as the transcript's lang attribute (WCAG 3.1.2).
            speech_lang:   loc_lang(text_content_de, text_content_fr, text_content_it, NULL, NULL, $2, $3, $4, $5, $6)
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM sp_lim
)
, b_ids AS (
        SELECT body_id AS id   FROM persons           WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM sp_lim             WHERE body_id IS NOT NULL
),
b_src AS (
    SELECT b.*, COUNT(*) OVER () AS _total, ROW_NUMBER() OVER (ORDER BY b.id) AS _rn
    FROM bodies b
    INNER JOIN b_ids ON b.id = b_ids.id
),
b_agg AS (
    SELECT
        COALESCE(MAX(_total), 0) AS total_count,
        list(body_struct(b_src, $2, $3, $4, $5, $6) ORDER BY id) AS items
    FROM b_src
    WHERE _rn <= $7
),
pi_agg AS (
    SELECT
        (SELECT count(*) FROM person_identities WHERE identity_primary_id = $1) AS total_count,
        list({
            id:                           id,
            identity_primary_id:          identity_primary_id,
            body_id:                      body_id,
            body_key:                     body_key,
            external_id:                  external_id,
            fullname:                     fullname,
            firstname:                    firstname,
            lastname:                     lastname,
            party_harmonized_wikidata_id: party_harmonized_wikidata_id,
            image_url_external:           image_url_external,
            email:                        email,
            phone:                        phone,
            birthday:                     birthday,
            birthday_format:              birthday_format,
            deathday:                     deathday,
            street:                       street,
            postal_code:                  postal_code,
            city:                         city,
            title:                        title,
            website_personal:             website_personal,
            gender:                       gender,
            active:                       active,
            "language":                   language,
            wikidata_id:                  wikidata_id,
            is_primary:                   is_primary,
            created_at:                   created_at,
            updated_at:                   updated_at,
            updated_external_at:          updated_external_at,
            -- localized
            party:                    loc(party_de,                    party_fr,                    party_it,                    NULL,                        NULL,                $2, $3, $4, $5, $6),
            party_harmonized:         loc(party_harmonized_de,         party_harmonized_fr,         party_harmonized_it,         NULL,                        party_harmonized_en, $2, $3, $4, $5, $6),
            occupation:               loc(occupation_de,               occupation_fr,               occupation_it,               NULL,                        NULL,                $2, $3, $4, $5, $6),
            marital_status:           loc(marital_status_de,           marital_status_fr,           marital_status_it,           NULL,                        NULL,                $2, $3, $4, $5, $6),
            electoral_district:       loc(electoral_district_de,       electoral_district_fr,       electoral_district_it,       NULL,                        NULL,                $2, $3, $4, $5, $6),
            parliamentary_group_name: loc(parliamentary_group_name_de, parliamentary_group_name_fr, parliamentary_group_name_it, parliamentary_group_name_rm, NULL,                $2, $3, $4, $5, $6),
            website_parliament_url:   loc(website_parliament_url_de,   website_parliament_url_fr,   website_parliament_url_it,   NULL,                        NULL,                $2, $3, $4, $5, $6)
        } ORDER BY is_primary DESC NULLS LAST, id) AS items
    FROM person_identities
    WHERE identity_primary_id = $1
)
, -- ──────────────────────────────────────────────────────────────────────────────
-- AFFAIRS  (AffairClientSchema) — response-scoped
--   Only affairs linked to the speech rows actually returned on this page
--   (affairs.id = speeches.affair_id, sourced from sp_lim — NOT full history).
-- ──────────────────────────────────────────────────────────────────────────────
af_ids AS (
    SELECT DISTINCT affair_id AS id FROM sp_lim WHERE affair_id IS NOT NULL
),
af_src AS (
    SELECT af.*
    FROM affairs af
    INNER JOIN af_ids ON af.id = af_ids.id
),
af_agg AS (
    SELECT
        COUNT(*) AS total_count,
        list({
            id:                          id,
            body_id:                     body_id,
            body_key:                    body_key,
            number:                      number,
            external_id:                 external_id,
            external_alternative_id:     external_alternative_id,
            type_harmonized_id:          type_harmonized_id,
            type_harmonized_wikidata_id: type_harmonized_wikidata_id,
            state_name_harmonized_id:    state_name_harmonized_id,
            active:                      active,
            type_external_id:            type_external_id,
            state_external_id:           state_external_id,
            begin_date:                  begin_date,
            end_date:                    end_date,
            created_at:                  created_at,
            updated_at:                  updated_at,
            updated_external_at:         updated_external_at,
            -- localized
            type_harmonized:       loc(type_harmonized_de,       type_harmonized_fr,       type_harmonized_it,       type_harmonized_rm,       type_harmonized_en, $2, $3, $4, $5, $6),
            state_name_harmonized: loc(state_name_harmonized_de, state_name_harmonized_fr, state_name_harmonized_it, state_name_harmonized_rm, NULL,               $2, $3, $4, $5, $6),
            title:                 loc(title_de,                 title_fr,                 title_it,                 title_rm,                 NULL,               $2, $3, $4, $5, $6),
            title_long:            loc(title_long_de,            title_long_fr,            title_long_it,            title_long_rm,            NULL,               $2, $3, $4, $5, $6),
            type_name:             loc(type_name_de,             type_name_fr,             type_name_it,             type_name_rm,             NULL,               $2, $3, $4, $5, $6),
            state_name:            loc(state_name_de,            state_name_fr,            state_name_it,            state_name_rm,            NULL,               $2, $3, $4, $5, $6),
            url_external:          loc(url_external_de,          url_external_fr,          url_external_it,          url_external_rm,          NULL,               $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM af_src
),
-- ──────────────────────────────────────────────────────────────────────────────
-- MEETINGS  (MeetingClientSchema) — response-scoped
--   Only meetings linked to the speech rows actually returned on this page
--   (meetings.id = speeches.meeting_id, sourced from sp_lim — NOT full history).
-- ──────────────────────────────────────────────────────────────────────────────
mt_ids AS (
    SELECT DISTINCT meeting_id AS id FROM sp_lim WHERE meeting_id IS NOT NULL
),
mt_src AS (
    SELECT mt.*
    FROM meetings mt
    INNER JOIN mt_ids ON mt.id = mt_ids.id
),
mt_agg AS (
    SELECT
        COUNT(*) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            external_id:         external_id,
            "type":              type,
            group_id:            group_id,
            parent_type:         parent_type,
            parent_external_id:  parent_external_id,
            parent_oparl_id:     parent_oparl_id,
            state:               state,
            abbreviation:        abbreviation,
            number:              number,
            begin_date:          begin_date,
            end_date:            end_date,
            location:            location,
            created_at:          created_at,
            updated_at:          updated_at,
            updated_external_at: updated_external_at,
            -- localized
            name:          loc(name_de,          name_fr,          name_it,          name_rm, NULL, $2, $3, $4, $5, $6),
            description:   loc(description_de,   description_fr,   description_it,   NULL,    NULL, $2, $3, $4, $5, $6),
            type_external: loc(type_external_de, type_external_fr, type_external_it, NULL,    NULL, $2, $3, $4, $5, $6),
            url_external:  loc(url_external_de,  url_external_fr,  url_external_it,  url_external_rm, NULL, $2, $3, $4, $5, $6)
        } ORDER BY id) AS items
    FROM mt_src
),
-- ──────────────────────────────────────────────────────────────────────────────
-- AGENDAS  (AgendaClientSchema) — response-scoped
--   Agenda items of the speech rows actually returned on this page
--   (agendas.id = speeches.agenda_id, sourced from sp_lim — NOT full history).
-- ──────────────────────────────────────────────────────────────────────────────
ag_ids AS (
    SELECT DISTINCT agenda_id AS id FROM sp_lim WHERE agenda_id IS NOT NULL
),
ag_src AS (
    SELECT ag.*
    FROM agendas ag
    INNER JOIN ag_ids ON ag.id = ag_ids.id
),
ag_agg AS (
    SELECT
        COUNT(*) AS total_count,
        list({
            id:                  id,
            body_id:             body_id,
            body_key:            body_key,
            meeting_id:          meeting_id,
            item_date:           item_date,
            item_external_id:    item_external_id,
            item_title:          item_title,
            item_number_display: item_number_display,
            item_category:       item_category,
            item_url:            item_url,
            item_affair_number:  item_affair_number,
            item_affair_id:      item_affair_id,
            item_language:       item_language,
            item_description:    item_description,
            item_number:         item_number,
            item_result:         item_result,
            item_status:         item_status,
            created_at:          created_at
        } ORDER BY id) AS items
    FROM ag_src
)
SELECT
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
        "language":                      p.language,
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
    { total_count: CAST(sp_agg.total_count AS INTEGER), items: COALESCE(sp_agg.items, []) } AS speeches,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count AS INTEGER), items: COALESCE(b_agg.items, []) } AS bodies, -- added
    { total_count: CAST(af_agg.total_count AS INTEGER), items: COALESCE(af_agg.items, []) } AS affairs,  -- added
    { total_count: CAST(mt_agg.total_count AS INTEGER), items: COALESCE(mt_agg.items, []) } AS meetings, -- added
    { total_count: CAST(ag_agg.total_count AS INTEGER), items: COALESCE(ag_agg.items, []) } AS agendas   -- added
FROM persons p
CROSS JOIN sp_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg  -- added
CROSS JOIN af_agg  -- added
CROSS JOIN mt_agg  -- added
CROSS JOIN ag_agg  -- added
WHERE p.id = $1;