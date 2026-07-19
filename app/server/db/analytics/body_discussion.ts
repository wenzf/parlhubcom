"server-only";
// body_discussion.ts
//
// Orchestrates the /parliaments/:id/discussion Wordfish prototype:
//   1. run body_discussion_speeches.sql — the body's active members and, per
//      member, their word counts over a SHARED window. Tokenizing AND per-language
//      stopword removal already happened in DuckDB (stopwords table, matched to
//      each speech's own language), so this module never sees raw text.
//   2. trim the vocabulary (rare-word cut)
//   3. build the document-term matrix (one document per person) + run Wordfish
//   4. shape the JSON the <BodyDiscussion/> visualization consumes
//
// Everything here is server-only (touches DuckDB). The result is plain JSON.
// This is a compute-on-request prototype; at chamber scale (dozens–hundreds of
// people, a year of speeches) that's fine, but for the whole corpus you'd
// precompute and cache.

import body_discussion_sql from "~/server/db/sql/bodies/body_discussion_speeches.sql?raw";
import { runByIdLocalizedRawAll } from "../core/runner";
import { wordfish } from "~/lib/domain/wordfish";

/* ---- tunable prototype parameters (surfaced in the JSON `params`) --------- */
const FLOOR_WORDS = 500; // below this a person's position is low-confidence
// Rare-word trimming. Wordfish cost ~ iterations × people × vocab, and rare
// words add noise and instability, not signal — so trim hard. On ~200 members
// this cuts an ~18k raw vocabulary to a few thousand, which fits in a few seconds
// and gives a cleaner axis. Loosen these if you want a richer word plot.
const MIN_DOC_FREQ = 5; // keep a word only if >= this many people use it
const MIN_TOTAL_COUNT = 10; // and it occurs at least this many times overall
// Hard vocabulary cap. Wordfish cost ~ iterations × people × vocab, and people
// is fixed (the chamber's members) — so capping the vocabulary makes the cost
// (and wall-clock) INDEPENDENT of the window size and the chamber size. Without
// it, the federal chamber over a year builds an ~18k-word vocabulary and the
// on-request fit blows past the SSR stream timeout (entry.server streamTimeout).
// The axis is driven by high-frequency discriminators anyway, so we keep the
// MAX_VOCAB most-frequent words after the rare-word cut; rarer words only add
// noise. Raise it (and MAX_ITER) if you move this off the request path.
const MAX_VOCAB = 2500;
// Cap Wordfish's outer iterations (its own default is 200). The document axis
// stabilises well before then; this bounds the worst case without changing the
// shared wordfish default that small bodies / tests rely on.
const MAX_ITER = 80;

export interface BodyDiscussionOptions {
    bodyId: number;
    langs: string[];
    /** Start of the shared window (epoch-ms). Every member is scored on speeches
     *  with date_start >= this, so spans are comparable. */
    windowStartMs: number;
    /** Echoed into the output for provenance. */
    months: number;
    asOf: string; // ISO date
}

/** One row per member: SQL already tokenized + stopword-filtered + counted. */
interface MemberRow {
    person_id: number;
    person_fullname: string;
    party_key: string | null;
    party_label: string | null;
    n_speeches: number | string;
    n_words: number | string;
    date_from: number | string | null;
    date_to: number | string | null;
    words: { word: string; count: number | string }[];
}

