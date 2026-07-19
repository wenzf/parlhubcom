// ingest/derive.ts
//
// DERIVED columns — computed after import from data already in the DB, never
// fetched from the source bucket. One family so far: the speeches SEARCH
// columns, which speeches_list.sql reads so the /speeches catalogue search
// doesn't have to tag-strip 2-3M transcripts (regexp_replace over ~GBs of
// text) nor join persons/affairs on every request.
//
// Columns added to `speeches` (see docs/data-import.md):
//   search_text_de/fr/it  VARCHAR  tag-stripped transcript per language. NULL
//                                  exactly where text_content_<l> is NULL, so
//                                  loc()/loc_lang() pick the same variant on
//                                  these as on the source columns.
//   search_meta           VARCHAR  speaker fullname + affair titles (de/fr/it),
//                                  space-joined — the non-transcript fields the
//                                  catalogue search matches, denormalized so the
//                                  query needs no persons/affairs join.
//   has_text_de/fr/it     BOOLEAN  transcript presence flags — the language
//                                  facet runs loc_lang() over these 1-byte
//                                  columns instead of the transcripts.
//
// Idempotent: the table is REBUILT via CREATE TABLE AS (the sortTable idiom —
// projection from the canonical speechColumns registry + the derived columns,
// re-clustered by the dataset's sortBy, index recreated). A rebuild rather
// than a full-table UPDATE because DuckDB keeps UPDATE row versions in memory
// (they cannot spill) — at 2-3M wide rows that OOMs a 3 GB limit, while CTAS
// streams and spills to temp_directory. Re-derives whenever any SOURCE entity
// (speeches / persons / affairs) was re-imported — a re-import DROPs +
// recreates its table, wiping the columns — or when the columns are missing
// (fresh DB, or the standalone migration). Freshness is tracked as a
// pseudo-row in import_meta (entity '_derived_speech_search', fingerprint in
// source_created), so a run that crashed mid-derive re-derives on resume
// instead of silently skipping.

import type { DuckDBConnection } from "@duckdb/node-api";
import { speechColumns } from "../types/opd_db";
import { datasets } from "./datasets";
import { createIndexes } from "./import";

/** Entities whose re-import invalidates the derived speech search columns. */
export const SPEECH_SEARCH_SOURCES = ["speeches", "persons", "affairs"] as const;

const LEDGER_ENTITY = "_derived_speech_search";

/** Same strip the query family used inline before the columns existed. */
const STRIP = (col: string) => `regexp_replace(${col}, '<[^>]*>', ' ', 'g')`;

async function hasTable(db: DuckDBConnection, name: string): Promise<boolean> {
    const r = await db.runAndReadAll(
        `SELECT count(*) AS n FROM duckdb_tables() WHERE table_name = '${name}';`,
    );
    return Number(r.getRowObjects()[0]?.n ?? 0) > 0;
}

/** True when all derived search columns exist on `speeches`. */
export async function speechSearchColumnsPresent(db: DuckDBConnection): Promise<boolean> {
    const r = await db.runAndReadAll(`
        SELECT count(*) AS n FROM duckdb_columns()
        WHERE table_name = 'speeches'
          AND column_name IN ('search_text_de', 'search_text_fr', 'search_text_it',
                              'search_meta', 'has_text_de', 'has_text_fr', 'has_text_it');
    `);
    return Number(r.getRowObjects()[0]?.n ?? 0) === 7;
}

/** Source-state fingerprint: the sources' synced_at from import_meta. Empty
 *  string when import_meta doesn't exist (plain local build) — then the caller
 *  can't prove freshness and should derive unconditionally. */
async function sourceFingerprint(db: DuckDBConnection): Promise<string> {
    if (!(await hasTable(db, "import_meta"))) return "";
    const r = await db.runAndReadAll(`
        SELECT entity, synced_at FROM import_meta
        WHERE entity IN (${SPEECH_SEARCH_SOURCES.map((e) => `'${e}'`).join(", ")})
        ORDER BY entity;
    `);
    return r
        .getRowObjects()
        .map((row) => `${row.entity}=${row.synced_at}`)
        .join(";");
}

async function storedFingerprint(db: DuckDBConnection): Promise<string | null> {
    if (!(await hasTable(db, "import_meta"))) return null;
    const r = await db.runAndReadAll(
        `SELECT source_created FROM import_meta WHERE entity = '${LEDGER_ENTITY}';`,
    );
    const row = r.getRowObjects()[0];
    return row ? String(row.source_created) : null;
}

