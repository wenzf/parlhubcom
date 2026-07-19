"server-only";
// ============================================================================
// ~/server/db/person_paginated.prototype.server.ts
//
// The single, self-contained module for every paginated query — person
// dimensions AND top-level entity catalogues. Nothing here imports from
// person_paginated.ts, so that older file can be deleted once each dimension
// loader repoints its import to this module.
//
// Layers (person behavior is unchanged from the original):
//
//   • PERSON PRELUDE  — PageParams + bindPersonPaginatedParams (the $1..$8 map:
//     personId + 5 langs + limit + offset). Moved here verbatim from
//     person_paginated.ts.
//   • runPaginatedFiltered<T>()     — the entity-agnostic FILTERED core (bindPrelude
//     callback + filterStartIndex + filters + whitelisted ORDER BY).
//   • runPersonPaginatedFiltered<T>()  — person FILTERED wrapper ($1..$8, filters $9+).
//   • runListPaginatedFiltered<T>()    — top-level non-person FILTERED wrapper
//     ($1..$7 langs/limit/offset, filters $8+; no person id, no sibling widening).
//
// Parameter convention for the PERSON queries (shared by all six person_*_by_id.sql,
// extends person_by_id.sql):
//   $1  INTEGER  — person id
//   $2..$6 VARCHAR — language priority (l1..l5; '' for unused slots)
//   $7  INTEGER  — limit  (page size)
//   $8  INTEGER  — offset (the `from` index, 0-based)
// ============================================================================

import macro_loc_sql from "~/server/db/sql/macro_loc.sql?raw";
import type { SqlParam } from "~/lib/dimensions/filters";
import type { DuckDBPreparedStatement } from "@duckdb/node-api";
import { db } from "./db";

// ── person prelude (moved from person_paginated.ts) ──────────────────────────

export interface PageParams {
    personId: number;
    /** Language priority, highest first, e.g. ['de','fr','it']. Up to 5; padded with ''. */
    langs: string[];
    /** Page size → LIMIT ($7). */
    limit: number;
    /** Start index, 0-based → OFFSET ($8). This is the `from`. */
    offset: number;
}

/**
 * Binds $1..$8 for any of the paginated person queries, following the same
 * langs-padding rule as dashboard.tsx's bindPersonFullParams (unused language
 * slots are bound as empty strings, which loc() treats as "no match").
 */
export function bindPersonPaginatedParams(
    prepared: DuckDBPreparedStatement,
    { personId, langs, limit, offset }: PageParams,
): void {
    const l = Array.from({ length: 5 }, (_, i) => langs[i] ?? "");
    prepared.bindInteger(1, personId); // $1
    prepared.bindVarchar(2, l[0]);     // $2 l1
    prepared.bindVarchar(3, l[1]);     // $3 l2
    prepared.bindVarchar(4, l[2]);     // $4 l3
    prepared.bindVarchar(5, l[3]);     // $5 l4
    prepared.bindVarchar(6, l[4]);     // $6 l5
    prepared.bindInteger(7, limit);    // $7 limit
    prepared.bindInteger(8, offset);   // $8 offset (= from)
}

// ── generic filtered core ─────────────────────────────────────────────────────

const ORDER_BY_TOKEN = /\/\*\s*__ORDER_BY__\s*\*\//g;

/** Binds an ordered list of typed filter values starting at `startIndex`. A
 *  `null`/`undefined` value is bound as SQL NULL → the matching
 *  `($n IS NULL OR …)` predicate is disabled. Entity-agnostic; shared by every
 *  filtered runner below. */
export function bindSqlParams(
    prepared: DuckDBPreparedStatement,
    params: SqlParam[],
    startIndex: number,
): void {
    params.forEach((p, i) => {
        const idx = startIndex + i;
        if (p.value === null || p.value === undefined) {
            prepared.bindNull(idx);
            return;
        }
        switch (p.type) {
            case "integer":
                prepared.bindInteger(idx, p.value);
                break;
            case "double":
                prepared.bindDouble(idx, p.value);
                break;
            case "varchar":
                prepared.bindVarchar(idx, p.value);
                break;
            case "boolean":
                prepared.bindBoolean(idx, p.value);
                break;
        }
    });
}

/** The entity-agnostic part of a filtered paginated query. */
export interface PaginatedFilteredParams {
    /** Binds the fixed prelude slots ($1..$(filterStartIndex-1)) for this SQL
     *  family — e.g. personId + langs + limit + offset, or just langs + limit +
     *  offset. The only place a runner's "shape" lives. */
    bindPrelude: (prepared: DuckDBPreparedStatement) => void;
    /** 1-based index of the FIRST filter slot — one past the prelude. Person
     *  queries reserve $1..$8 → 9; list queries reserve $1..$7 → 8. MUST match the
     *  .sql header's first filter slot and the descriptor's toSqlParams order. */
    filterStartIndex: number;
    /** Bound values for the filter slots, in slot order (descriptor.toSqlParams). */
    filters: SqlParam[];
    /** Trusted ORDER BY fragment from resolveOrderBy() — splices into the token. */
    orderBy: string;
}

