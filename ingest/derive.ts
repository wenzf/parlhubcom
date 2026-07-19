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
// Idempotent: ADD COLUMN IF NOT EXISTS + full refill inside one transaction.
// Re-derives whenever any SOURCE entity (speeches / persons / affairs) was
// re-imported — a re-import DROPs + recreates its table, wiping the columns —
// or when the columns are missing (fresh DB, or the standalone migration).
// Freshness is tracked as a pseudo-row in import_meta (entity
// '_derived_speech_search', fingerprint in source_created), so a run that
// crashed mid-derive re-derives on resume instead of silently skipping.

import type { DuckDBConnection } from "@duckdb/node-api";

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
        WHERE entity IN ('speeches', 'persons', 'affairs') ORDER BY entity;
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
 * Adds + (re)fills the derived search columns on `speeches`. Requires the
 * `speeches`, `persons` and `affairs` tables to exist. One transaction: the
 * column adds, the single full-table UPDATE and the ledger write commit
 * together, so a crash leaves the previous consistent state.
 */
export async function deriveSpeechSearch(db: DuckDBConnection): Promise<void> {
    const t0 = Date.now();
    const fingerprint = await sourceFingerprint(db);
    const hasLedger = await hasTable(db, "import_meta");

    // Join inputs resolved once into a temp table, so the wide `speeches`
    // rewrite below is a single UPDATE (one row-group rewrite, not two).
    await db.run(`
        CREATE OR REPLACE TEMP TABLE _speech_search_meta AS
        SELECT s.id,
               NULLIF(concat_ws(' ', p.fullname, a.title_de, a.title_fr, a.title_it), '') AS meta
        FROM speeches s
        LEFT JOIN persons p ON p.id = s.person_id
        LEFT JOIN affairs a ON a.id = s.affair_id;
    `);

    await db.run("BEGIN TRANSACTION;");
    try {
        for (const col of [
            "search_text_de VARCHAR",
            "search_text_fr VARCHAR",
            "search_text_it VARCHAR",
            "search_meta VARCHAR",
            "has_text_de BOOLEAN",
            "has_text_fr BOOLEAN",
            "has_text_it BOOLEAN",
        ]) {
            await db.run(`ALTER TABLE speeches ADD COLUMN IF NOT EXISTS ${col};`);
        }

        await db.run(`
            UPDATE speeches SET
                search_text_de = ${STRIP("text_content_de")},
                search_text_fr = ${STRIP("text_content_fr")},
                search_text_it = ${STRIP("text_content_it")},
                has_text_de    = text_content_de IS NOT NULL,
                has_text_fr    = text_content_fr IS NOT NULL,
                has_text_it    = text_content_it IS NOT NULL,
                search_meta    = m.meta
            FROM _speech_search_meta m
            WHERE speeches.id = m.id;
        `);

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
    } finally {
        await db.run("DROP TABLE IF EXISTS _speech_search_meta;");
    }

    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  Derived speeches search columns in ${secs}s.`);
}
