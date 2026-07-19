"server-only";
// app/server/experiments_data.server.ts
//
// Data for /experiments/wordfish — the list of parliaments whose speech data is
// rich enough for the Wordfish scaling (the /parliaments/:id/discussion chart) to
// render something meaningful.
//
// A member can be placed on the axis only if the corpus holds the actual TEXT of
// their speeches, and only a handful of bodies have that. This computes the same
// "displayable" set the discussion page produces at its default 12-month window:
// a body qualifies when at least MIN_MEMBERS of its active members have a speech
// WITH transcript text inside that window. Each row also carries the FULL span of
// available transcript speeches (all-time), shown as the parliament's coverage.
//
// Like start_data.server.ts, the result only changes when a new data.duckdb is
// swapped in, so it's computed once per language and cached for the process.

import { db } from "~/server/db/core";
import type { SiteLangs } from "@/types/site";

/** Min placeable members for a parliament to be worth listing. Below ~10 the
 *  scaling is a couple of dots on a line — technically renders, not meaningful. */
const MIN_MEMBERS = 10;
/** The discussion page's default shared window (months). Keep in sync with
 *  bodies_id_discussion.tsx so this list matches what actually renders. */
const WINDOW_MONTHS = 12;

export interface WordfishCase {
    id: number;
    name: string;
    /** Body type label (e.g. "Kanton", "Staat") — disambiguates two same-named bodies. */
    type_name: string | null;
    canton: string | null;
    /** Active members placeable in the default window (the chart's dot count). */
    members: number;
    /** Full span of available transcript speeches (ISO yyyy-mm-dd), all-time. */
    data_from: string | null;
    data_to: string | null;
}

type CaseRow = {
    id: number;
    members: number | bigint;
    name_de: string | null;
    name_fr: string | null;
    name_en: string | null;
    type_name_de: string | null;
    type_name_fr: string | null;
    type_name_en: string | null;
    canton_key: string | null;
    data_from: number | bigint | null;
    data_to: number | bigint | null;
};

const cache = new Map<string, WordfishCase[]>();

/** German-fallback language pick, mirroring the SQL loc() fallback order. */
const pick = (
    lang: SiteLangs["lang_code"],
    names: { de: string | null; fr?: string | null; en?: string | null },
) => {
    const byLang =
        lang === "en" ? names.en : lang === "fr" ? names.fr : names.de;
    return (byLang || names.de) ?? "";
};

const iso = (ms: number | bigint | null) =>
    ms == null ? null : new Date(Number(ms)).toISOString().slice(0, 10);

export async function getWordfishCases(
    lang: SiteLangs["lang_code"],
): Promise<WordfishCase[]> {
    const cached = cache.get(lang);
    if (cached) return cached;

    // Default 12-month window, anchored now (matches the discussion loader). The
    // process cache means the boundary is frozen at first call — acceptable, as the
    // qualifying set only shifts for bodies right at the edge (see start_data note).
    const windowStart = Date.now() - WINDOW_MONTHS * 30 * 86400 * 1000;
    const hasText =
        "length(coalesce(s.text_content_de, s.text_content_fr, s.text_content_it, '')) > 0";

    const rows = (await db
        .run(`
      WITH placeable AS (
        -- one row per (body, active member) with >=1 transcript-bearing speech in the window
        SELECT p.body_id, s.person_id
        FROM speeches s JOIN persons p ON p.id = s.person_id
        WHERE p.active = TRUE AND s.date_start >= ${windowStart} AND ${hasText}
        GROUP BY p.body_id, s.person_id
      ),
      qualified AS (
        SELECT body_id, count(*) AS members
        FROM placeable GROUP BY body_id HAVING count(*) >= ${MIN_MEMBERS}
      ),
      spans AS (
        -- full all-time span of transcript speeches by the body's active members
        SELECT p.body_id, min(s.date_start) AS data_from, max(s.date_start) AS data_to
        FROM speeches s JOIN persons p ON p.id = s.person_id
        WHERE p.active = TRUE AND ${hasText}
        GROUP BY p.body_id
      )
      SELECT
        CAST(q.body_id AS INTEGER) AS id,
        CAST(q.members AS INTEGER) AS members,
        b.name_de, b.name_fr, b.name_en,
        b.type_name_de, b.type_name_fr, b.type_name_en,
        b.canton_key,
        sp.data_from, sp.data_to
      FROM qualified q
      JOIN bodies b ON b.id = q.body_id
      JOIN spans sp ON sp.body_id = q.body_id
      ORDER BY q.members DESC, b.name_de
    `)
        .then((r) => r.getRowObjects())) as unknown as CaseRow[];

    const cases: WordfishCase[] = rows.map((r) => ({
        id: Number(r.id),
        name: pick(lang, { de: r.name_de, fr: r.name_fr, en: r.name_en }),
        type_name: pick(lang, { de: r.type_name_de, fr: r.type_name_fr, en: r.type_name_en }) || null,
        canton: r.canton_key,
        members: Number(r.members),
        data_from: iso(r.data_from),
        data_to: iso(r.data_to),
    }));

    cache.set(lang, cases);
    return cases;
}