/**
 * Prepares + runs a FILTERED paginated query, entity-agnostically:
 *   1. (re)applies macro_loc.sql (idempotent),
 *   2. splices the whitelisted ORDER BY fragment into every `/* __ORDER_BY__ *\/`
 *      token,
 *   3. binds the prelude, then the filter slots from `filterStartIndex`,
 *   4. returns the single typed row (or `undefined`).
 *
 * `orderBy` MUST come from resolveOrderBy() (descriptor allowlist) and `filters`
 * from descriptor.toSqlParams() — together they keep the .sql header's slot map
 * in lockstep. With all-NULL filters + the default order this collapses to the
 * same clustered read as the unfiltered query.
 */
export async function runPaginatedFiltered<T>(
    sql: string,
    { bindPrelude, filterStartIndex, filters, orderBy }: PaginatedFilteredParams,
): Promise<T | undefined> {
    await db.run(macro_loc_sql);
    // Defensive: never let an empty fragment slip through to invalid SQL.
    const ob = orderBy.trim() || "id DESC";
    const finalSql = sql.replace(ORDER_BY_TOKEN, ob);
    const prepared = await db.prepare(finalSql);
    bindPrelude(prepared);
    bindSqlParams(prepared, filters, filterStartIndex);
    const reader = await prepared.runAndReadAll();
    const rows = reader.getRowObjectsJson() as unknown as T[];
    return rows[0];
}

// ── person filtered wrapper ───────────────────────────────────────────────────

/** PageParams plus the extra filter slots and the (already-whitelisted) ORDER BY
 *  fragment. Produced by the loader from a DimensionDescriptor + RawCriteria. */
export interface FilteredPageParams extends PageParams {
    /** Bound values for $9..$N, in slot order (descriptor.toSqlParams). */
    filters: SqlParam[];
    /** Trusted ORDER BY fragment from resolveOrderBy() — splices into the token. */
    orderBy: string;
}

/**
 * The PERSON-scoped filtered runner. Same $1..$8 prelude and $9-based filter
 * slots as the original prototype — pure delegation to runPaginatedFiltered().
 */
export async function runPersonPaginatedFiltered<T>(
    sql: string,
    params: FilteredPageParams,
): Promise<T | undefined> {
    return runPaginatedFiltered<T>(sql, {
        bindPrelude: (prepared) => bindPersonPaginatedParams(prepared, params),
        filterStartIndex: 9, // person prelude is $1..$8
        filters: params.filters,
        orderBy: params.orderBy,
    });
}

// ── list filtered wrapper (top-level categories) ──────────────────────────────

/**
 * Prelude params for a top-level, NON-person paginated list. No person id and no
 * identity widening — just the language priority and the page window.
 *   $1..$5 VARCHAR — language priority (l1..l5; '' for unused slots)
 *   $6     INTEGER — limit  (page size)
 *   $7     INTEGER — offset (0-based)
 * Filter slots therefore start at $8.
 */
export interface ListPageParams {
    langs: string[];
    limit: number; // $6
    offset: number; // $7
}

/** Binds $1..$7 for a top-level list query (langs / limit / offset). Mirrors the
 *  langs-padding rule of bindPersonPaginatedParams, minus the person id. */
export function bindListPaginatedParams(
    prepared: DuckDBPreparedStatement,
    { langs, limit, offset }: ListPageParams,
): void {
    const l = Array.from({ length: 5 }, (_, i) => langs[i] ?? "");
    prepared.bindVarchar(1, l[0]); // $1 l1
    prepared.bindVarchar(2, l[1]); // $2 l2
    prepared.bindVarchar(3, l[2]); // $3 l3
    prepared.bindVarchar(4, l[3]); // $4 l4
    prepared.bindVarchar(5, l[4]); // $5 l5
    prepared.bindInteger(6, limit); // $6 limit
    prepared.bindInteger(7, offset); // $7 offset
}

export interface FilteredListParams extends ListPageParams {
    /** Bound values for $8..$N, in slot order (descriptor.toSqlParams). */
    filters: SqlParam[];
    /** Trusted ORDER BY fragment from resolveOrderBy(). */
    orderBy: string;
}

/**
 * The top-level (non-person) filtered runner. Use for "browse a whole entity"
 * pages — votes / affairs / groups / … . The descriptor's toSqlParams must
 * produce values for $8..$N (filterStartIndex 8). Everything else (parseRaw /
 * resolveOrderBy / resolveLimit / the UI / the WebMCP tools) is reused unchanged.
 */
