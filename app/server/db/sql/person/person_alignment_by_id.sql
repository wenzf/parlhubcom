-- ============================================================================
-- person_alignment_by_id.sql   (search / filter / sort enabled)
--
-- WHAT THIS SHOWS
--   The subject person ($1) vs EVERY OTHER member: how often the two voted the
--   SAME WAY. For each other member we look only at the votings BOTH took part in
--   ("shared ballots") and compute agreement = (ballots they voted identically)
--   / (shared ballots). So it is alignment OF voting behaviour, BETWEEN this
--   person and each colleague, measured only where their records overlap — not a
--   party line, not the whole chamber, just pairwise co-voting.
--
--   High agreement ⇒ they tend to vote together (an ally / same bloc); low
--   agreement ⇒ they tend to vote against each other. `shared` is reported per
--   row so a 100% built on 3 ballots is visibly weaker than 88% over 900; the
--   `min_shared` floor ($10) hides low-overlap noise, and the DATE RANGE ($11/$12)
--   narrows the comparison to a legislative period or any window of interest.
--
-- One person (full, localized) + a paginated list of these co-voting NEIGHBOURS,
-- plus the person's identity group + the bodies lookup — mirroring
-- person_votes_by_id.sql so this leaf is a valid `is_primary_data_match` (renders
-- PersonBase in the people result layout on its own).
--
-- AGREEMENT: over the votings where BOTH cast a vote, the share where the two
-- vote values are equal. `absent` is its OWN matching value (absent–absent is
-- agreement), so no vote is filtered out — `o.vote = me.vote` already encodes it.
--
-- Each neighbour row exposes `id` (= the other person's id, also the React key),
-- so the row satisfies FeedShell's `T extends { id }`.
--
-- SEARCH / FILTER / SORT (mirrors person_votes_by_id.sql):
--   nb_ranked flattens the neighbour columns (fullname / party / party_key /
--   group / shared / agreed / agreement) so predicates + ORDER BY can reference
--   them. nb_filtered applies the optional, NULL-disabled predicates; nb_lim is
--   the ordered + paginated slice; nb_agg's total_count counts the FILTERED set.
--   The DATE RANGE is applied earlier, in `me`, so it re-scopes the shared-ballot
--   set for every pair at once (agreement + shared both reflect the window).
--   ORDER BY is the only templated SQL: /* __ORDER_BY__ */ (at BOTH the nb_lim
--   slice and the nb_agg list) is replaced at runtime by a whitelisted fragment
--   from alignmentDescriptor (resolveOrderBy).
--
-- Parameters
--   $1  INTEGER   - person primary key (the subject; identities group on it)
--   $2..$6 VARCHAR - language priority codes
--   $7  INTEGER   - page size (LIMIT)   [also caps the bodies lookup]
--   $8  INTEGER   - page start (OFFSET)
--   -- filter slots (all optional; NULL = disabled). Order MUST match
--   -- alignmentDescriptor.toSqlParams in dimension_descriptors.ts:
--   $9  VARCHAR   - search term   (neighbour fullname; NULL = no search)
--   $10 INTEGER   - min_shared    (least shared ballots to rank; NULL = no floor)
--   $11 DOUBLE    - voting.date >= epoch ms (NULL = open lower bound)
--   $12 DOUBLE    - voting.date <= epoch ms (NULL = open upper bound)
-- ============================================================================

WITH
-- the subject's ballots, joined to the voting for its date so the window ($11/$12)
-- can re-scope the SHARED set (this narrows every pair's comparison at once).
me AS (
    SELECT v.voting_id, v.vote
    FROM votes v
    JOIN votings vt ON vt.id = v.voting_id
    WHERE v.person_id = $1
      AND ($11 IS NULL OR vt.date >= $11)
      AND ($12 IS NULL OR vt.date <= $12)
),

-- every other member scored over the shared ballots
paired AS (
    SELECT
        o.person_id                                AS other_id,
        count(*)                                   AS shared,
        count(*) FILTER (WHERE o.vote = me.vote)   AS agreed
    FROM me
    JOIN votes o ON o.voting_id = me.voting_id
    WHERE o.person_id <> $1
    GROUP BY o.person_id
),

-- flatten the neighbour's person columns so filters + ORDER BY can reference them.
-- `id` = the other person's id (row key + FeedShell requirement).
nb_ranked AS (
    SELECT
        pr.other_id                          AS id,
        pr.shared                            AS shared,
        pr.agreed                            AS agreed,
        pr.agreed::DOUBLE / pr.shared        AS agreement,
        np.fullname                          AS np_fullname,
        np.party_harmonized_wikidata_id      AS np_party_key,
        loc(np.party_de, np.party_fr, np.party_it, NULL, NULL, $2, $3, $4, $5, $6) AS np_party,
        loc(np.parliamentary_group_name_de, np.parliamentary_group_name_fr, np.parliamentary_group_name_it, np.parliamentary_group_name_rm, NULL, $2, $3, $4, $5, $6) AS np_group
    FROM paired pr
    JOIN persons np ON np.id = pr.other_id
),

-- Optional, NULL-disabled predicates. Same set as the descriptor's $9..$10 map.
nb_filtered AS (
    SELECT * FROM nb_ranked
    WHERE
        -- $9 search: neighbour fullname, case-insensitive substring
        ($9  IS NULL OR contains(lower(coalesce(np_fullname, '')), lower($9)))
        -- $10 minimum shared ballots (reliability floor)
        AND ($10 IS NULL OR shared >= $10)
),

-- Ordered + paginated slice. ORDER BY is the templated token (resolveOrderBy);
-- the sort sqlExprs reference agreement / shared / np_fullname / id.
nb_lim AS (
    SELECT * FROM nb_filtered
    ORDER BY /* __ORDER_BY__ */
    LIMIT $7 OFFSET $8
),

nb_agg AS (
    SELECT
        (SELECT count(*) FROM nb_filtered) AS total_count,
        list({
            id:                  id,
            person_id:           id,
            fullname:            np_fullname,
            party:               np_party,
            party_key:           np_party_key,
            parliamentary_group: np_group,
            shared:              shared,
            agreed:              agreed,
            agreement:           agreement
        } ORDER BY /* __ORDER_BY__ */) AS items
    FROM nb_lim
),

-- ── BODIES (mirrors person_votes_by_id.sql) ─────────────────────────────────
b_ids AS (
        SELECT body_id AS id   FROM persons           WHERE id                  = $1 AND body_id IS NOT NULL
    UNION
        SELECT body_id         FROM person_identities WHERE identity_primary_id = $1 AND body_id IS NOT NULL
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

-- ── PERSON IDENTITIES (primary + siblings; mirrors person_votes_by_id.sql) ──
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
        parliamentary_group_name: loc(p.parliamentary_group_name_de, p.parliamentary_group_name_fr, p.parliamentary_group_name_it, p.parliamentary_group_name_rm, NULL,                  $2, $3, $4, $5, $6),
        party:                    loc(p.party_de,                    p.party_fr,                    p.party_it,                    NULL,                          NULL,                  $2, $3, $4, $5, $6),
        party_harmonized:         loc(p.party_harmonized_de,         p.party_harmonized_fr,         p.party_harmonized_it,         NULL,                          p.party_harmonized_en, $2, $3, $4, $5, $6),
        website_parliament_url:   loc(p.website_parliament_url_de,   p.website_parliament_url_fr,   p.website_parliament_url_it,   NULL,                          NULL,                  $2, $3, $4, $5, $6),
        occupation:               loc(p.occupation_de,               p.occupation_fr,               p.occupation_it,               NULL,                          NULL,                  $2, $3, $4, $5, $6),
        marital_status:           loc(p.marital_status_de,           p.marital_status_fr,           p.marital_status_it,           NULL,                          NULL,                  $2, $3, $4, $5, $6),
        electoral_district:       loc(p.electoral_district_de,       p.electoral_district_fr,       p.electoral_district_it,       NULL,                          NULL,                  $2, $3, $4, $5, $6),
        function_latest:          loc(p.function_latest_de,          p.function_latest_fr,          p.function_latest_it,          p.function_latest_rm,          NULL,                  $2, $3, $4, $5, $6)
    } AS persons,
    { total_count: CAST(nb_agg.total_count AS INTEGER), items: COALESCE(nb_agg.items, []) } AS neighbours,
    { total_count: CAST(pi_agg.total_count AS INTEGER), items: COALESCE(pi_agg.items, []) } AS person_identities,
    { total_count: CAST(b_agg.total_count  AS INTEGER), items: COALESCE(b_agg.items,  []) } AS bodies
FROM persons p
CROSS JOIN nb_agg
CROSS JOIN pi_agg
CROSS JOIN b_agg
WHERE p.id = $1;