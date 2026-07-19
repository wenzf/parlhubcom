"server-only";
// app/server/guide_data.server.ts
//
// Data for /project/data-guide — the "what you can explore" field guide. The
// guide's cards link to concrete eyecatcher pages (a member's vocabulary word
// map, the federal lobby network, a name-by-name voting, …); this resolves those
// example targets per data type: a rich, representative record picked live from
// data.duckdb (never a hard-coded id, which would rot when the DB is rebuilt;
// see docs/edge-cases.md — prefer a graceful loader over brittle constants).
//
// Each example is one { id, label } — `id` is the URL :id (numeric, or the
// base64url org key for organizations); `label` is the localized display name the
// card's link shows (templated via "{{name}}"). A type whose query finds nothing
// resolves to `null`, and the page simply omits that link (graceful fallback).
//
// Like start_data.server.ts, the result only changes when a new data.duckdb is
// swapped in (the app opens it READ-ONLY), so it's computed once per language and
// cached for the process lifetime — no per-request query.

import { db } from "~/server/db/core";
import { encodeOrgId } from "~/lib/urls/org_id";
import type { SiteLangs } from "@/types/site";

export interface GuideExample {
    /** The URL :id — numeric id as a string, or base64url(org key) for organizations. */
    id: string;
    /** Localized display name shown on the example link. */
    label: string;
}

export interface GuideExamples {
    /** Person for the vocabulary word-map link (needs transcript speeches). */
    people_vocabulary: GuideExample | null;
    /** Person for the alignment scatter link (needs individual votes). */
    people_alignment: GuideExample | null;
    /** Person for the interests/mandates link (needs register entries). */
    people_interests: GuideExample | null;
    bodies: GuideExample | null;
    affairs: GuideExample | null;
    votings: GuideExample | null;
    organizations: GuideExample | null;
}

const cache = new Map<string, GuideExamples>();

/** Localized name pick, German fallback (the column every record has). Mirrors the
 *  SQL loc() fallback order for the languages this page ships. */
const pick = (
    lang: SiteLangs["lang_code"],
    names: { de?: string | null; fr?: string | null; it?: string | null; en?: string | null },
): string => {
    const byLang =
        lang === "en" ? names.en : lang === "fr" ? names.fr : lang === "it" ? names.it : names.de;
    return (byLang || names.de || names.fr || names.en || "") ?? "";
};

/** The single federal body (Switzerland) — the richest parliament, used for the
 *  bodies example so its computed pages (lobby, members, alignment, …) have real
 *  content. */
const FEDERAL_ID = 42;

// Preferred person examples: famous / controversial federal members (mix of SVP
// and SP), matched by fullname so they survive DB rebuilds. Per slot the first
// candidate with enough data wins; someone who leaves parliament or loses data
// simply drops out and the next takes over (data-driven fallback below both).
const PERSON_CANDIDATES = [
    "Magdalena Martullo-Blocher", // SVP
    "Andreas Glarner",            // SVP
    "Jacqueline Badran",          // SP
    "Thomas Aeschi",              // SVP
    "Cédric Wermuth",             // SP
    "Daniel Jositsch",            // SP → fraktionslos
] as const;

// Per-slot preference order (index into PERSON_CANDIDATES) + minimum data.
const SLOT_PREFS = {
    // Word map: wants plenty of transcript text — Badran (SP) first.
    vocabulary: { order: [2, 4, 5, 3, 1, 0], min: 50, stat: "n_txt" },
    // Alignment scatter: wants a long voting record — Glarner (SVP) first.
    alignment: { order: [1, 0, 3, 2, 4, 5], min: 1000, stat: "n_votes" },
    // Mandates: wants many register entries — Martullo-Blocher (SVP) first.
    interests: { order: [0, 1, 5, 3, 2, 4], min: 8, stat: "n_int" },
} as const;

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null ? "" : String(Number(v)));