export async function runBodyDiscussion(opts: BodyDiscussionOptions) {
    const { bodyId, langs, windowStartMs, months, asOf } = opts;

    // ----- 1. query -------------------------------------------------------------
    // $1 body id + $2..$6 langs + $7 window_start. One row per member.
    const rows = await runByIdLocalizedRawAll<MemberRow>(body_discussion_sql, {
        id: bodyId,
        langs,
        params: [{ type: "double", value: windowStartMs }],
    });

    // ----- 2. per-person aggregation (read the SQL word lists) ------------------
    interface Person {
        id: number;
        name: string;
        partyKey: string | null;
        partyLabel: string | null;
        counts: Map<string, number>;
        nSpeeches: number;
        nWords: number;
        dateFrom: number | null;
        dateTo: number | null;
    }
    const people = new Map<number, Person>();
    for (const r of rows) {
        const counts = new Map<string, number>();
        for (const w of r.words ?? []) counts.set(w.word, Number(w.count));
        people.set(r.person_id, {
            id: r.person_id,
            name: r.person_fullname,
            partyKey: r.party_key ?? null,
            partyLabel: r.party_label ?? null,
            counts,
            nSpeeches: Number(r.n_speeches ?? 0),
            nWords: Number(r.n_words ?? 0),
            dateFrom: r.date_from == null ? null : Number(r.date_from),
            dateTo: r.date_to == null ? null : Number(r.date_to),
        });
    }

    // ----- 3. vocabulary trim (rare-word cut) ----------------------------------
    const docFreq = new Map<string, number>();
    const totalCount = new Map<string, number>();
    for (const p of people.values()) {
        for (const [w, c] of p.counts) {
            docFreq.set(w, (docFreq.get(w) ?? 0) + 1);
            totalCount.set(w, (totalCount.get(w) ?? 0) + c);
        }
    }
    let vocab = [...totalCount.keys()].filter(
        (w) =>
            (docFreq.get(w) ?? 0) >= MIN_DOC_FREQ &&
            (totalCount.get(w) ?? 0) >= MIN_TOTAL_COUNT,
    );
    // Cap to the MAX_VOCAB most-frequent words (keeps cost bounded), then sort
    // alphabetically so the term index is stable / deterministic.
    const vocab_capped = vocab.length > MAX_VOCAB;
    if (vocab_capped) {
        vocab = vocab
            .sort((a, b) => (totalCount.get(b) ?? 0) - (totalCount.get(a) ?? 0))
            .slice(0, MAX_VOCAB);
    }
    vocab.sort();
    const vocabIndex = new Map(vocab.map((w, i) => [w, i]));

    // ----- 4. build DTM + run Wordfish -----------------------------------------
    // Only people who still have >0 tokens after trimming can be scored.
    const scored: Person[] = [];
    const counts: Float64Array[] = [];
    for (const p of people.values()) {
        const row = new Float64Array(vocab.length);
        let kept = 0;
        for (const [w, c] of p.counts) {
            const idx = vocabIndex.get(w);
            if (idx !== undefined) {
                row[idx] = c;
                kept += c;
            }
        }
        if (kept > 0) {
            scored.push(p);
            counts.push(row);
        }
    }

    let positions: { id: number; theta: number; se: number }[] = [];
    let words: { word: string; beta: number; psi: number }[] = [];
    let converged = false;
    let iterations = 0;
    if (scored.length >= 2 && vocab.length >= 2) {
        const res = wordfish({
            docIds: scored.map((p) => p.id),
            counts,
            vocab,
            maxIter: MAX_ITER,
        });
        positions = res.positions;
        words = res.words;
        converged = res.converged;
        iterations = res.iterations;
    }
    const posById = new Map(positions.map((p) => [p.id, p]));
    const iso = (ms: number | null) =>
        ms == null ? null : new Date(ms).toISOString().slice(0, 10);

    // ----- 5. shape the JSON ----------------------------------------------------
    return {
        body_id: bodyId,
        window: {
            mode: "shared" as const,
            months,
            start: iso(windowStartMs),
            as_of: asOf,
        },
        params: {
            floor_words: FLOOR_WORDS,
            min_doc_freq: MIN_DOC_FREQ,
            min_total_count: MIN_TOTAL_COUNT,
            max_vocab: MAX_VOCAB,
            vocab_capped,
            max_iter: MAX_ITER,
            stopwords: "duckdb:per_speech_lang",
        },
        fit: {
            converged,
            iterations,
            n_documents: scored.length,
            vocab_size: vocab.length,
        },
        n_members: people.size,
        people: [...people.values()]
            .map((p) => {
                const pos = posById.get(p.id) ?? null;
                return {
                    person_id: p.id,
                    name: p.name,
                    party_key: p.partyKey,
                    party_label: p.partyLabel,
                    position: pos ? pos.theta : null,
                    std_error: pos ? pos.se : null,
                    n_speeches: p.nSpeeches,
                    n_words: p.nWords,
                    date_from: iso(p.dateFrom),
                    date_to: iso(p.dateTo),
                    below_floor: p.nWords < FLOOR_WORDS,
                    scored: pos != null,
                };
            })
            // most talkative first; unscored (position null) sink to the bottom
            .sort((a, b) => (b.position != null ? 1 : 0) - (a.position != null ? 1 : 0) || b.n_words - a.n_words),
        // words that drive the axis, strongest discriminators first (Eiffel-Tower plot)
        words: words
            .slice()
            .sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta)),
    };
}