/** True when deriveSpeechSearch must run: columns missing, or the sources
 *  changed since the last successful derive (or freshness is unprovable). */
export async function speechSearchDeriveNeeded(db: DuckDBConnection): Promise<boolean> {
    if (!(await speechSearchColumnsPresent(db))) return true;
    const current = await sourceFingerprint(db);
    if (current === "") return true; // no ledger — can't prove freshness
    return (await storedFingerprint(db)) !== current;
}

/**
 * (Re)builds `speeches` with the derived search columns appended. Requires the
 * `speeches`, `persons` and `affairs` tables to exist. The heavy CTAS runs
 * outside the transaction (it only creates a scratch table); the swap —
 * DROP + RENAME + index + ledger — commits atomically, so a crash leaves the
 * previous consistent state (at worst a stray scratch table, dropped on the
 * next run).
 */
export async function deriveSpeechSearch(db: DuckDBConnection): Promise<void> {
    const t0 = Date.now();
    const fingerprint = await sourceFingerprint(db);
    const hasLedger = await hasTable(db, "import_meta");

    // The dataset registry is the source of truth for the projection (so a
    // re-derive on a table that already carries derived columns doesn't
    // duplicate them), the clustering and the index set.
    const dataset = datasets.find((d) => d.table === "speeches");
    if (!dataset) throw new Error("derive: no 'speeches' dataset registered");
    const srcCols = Object.keys(speechColumns)
        .map((c) => `s."${c}"`)
        .join(", ");

    await db.run(`DROP TABLE IF EXISTS _speeches_derived;`);
    await db.run(`
        CREATE TABLE _speeches_derived AS
        SELECT ${srcCols},
               ${STRIP("s.text_content_de")} AS search_text_de,
               ${STRIP("s.text_content_fr")} AS search_text_fr,
               ${STRIP("s.text_content_it")} AS search_text_it,
               NULLIF(concat_ws(' ', p.fullname, a.title_de, a.title_fr, a.title_it), '') AS search_meta,
               s.text_content_de IS NOT NULL AS has_text_de,
               s.text_content_fr IS NOT NULL AS has_text_fr,
               s.text_content_it IS NOT NULL AS has_text_it
        FROM speeches s
        LEFT JOIN persons p ON p.id = s.person_id
        LEFT JOIN affairs a ON a.id = s.affair_id
        ORDER BY ${dataset.sortBy.map((k) => `s.${k}`).join(", ")};
    `);

    // Fan-out guard: the LEFT JOINs must be 1:1 (persons.id / affairs.id
    // unique). A duplicate id would silently multiply speeches rows here —
    // abort before the swap rather than ship a corrupted table.
    const counts = await db.runAndReadAll(`
        SELECT (SELECT count(*) FROM speeches) AS src,
               (SELECT count(*) FROM _speeches_derived) AS dst;
    `);
    const { src, dst } = counts.getRowObjects()[0] as { src: unknown; dst: unknown };
    if (Number(src) !== Number(dst)) {
        await db.run(`DROP TABLE _speeches_derived;`);
        throw new Error(
            `derive: rebuild row count mismatch (speeches=${src}, derived=${dst}) — duplicate persons/affairs ids?`,
        );
    }

    await db.run("BEGIN TRANSACTION;");
    try {
        await db.run(`DROP TABLE speeches;`);
        await db.run(`ALTER TABLE _speeches_derived RENAME TO speeches;`);

        // Inside the transaction: a swap that commits without the index would
        // otherwise mark itself done in the ledger and never get the index back.
        // Same names/strategy as the importer (idx_speeches_person_id).
        await createIndexes(db, "speeches", dataset.indexes);

        if (hasLedger) {
            await db.run(`
                INSERT OR REPLACE INTO import_meta
                    (entity, row_count, skipped_count, source_size, source_row_count,
                     source_created, source_generated_at, synced_at)
                VALUES ('${LEDGER_ENTITY}',
                        (SELECT count(*) FROM speeches), 0, 0, 0,
                        '${fingerprint.replace(/'/g, "''")}', '',
                        '${new Date().toISOString()}');
            `);
        }

        await db.run("COMMIT;");
    } catch (err) {
        await db.run("ROLLBACK;");
        throw err;
    }

    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  Derived speeches search columns in ${secs}s.`);
}