export async function runListPaginatedFiltered<T>(
    sql: string,
    params: FilteredListParams,
): Promise<T | undefined> {
    return runPaginatedFiltered<T>(sql, {
        bindPrelude: (prepared) => bindListPaginatedParams(prepared, params),
        filterStartIndex: 8, // list prelude is $1..$7
        filters: params.filters,
        orderBy: params.orderBy,
    });
}
// ── single-row by-id (non-paginated, localized) ───────────────────────────────

/**
 * Prelude for a single-entity "fetch one row by id" query that only needs
 * localization — no pagination, no related-list limit. Used by the top-level
 * entity OVERVIEW pages whose detail is self-contained (e.g. a body: all of its
 * fields live on the one row). Param map:
 *   $1     INTEGER — the entity's primary key
 *   $2..$6 VARCHAR — language priority (l1..l5; '' for unused slots)
 *
 * (person_by_id.sql is the richer cousin — it adds $7, a per-related-list limit,
 * and is bound by dashboard.tsx's bindPersonFullParams. This is the trimmed
 * variant for entities with no related lists.)
 */
export interface ByIdLocalizedParams {
    id: number;
    /** Language priority, highest first; up to 5, padded with ''. */
    langs: string[];
}

/** Binds $1 (id) + $2..$6 (langs) for a by-id localized query, mirroring the
 *  langs-padding rule of the paginated binders. */
export function bindByIdLocalizedParams(
    prepared: DuckDBPreparedStatement,
    { id, langs }: ByIdLocalizedParams,
): void {
    const l = Array.from({ length: 5 }, (_, i) => langs[i] ?? "");
    prepared.bindInteger(1, id); // $1 id
    prepared.bindVarchar(2, l[0]); // $2 l1
    prepared.bindVarchar(3, l[1]); // $3 l2
    prepared.bindVarchar(4, l[2]); // $4 l3
    prepared.bindVarchar(5, l[3]); // $5 l4
    prepared.bindVarchar(6, l[4]); // $6 l5
}

/**
 * Prepares + runs a single-row, localized by-id query and returns the typed row
 * (or `undefined` when no row matches $1). macro_loc.sql is (re)applied first
 * (idempotent). For entities whose overview is self-contained — no related lists,
 * no pagination, no ORDER BY token. `sql` is the imported `...?raw` string of a
 * `<entity>_by_id.sql`.
 */
export async function runByIdLocalized<T>(
    sql: string,
    params: ByIdLocalizedParams,
): Promise<T | undefined> {
    await db.run(macro_loc_sql);
    const prepared = await db.prepare(sql);
    bindByIdLocalizedParams(prepared, params);
    const reader = await prepared.runAndReadAll();
    const rows = reader.getRowObjectsJson() as unknown as T[];
    return rows[0];
}

// ── by-id localized + extra positional params ($7..) ──────────────────────────

/**
 * A localized by-id query that also binds extra positional params starting at
 * $7 (the prelude is $1 id + $2..$6 langs, exactly like ByIdLocalizedParams).
 * The shared shape behind the analytics runners (alignment / loyalty / lobby /
 * vocabulary / discussion): each of those SQLs takes the id+langs prelude plus a
 * fixed tail of thresholds / window bounds, then the module does its own JS
 * post-processing (MDS, force layout, Wordfish, numeric coercion) on the raw
 * rows. `params` are bound in slot order via bindSqlParams — a null/undefined
 * value binds SQL NULL, so nullable window bounds pass `{ type: "double", value:
 * from }` with `from` possibly null.
 */
export interface ByIdLocalizedRawParams extends ByIdLocalizedParams {
    /** Extra positional bind values for $7.., in slot order. */
    params?: SqlParam[];
}

/**
 * Prepares + runs a localized by-id analytics query and returns ALL raw rows
 * (getRowObjectsJson, untyped by default). macro_loc.sql is (re)applied first
 * (defines loc() + loc_lang(); idempotent). No ORDER BY token. Use the single-row
 * helper runByIdLocalizedRaw unless the query is genuinely multi-row (e.g.
 * body_discussion, one row per member).
 */
export async function runByIdLocalizedRawAll<T = unknown>(
    sql: string,
    { id, langs, params = [] }: ByIdLocalizedRawParams,
): Promise<T[]> {
    await db.run(macro_loc_sql);
    const prepared = await db.prepare(sql);
    bindByIdLocalizedParams(prepared, { id, langs });
    bindSqlParams(prepared, params, 7); // prelude is $1..$6 → extras start at $7
    const reader = await prepared.runAndReadAll();
    return reader.getRowObjectsJson() as unknown as T[];
}

/** Single-row variant of runByIdLocalizedRawAll (returns rows[0] or undefined). */
export async function runByIdLocalizedRaw<T = unknown>(
    sql: string,
    params: ByIdLocalizedRawParams,
): Promise<T | undefined> {
    return (await runByIdLocalizedRawAll<T>(sql, params))[0];
}