export async function getGuideExamples(
    lang: SiteLangs["lang_code"],
): Promise<GuideExamples> {
    const cached = cache.get(lang);
    if (cached) return cached;

    const one = async (sql: string): Promise<Row | undefined> => {
        const r = await db.run(sql);
        const rows = (await r.getRowObjects()) as unknown as Row[];
        return rows[0];
    };

    const all = async (sql: string): Promise<Row[]> => {
        const r = await db.run(sql);
        return (await r.getRowObjects()) as unknown as Row[];
    };

    const candidateList = PERSON_CANDIDATES.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ");

    const [candidates, fallbackPerson, body, affair, voting, orgPreferred, orgFallback] =
        await Promise.all([
            // People — the preferred famous-member candidates with their per-slot stats
            // (transcript speeches / votes / register entries).
            all(`
      SELECT CAST(p.id AS INTEGER) AS id, p.fullname,
        (SELECT count(*) FROM speeches s WHERE s.person_id = p.id
           AND length(coalesce(s.text_content_de, s.text_content_fr, s.text_content_it, '')) > 0) AS n_txt,
        (SELECT count(*) FROM votes v WHERE v.person_id = p.id) AS n_votes,
        (SELECT count(*) FROM interests i WHERE i.person_id = p.id) AS n_int
      FROM persons p
      WHERE p.active AND p.body_id = ${FEDERAL_ID} AND p.fullname IN (${candidateList})
    `),
            // Data-driven fallback should every candidate drop out: the active federal
            // member with the most declared interests who also has speeches.
            one(`
      WITH sp AS (SELECT DISTINCT person_id FROM speeches),
           it AS (SELECT person_id, count(*) n FROM interests GROUP BY 1)
      SELECT CAST(p.id AS INTEGER) AS id, p.fullname
      FROM persons p JOIN it ON it.person_id = p.id JOIN sp ON sp.person_id = p.id
      WHERE p.active AND p.body_id = ${FEDERAL_ID}
      ORDER BY it.n DESC LIMIT 1
    `),
            // Parliaments — Switzerland (the federal assembly); feeds the lobby-network
            // and members links.
            one(`
      SELECT CAST(id AS INTEGER) AS id, name_de, name_fr, name_en
      FROM bodies
      WHERE type = 'country' AND country_key = 'CHE' AND has_parliament
      LIMIT 1
    `),
            // Affairs — the federal affair carrying the most votings (a long fight worth
            // following through).
            one(`
      SELECT CAST(a.id AS INTEGER) AS id, a.title_de, a.title_fr, a.title_it, count(v.id) AS nv
      FROM affairs a JOIN votings v ON v.affair_id = a.id
      WHERE a.body_id = ${FEDERAL_ID}
      GROUP BY 1, 2, 3, 4 ORDER BY nv DESC LIMIT 1
    `),
            // Votings — the most recent federal voting with a title (its page renders the
            // hemicycle diagram + name-by-name tally).
            one(`
      SELECT CAST(id AS INTEGER) AS id,
             coalesce(affair_title_de, title_de) AS title_de,
             coalesce(affair_title_fr, title_fr) AS title_fr,
             coalesce(affair_title_it, title_it) AS title_it
      FROM votings
      WHERE body_id = ${FEDERAL_ID} AND coalesce(affair_title_de, title_de) IS NOT NULL
      ORDER BY date DESC LIMIT 1
    `),
            // Organizations — the curated example (a bank-lobby tie that also touches
            // several parliaments), falling back to a data-driven pick if it ever leaves
            // the data: a real, multi-word organization tied to members across as many
            // parliaments as possible (ordered by body reach so real associations beat
            // generic occupation labels like "Landwirt, selbständig"; a small stoplist
            // drops the obvious ones). Both keyed on lower(name_de) to match the org
            // page's de-first grouping.
            one(`
      WITH iv AS (SELECT name_de FROM interests WHERE lower(name_de) = 'zürcher bankenverband')
      SELECT min(name_de) AS nm FROM iv HAVING count(*) > 0
    `),
            one(`
      WITH iv AS (
        SELECT person_id, body_id, name_de
        FROM interests
        WHERE name_de IS NOT NULL AND length(trim(name_de)) > 4 AND strpos(name_de, ' ') > 0
          AND lower(name_de) NOT LIKE '%selbst%' AND lower(name_de) NOT LIKE '%landwirt%'
          AND lower(name_de) NOT LIKE '%rechtsanwalt%' AND lower(name_de) NOT LIKE '%mitglied%'
      )
      SELECT min(name_de) AS nm, count(DISTINCT person_id) AS members
      FROM iv GROUP BY lower(name_de)
      HAVING count(DISTINCT body_id) >= 3 AND count(DISTINCT person_id) >= 5
      ORDER BY count(DISTINCT body_id) DESC, members DESC, nm LIMIT 1
    `),
        ]);

    const org = orgPreferred ?? orgFallback;
    const orgName = org ? (s(org.nm) ?? "") : "";

    // Per slot: first preferred candidate meeting the data threshold, else the
    // data-driven fallback person.
    const byName = new Map(candidates.map((r) => [s(r.fullname), r]));
    const pickSlot = (slot: keyof typeof SLOT_PREFS): GuideExample | null => {
        const { order, min, stat } = SLOT_PREFS[slot];
        for (const idx of order) {
            const row = byName.get(PERSON_CANDIDATES[idx]);
            if (row && Number(row[stat]) >= min) {
                return { id: num(row.id), label: s(row.fullname) ?? "" };
            }
        }
        return fallbackPerson
            ? { id: num(fallbackPerson.id), label: s(fallbackPerson.fullname) ?? "" }
            : null;
    };

    const data: GuideExamples = {
        people_vocabulary: pickSlot("vocabulary"),
        people_alignment: pickSlot("alignment"),
        people_interests: pickSlot("interests"),
        bodies: body
            ? { id: num(body.id), label: pick(lang, { de: s(body.name_de), fr: s(body.name_fr), en: s(body.name_en) }) }
            : null,
        affairs: affair
            ? { id: num(affair.id), label: pick(lang, { de: s(affair.title_de), fr: s(affair.title_fr), it: s(affair.title_it) }) }
            : null,
        votings: voting
            ? { id: num(voting.id), label: pick(lang, { de: s(voting.title_de), fr: s(voting.title_fr), it: s(voting.title_it) }) }
            : null,
        organizations:
            org && orgName
                ? { id: encodeOrgId(orgName.toLowerCase()), label: orgName }
                : null,
    };

    cache.set(lang, data);
    return data;
}
