-- ============================================================================
-- affair_by_id.sql
--
-- The overview payload for ONE affair (parliamentary business item) by primary
-- key, localized to the requested language priority. Self-contained: an affair's
-- overview shows only its own fields, so — like body_by_id.sql — there are no
-- related-entity lists in this first cut (a /affairs/:id/votings feed can be
-- added later, mirroring the body feeds). Returns the single localized affair.
--
-- Requires macro_loc.sql on the same connection. Run with runByIdLocalized.
--
-- Parameters
--   $1     INTEGER  - primary key of the affair to fetch
--   $2..$6 VARCHAR  - language priority codes ('de'|'fr'|'it'|'rm'|'en'|NULL)
--
-- Output columns
--   affair   STRUCT  one localized AffairClient. ZERO rows when no affair matches
--                    $1 (runByIdLocalized -> undefined).
--   bodies   STRUCT { total_count, items }  response-scoped LOOKUP of the affair's
--                    linked body (b.id = affair.body_id), localized. 0 or 1 item.
--   agendas  STRUCT { total_count, items }  the agenda items linked to this affair
--                    (agendas.item_affair_id = affair.id). Not localized (single
--                    item_* columns). Empty list when none.
-- ============================================================================
WITH a AS (
    SELECT *
    FROM affairs
    WHERE id = $1
),
-- The affair's linked body (b.id = affair.body_id), localized with $2..$6.
-- Aggregate always yields one row (count 0 / [] when the affair has no body).
b_src AS (
    SELECT b.*,
        COUNT(*) OVER () AS _total
    FROM bodies b
        INNER JOIN a ON b.id = a.body_id
),
b_agg AS (
    SELECT COALESCE(MAX(_total), 0) AS total_count,
        list(
            body_struct(b_src, $2, $3, $4, $5, $6)
            ORDER BY id
        ) AS items
    FROM b_src
),
-- Agenda items linked to this affair (agendas.item_affair_id = affair.id).
-- Single-row aggregate (count 0 / [] when none). Not localized.
ag_src AS (
    SELECT *,
        COUNT(*) OVER () AS _total
    FROM agendas
    WHERE item_affair_id = $1
),
ag_agg AS (
    SELECT COALESCE(MAX(_total), 0) AS total_count,
        list(
            { id: id,
            body_id: body_id,
            body_key: body_key,
            meeting_id: meeting_id,
            item_date: item_date,
            item_external_id: item_external_id,
            item_title: item_title,
            item_number_display: item_number_display,
            item_category: item_category,
            item_url: item_url,
            item_affair_number: item_affair_number,
            item_affair_id: item_affair_id,
            item_language: item_language,
            item_description: item_description,
            item_number: item_number,
            item_result: item_result,
            item_status: item_status,
            created_at: created_at }
            ORDER BY item_date NULLS LAST,
                item_number NULLS LAST,
                id
        ) AS items
    FROM ag_src
),
v_lim AS (
    SELECT *
    FROM votings
    WHERE affair_id = $1
    ORDER BY date DESC NULLS LAST
    LIMIT 5
), v_agg AS (
    SELECT (
            SELECT count(*)
            FROM votings
            WHERE affair_id = $1
        ) AS total_count,
        list(
            { id: id,
            body_id: body_id,
            body_key: body_key,
            external_id: external_id,
            date: date,
            external_alternative_id: external_alternative_id,
            affair_id: affair_id,
            results_yes: results_yes,
            results_no: results_no,
            results_abstention: results_abstention,
            results_absent: results_absent,
            results_string: results_string,
            decision: decision,
            meeting_id: meeting_id,
            group_id: group_id,
            group_external_id: group_external_id,
            created_at: created_at,
            updated_at: updated_at,
            updated_external_at: updated_external_at,
            -- localized voting fields
            title: loc(
                title_de,
                title_fr,
                title_it,
                NULL,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            url_external: loc(
                url_external_de,
                url_external_fr,
                url_external_it,
                NULL,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            "type": loc(
                type_de,
                type_fr,
                type_it,
                NULL,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            meaning_of_yes: loc(
                meaning_of_yes_de,
                meaning_of_yes_fr,
                meaning_of_yes_it,
                NULL,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            meaning_of_no: loc(
                meaning_of_no_de,
                meaning_of_no_fr,
                meaning_of_no_it,
                NULL,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            affair_title: loc(
                affair_title_de,
                affair_title_fr,
                affair_title_it,
                NULL,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ) }
            ORDER BY date DESC NULLS LAST
        ) AS items
    FROM v_lim
),
e_lim AS (
    SELECT *
    FROM events
    WHERE affair_id = $1
    ORDER BY date DESC NULLS LAST
    LIMIT 5
), e_agg AS (
    SELECT (
            SELECT count(*)
            FROM events
            WHERE affair_id = $1
        ) AS total_count,
        list(
            { id: id,
            body_id: body_id,
            body_key: body_key,
            external_id: external_id,
            date: CAST(date AS VARCHAR),
            "position": position,
            title_external_id: title_external_id,
            actor_external_id: actor_external_id,
            actor_type: actor_type,
            affair_id: affair_id,
            meeting_parent_type: meeting_parent_type,
            meeting_id: meeting_id,
            meeting_parent_external_id: meeting_parent_external_id,
            details_url: details_url,
            details_text: details_text,
            "last": last,
            created_at: created_at,
            updated_at: updated_at,
            updated_external_at: updated_external_at,
            -- localized
            title: loc(
                title_de,
                title_fr,
                title_it,
                title_rm,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            title_harmonized: loc(
                title_harmonized_de,
                title_harmonized_fr,
                title_harmonized_it,
                title_harmonized_rm,
                title_harmonized_en,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            actor: loc(
                actor_de,
                actor_fr,
                actor_it,
                NULL,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ) }
            ORDER BY date DESC NULLS LAST
        ) AS items
    FROM e_lim
),
c_lim AS (
    SELECT *
    FROM contributors
    WHERE affair_id = $1
    ORDER BY "position" ASC NULLS LAST
    LIMIT 5
), c_agg AS (
    SELECT (
            SELECT count(*)
            FROM contributors
            WHERE affair_id = $1
        ) AS total_count,
        list(
            { id: id,
            body_id: body_id,
            body_key: body_key,
            external_id: external_id,
            affair_id: affair_id,
            news_id: news_id,
            person_id: person_id,
            group_id: group_id,
            meeting_id: meeting_id,
            session_id: session_id,
            "type": type,
            role_external_id: role_external_id,
            firstname: firstname,
            lastname: lastname,
            fullname: fullname,
            party_wikidata_id: party_wikidata_id,
            "position": position,
            created_at: created_at,
            updated_at: updated_at,
            updated_external_at: updated_external_at,
            -- localized
            role: loc(
                role_de,
                role_fr,
                role_it,
                role_rm,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            role_harmonized: loc(
                role_harmonized_de,
                role_harmonized_fr,
                role_harmonized_it,
                role_harmonized_rm,
                role_harmonized_en,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            party: loc(
                party_de,
                party_fr,
                party_it,
                party_rm,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            party_harmonized: loc(
                party_harmonized_de,
                party_harmonized_fr,
                party_harmonized_it,
                NULL,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ) }
            ORDER BY "position" ASC NULLS LAST
        ) AS items
    FROM c_lim
),
d_lim AS (
    SELECT *
    FROM docs
    WHERE affair_id = $1
    ORDER BY date DESC NULLS LAST
    LIMIT 5
), d_agg AS (
    SELECT (
            SELECT count(*)
            FROM docs
            WHERE affair_id = $1
        ) AS total_count,
        list(
            { id: id,
            body_id: body_id,
            body_key: body_key,
            parent_type: parent_type,
            hash: hash,
            external_id: external_id,
            external_alternative_id: external_alternative_id,
            name: name,
            url: url,
            url_oparl: url_oparl,
            date: CAST(date AS VARCHAR),
            size: size,
            category_harmonized: category_harmonized,
            format: format,
            "language": language,
            updated_external_at: CAST(updated_external_at AS VARCHAR),
            updated_at: CAST(updated_at AS VARCHAR),
            text: NULL,
            tika_metadata: NULL,
            affair_id: affair_id,
            meeting_id: meeting_id,
            agenda_id: agenda_id,
            news_id: news_id,
            -- localized
            category: loc(
                category_de,
                category_fr,
                category_it,
                NULL,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ) }
            ORDER BY date DESC NULLS LAST
        ) AS items
    FROM d_lim
),
t_lim AS (
    SELECT *
    FROM texts
    WHERE affair_id = $1
    ORDER BY text_date DESC NULLS LAST
    LIMIT 5
), t_agg AS (
    SELECT (
            SELECT count(*)
            FROM texts
            WHERE affair_id = $1
        ) AS total_count,
        list(
            { id: id,
            body_id: body_id,
            body_key: body_key,
            external_id: external_id,
            affair_id: affair_id,
            type_en: type_en,
            text_format: text_format,
            text_date: CAST(text_date AS VARCHAR),
            created_at: created_at,
            updated_at: updated_at,
            updated_external_at: updated_external_at,
            "type": loc(
                type_de,
                type_fr,
                type_it,
                type_rm,
                type_en,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            "text": loc(
                text_de,
                text_fr,
                text_it,
                text_rm,
                NULL,
                $2,
                $3,
                $4,
                $5,
                $6
            ),
            affair_title: (
                SELECT loc(
                        a.title_de,
                        a.title_fr,
                        a.title_it,
                        a.title_rm,
                        NULL,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6
                    )
                FROM affairs a
                WHERE a.id = affair_id
            ) }
            ORDER BY text_date DESC NULLS LAST
        ) AS items
    FROM t_lim
)
SELECT { id: id,
    body_id: body_id,
    body_key: body_key,
    number: number,
    external_id: external_id,
    external_alternative_id: external_alternative_id,
    type_harmonized_id: type_harmonized_id,
    type_harmonized_wikidata_id: type_harmonized_wikidata_id,
    state_name_harmonized_id: state_name_harmonized_id,
    active: active,
    type_external_id: type_external_id,
    state_external_id: state_external_id,
    begin_date: begin_date,
    end_date: end_date,
    created_at: created_at,
    updated_at: updated_at,
    updated_external_at: updated_external_at,
    title: loc(
        title_de,
        title_fr,
        title_it,
        title_rm,
        NULL,
        $2,
        $3,
        $4,
        $5,
        $6
    ),
    title_long: loc(
        title_long_de,
        title_long_fr,
        title_long_it,
        title_long_rm,
        NULL,
        $2,
        $3,
        $4,
        $5,
        $6
    ),
    type_harmonized: loc(
        type_harmonized_de,
        type_harmonized_fr,
        type_harmonized_it,
        type_harmonized_rm,
        type_harmonized_en,
        $2,
        $3,
        $4,
        $5,
        $6
    ),
    type_name: loc(
        type_name_de,
        type_name_fr,
        type_name_it,
        type_name_rm,
        NULL,
        $2,
        $3,
        $4,
        $5,
        $6
    ),
    state_name_harmonized: loc(
        state_name_harmonized_de,
        state_name_harmonized_fr,
        state_name_harmonized_it,
        state_name_harmonized_rm,
        NULL,
        $2,
        $3,
        $4,
        $5,
        $6
    ),
    state_name: loc(
        state_name_de,
        state_name_fr,
        state_name_it,
        NULL,
        NULL,
        $2,
        $3,
        $4,
        $5,
        $6
    ),
    url_external: loc(
        url_external_de,
        url_external_fr,
        url_external_it,
        url_external_rm,
        NULL,
        $2,
        $3,
        $4,
        $5,
        $6
    ) } AS affair,
    { total_count: CAST(b_agg.total_count AS INTEGER),
    items: COALESCE(b_agg.items, []) } AS bodies,
    { total_count: CAST(ag_agg.total_count AS INTEGER),
    items: COALESCE(ag_agg.items, []) } AS agendas,
    -- overview snippet slices (first 5 each; full totals). Docs omitted: that
    -- table is not loaded (db.ts) — the overview injects an empty docs list.
    { total_count: CAST(v_agg.total_count AS INTEGER),
    items: COALESCE(v_agg.items, []) } AS votings,
    { total_count: CAST(e_agg.total_count AS INTEGER),
    items: COALESCE(e_agg.items, []) } AS events,
    { total_count: CAST(c_agg.total_count AS INTEGER),
    items: COALESCE(c_agg.items, []) } AS contributors,
    -- REQUIRES the docs table (db.ts) — without it this SQL (and every affair
    -- page, since the layout runs it) errors with "Table docs does not exist".
    { total_count: CAST(d_agg.total_count AS INTEGER),
    items: COALESCE(d_agg.items, []) } AS docs,
    -- REQUIRES the texts table (db.ts) — same load dependency as docs.
    { total_count: CAST(t_agg.total_count AS INTEGER),
    items: COALESCE(t_agg.items, []) } AS texts
FROM a,
    b_agg,
    ag_agg,
    v_agg,
    e_agg,
    c_agg,
    d_agg,
    t_agg;