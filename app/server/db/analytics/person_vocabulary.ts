"server-only";
// person_vocabulary.ts
//
// /people/:id/vocabulary data. Matches the person_votes_by_id.sql family: ONE
// localized query (person_topics_by_id.sql) returns the base block the layout +
// <PersonBase/> need (persons / person_identities / bodies) alongside the
// `topics` word aggregation. Tokenizing + per-language stopword removal +
// counting all happen in DuckDB (stopwords table, matched to each speech's own
// language via loc_lang). This module runs the query and wraps `topics` with
// the window presets / iso formatting the treemap expects.
//
// Server-only (touches DuckDB).

import person_topics_by_id from "~/server/db/sql/person/person_vocabulary_by_id.sql?raw";
import { runByIdLocalizedRaw } from "../core/runner";
import type { PersonTopicsResult } from "~/components/opd_views/person/PersonTopics";

const TOP_N = 120; // words shown in the treemap
const MIN_COUNT = 2; // ignore words said only once

export interface PersonTopicsOptions {
    personId: number;
    langs: string[];
    /** Window bounds (epoch-ms) or null = open. */
    fromMs: number | null;
    toMs: number | null;
    asOf: string; // ISO date
}

/** The single-row payload: base block for the layout + the topics aggregation. */
interface TopicsRow {
    persons: { fullname?: string | null } & Record<string, unknown>;
    person_identities: { total_count: number; items: unknown[] };
    bodies: { total_count: number; items: unknown[] };
    topics: {
        n_speeches: number | string;
        n_words: number | string;
        n_distinct: number | string;
        data_from: number | string | null;
        data_to: number | string | null;
        words: { word: string; count: number | string }[];
    };
}

export interface PersonTopicsPayload {
    persons: TopicsRow["persons"];
    person_identities: TopicsRow["person_identities"];
    bodies: TopicsRow["bodies"];
    topics: PersonTopicsResult;
}

export async function runPersonTopics(
    opts: PersonTopicsOptions,
): Promise<PersonTopicsPayload | null> {
    const { personId, langs, fromMs, toMs, asOf } = opts;

    // $1 person id + $2..$6 langs, then $7 window_start / $8 window_end (epoch-ms,
    // nullable) / $9 min_count / $10 top_n.
    const row = await runByIdLocalizedRaw<TopicsRow>(person_topics_by_id, {
        id: personId,
        langs,
        params: [
            { type: "double", value: fromMs },
            { type: "double", value: toMs },
            { type: "integer", value: MIN_COUNT },
            { type: "integer", value: TOP_N },
        ],
    });
    if (!row) return null;

    const iso = (ms: number | string | null) =>
        ms == null ? null : new Date(Number(ms)).toISOString().slice(0, 10);

    // preset window starts, computed on the SERVER so the client hydrates with the
    // exact same strings (computing `new Date()` during render breaks hydration).
    const yearsAgoISO = (years: number) => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - years);
        return d.toISOString().slice(0, 10);
    };

    const t = row.topics;
    const topics: PersonTopicsResult = {
        person_id: personId,
        name: row.persons?.fullname ?? null,
        window: {
            from: fromMs == null ? null : iso(fromMs),
            to: toMs == null ? null : iso(toMs),
            // actual span of the speeches found (may be narrower than the requested window)
            data_from: iso(t?.data_from ?? null),
            data_to: iso(t?.data_to ?? null),
            as_of: asOf,
            preset_4y: yearsAgoISO(4),
            preset_8y: yearsAgoISO(8),
        },
        params: { stopwords: "duckdb:per_speech_lang", top_n: TOP_N, min_count: MIN_COUNT },
        n_speeches: Number(t?.n_speeches ?? 0),
        n_words: Number(t?.n_words ?? 0), // after stopword removal
        n_distinct: Number(t?.n_distinct ?? 0),
        words: (t?.words ?? []).map((w) => ({ word: w.word, count: Number(w.count) })),
    };

    return {
        persons: row.persons,
        person_identities: row.person_identities,
        bodies: row.bodies,
        topics,
    };
}