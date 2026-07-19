// dimension_filters.ts
//
// Reusable, isomorphic (SSR + browser) engine for the dimension list controls:
// search · filter · sort, all driven by URL search params and applied
// SERVER-SIDE (over the whole DB set, not just the visible page).
//
// One `DimensionDescriptor` per dimension declares the surface (sortable keys,
// facets, the date-range field, and the ordered SQL param slots). Everything
// else here is generic, so a new dimension only writes a descriptor.
//
// Three layers, deliberately separated:
//   • PARSE/VALIDATE  — parseRaw(): URL → RawCriteria (strings only, validated
//     against the descriptor; unknown/invalid values are dropped, never trusted).
//   • URL BUILD       — buildSearch(): RawCriteria → query string (preserves
//     unrelated params, resets the pager, omits defaults for clean URLs).
//   • SQL SHAPING     — toSqlParams() (declared per descriptor) + resolveOrderBy()
//     produce the bound values ($9..$N) and the ORDER BY fragment. The ORDER BY
//     is the ONLY templated SQL; it comes exclusively from the descriptor's
//     allowlist, so no caller text ever reaches the query. Filter VALUES are
//     bound, never interpolated.
//
// RawCriteria stays the single currency for the UI, the URL, and the WebMCP
// tools so all three produce byte-identical links.

export type SortDir = "asc" | "desc";

/** One allowed sort. `sqlExpr` is TRUSTED — it lives only in the descriptor and
 *  is whitelisted before use, never built from caller input. It may reference the
 *  query's language params ($2..$6) since it is spliced into that same query. */
export interface SortOption {
    key: string; // URL value, e.g. "begin_date"
    labelKey: string; // loc key for the option label
    sqlExpr: string; // e.g. "begin_date" or a loc(...) expression
}

export interface FacetOption {
    value: string;
    /** loc key for the option label (used when `label` is absent). */
    labelKey: string;
    /** concrete, data-driven label (e.g. a body name) — wins over `labelKey`. */
    label?: string;
    /** body's country_key (CHE | LIE) — for country-scoped option filtering. */
    country?: string | null;
    /** body's body_key — lets the party filter map body_keys → country. */
    bodyKey?: string | null;
    /** party's body_keys — the bodies it appears in (for country scoping). */
    bodyKeys?: string[];
    /** body's `position` rank (1 country · 2 canton · 3 city · 4 commune) — used to
     *  group the body/parliament facet options under level headings. */
    position?: number | null;
}

/** Declarative facet. `param` is the URL key it owns. */
export type FacetDef =
    | {
        kind: "select";
        param: string;
        labelKey: string;
        allLabelKey: string;
        /** Optional client-side option source id (see opd_facet_sources.ts). When set,
         *  <DimensionControls> fetches the full vocabulary and fills `options` at
         *  runtime. Omit to rely on the param-name convention or static/page options. */
        source?: string;
        options: FacetOption[];
    }
    | {
        kind: "boolean";
        param: string;
        labelKey: string;
        trueLabelKey: string;
        falseLabelKey: string;
        allLabelKey: string;
    }
    | {
        kind: "dateRange";
        fromParam: string;
        toParam: string;
        fromLabelKey: string;
        toLabelKey: string;
    };

/** A single bound SQL value for one $9..$N slot. `null` → bound as SQL NULL,
 *  which every predicate reads as "filter disabled" (the `($n IS NULL OR …)`
 *  idiom), so the prepared statement stays static and cache-friendly. */
export type SqlParam =
    | { type: "integer"; value: number | null }
    | { type: "double"; value: number | null }
    | { type: "varchar"; value: string | null }
    | { type: "boolean"; value: boolean | null };

/** URL-level criteria: exactly what lives in the query string (all strings),
 *  already validated against a descriptor. The shared currency for UI/URL/WebMCP. */
export interface RawCriteria {
    q: string | null;
    sort: string; // a valid sort key (defaulted)
    dir: SortDir;
    /** select/boolean facet values keyed by the facet's `param`. */
    facets: Record<string, string | null>;
    /** ISO yyyy-mm-dd bounds for the date-range facet (null when unset). */
    dateFrom: string | null;
    dateTo: string | null;
    /** page size; null = the descriptor default (so no URL param on initial load). */
    limit: number | null;
}

export interface DimensionDescriptor {
    /** dimension slug, e.g. "interests" (used for tool names / labels). */
    dimension: string;
    /** the pager's URL param; reset whenever criteria change. */
    pageParam: string;
    /** Whether this dimension has a free-text search. Default `true`. Set `false`
     *  for dimensions with no searchable text/localized column (e.g. images): the
     *  search box is hidden (DimensionControls), the `q` field is dropped from the
     *  agent tool (DimensionMcpTools), and `q` is forced null here — so the SQL's
     *  first filter slot is the first NON-search predicate. */
    searchable?: boolean;
    defaultSort: { key: string; dir: SortDir };
    sorts: SortOption[];
    facets: FacetDef[];
    /** the date-range facet's param names, or null when the dimension has none. */
    dateRange: { fromParam: string; toParam: string } | null;
    /** page-size selector. `default` is used when no URL param is present (so the
     *  initial load is clean). `options` is the full menu; the UI shows only the
     *  ones that make sense for the current result count. */
    pageSize: { param: string; default: number; options: number[] };
    /** Ordered SQL params for slots $9..$N. MUST match the .sql file's header map. */
    toSqlParams: (c: RawCriteria) => SqlParam[];
}

/* ------------------------------- date helpers ----------------------------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** ISO yyyy-mm-dd → epoch millis (UTC). `"end"` snaps to the last ms of the day
 *  so a `to` bound is inclusive of the whole day. Invalid input → null. */
export function isoToEpoch(
    raw: string | null | undefined,
    edge: "start" | "end",
): number | null {
    if (!raw || !ISO_DATE.test(raw)) return null;
    const ms = Date.parse(`${raw}T00:00:00Z`);
    if (Number.isNaN(ms)) return null;
    return edge === "end" ? ms + DAY_MS - 1 : ms;
}

/** "true"/"false" facet string → boolean, anything else → null (no filter). */
export function boolFacet(v: string | null | undefined): boolean | null {
    return v === "true" ? true : v === "false" ? false : null;
}

/* ------------------------------- parse (URL→) ----------------------------- */

/** Validate URL params against the descriptor. Unknown sort keys, out-of-set
 *  facet values, and malformed dates are dropped — the result is always safe to
 *  pass to the SQL layer. */
export function parseRaw(
    d: DimensionDescriptor,
    sp: URLSearchParams,
): RawCriteria {
    const q =
        d.searchable === false ? null : (sp.get("q") ?? "").trim() || null;

    const sortRaw = sp.get("sort");
    const sort = d.sorts.some((s) => s.key === sortRaw)
        ? (sortRaw as string)
        : d.defaultSort.key;

    const dirRaw = sp.get("dir");
    const dir: SortDir =
        dirRaw === "asc" || dirRaw === "desc" ? dirRaw : d.defaultSort.dir;

    const facets: Record<string, string | null> = {};
    for (const f of d.facets) {
        if (f.kind === "select") {
            const v = sp.get(f.param);
            if (v == null || v === "") {
                facets[f.param] = null;
            } else if (f.options.length === 0) {
                // Open set: options are injected at runtime (e.g. body), so there is no
                // fixed list to validate against here. Accept the value and let SQL decide
                // (an unknown value simply matches nothing). Without this, the loader —
                // which parses with the bare descriptor — would drop the value entirely.
                facets[f.param] = v;
            } else {
                facets[f.param] = f.options.some((o) => o.value === v) ? v : null;
            }
        } else if (f.kind === "boolean") {
            const v = sp.get(f.param);
            facets[f.param] = v === "true" || v === "false" ? v : null;
        }
    }

    let dateFrom: string | null = null;
    let dateTo: string | null = null;
    if (d.dateRange) {
        const fromRaw = sp.get(d.dateRange.fromParam);
        const toRaw = sp.get(d.dateRange.toParam);
        dateFrom = fromRaw && ISO_DATE.test(fromRaw) ? fromRaw : null;
        dateTo = toRaw && ISO_DATE.test(toRaw) ? toRaw : null;
    }

    // page size — only honored if it's one of the descriptor's allowed options.
    const limitRaw = Number(sp.get(d.pageSize.param));
    const limit = d.pageSize.options.includes(limitRaw) ? limitRaw : null;

    return { q, sort, dir, facets, dateFrom, dateTo, limit };
}

/* ------------------------------- build (→URL) ----------------------------- */

/** RawCriteria → query string (no leading "?"). Preserves params NOT owned by
 *  this descriptor, drops the pager param, and omits values equal to the default
 *  (clean URLs: no `?sort=begin_date&dir=desc` when that is already the default).
 *  `base` is the current URLSearchParams (so unrelated state survives). */
export function buildSearch(
    d: DimensionDescriptor,
    c: RawCriteria,
    base: URLSearchParams,
): string {
    const next = new URLSearchParams(base);

    // every key this descriptor owns is cleared first, then re-set if active.
    const owned = ownedParams(d);
    for (const k of owned) next.delete(k);
    next.delete(d.pageParam); // any criteria change returns to page 1

    if (c.q && d.searchable !== false) next.set("q", c.q);

    if (c.sort !== d.defaultSort.key) next.set("sort", c.sort);
    if (c.dir !== d.defaultSort.dir) next.set("dir", c.dir);

    for (const f of d.facets) {
        if (f.kind === "select" || f.kind === "boolean") {
            const v = c.facets[f.param];
            if (v) next.set(f.param, v);
        }
    }
    if (d.dateRange) {
        if (c.dateFrom) next.set(d.dateRange.fromParam, c.dateFrom);
        if (c.dateTo) next.set(d.dateRange.toParam, c.dateTo);
    }

    // page size: only written when it differs from the default → clean initial URL.
    if (c.limit != null && c.limit !== d.pageSize.default) {
        next.set(d.pageSize.param, String(c.limit));
    }

    return next.toString();
}

/** All URL params a descriptor controls (for clean clearing/preservation). */
export function ownedParams(d: DimensionDescriptor): string[] {
    const keys = ["q", "sort", "dir", d.pageSize.param];
    for (const f of d.facets) {
        if (f.kind === "dateRange") keys.push(f.fromParam, f.toParam);
        else keys.push(f.param);
    }
    return keys;
}

/** Tool-name base shared by a dimension's imperative WebMCP tools
 *  (`<base>_filter` / `<base>_query_state`, DimensionMcpTools) and the declarative
 *  `toolname` on its search form (DimensionControls) — kept identical here so the
 *  two can't drift. `namespace` disambiguates the same dimension across contexts
 *  (a person's votes vs. the top-level votes catalogue); omitted → the bare
 *  dimension. Lower-snake-case recommended. */
export function dimensionToolBase(dimension: string, namespace?: string): string {
    return namespace ? `${namespace}_${dimension}` : dimension;
}

/* ------------------------------- sql shaping ------------------------------ */

/** Whitelisted ORDER BY fragment for the active sort. Falls back to the default
 *  sort if the key is somehow unknown (parseRaw already guarantees validity).
 *  `id` is appended as a deterministic tiebreak. Output is trusted — built only
 *  from the descriptor's `sqlExpr` allowlist, never from caller input. */
export function resolveOrderBy(
    d: DimensionDescriptor,
    c: RawCriteria,
): string {
    const opt =
        d.sorts.find((s) => s.key === c.sort) ??
        d.sorts.find((s) => s.key === d.defaultSort.key)!;
    const dir = c.dir === "asc" ? "ASC" : "DESC";
    return `${opt.sqlExpr} ${dir} NULLS LAST, id DESC`;
}

/** True when any search / non-default sort / facet / date bound is set. Drives
 *  the "Clear" affordance and the right empty-state copy ("no matches" vs
 *  "nothing recorded"). When false, the SQL collapses to the unfiltered,
 *  clustered fast path. */
export function hasActiveCriteria(
    d: DimensionDescriptor,
    c: RawCriteria,
): boolean {
    if (c.q) return true;
    if (c.sort !== d.defaultSort.key || c.dir !== d.defaultSort.dir) return true;
    if (c.dateFrom || c.dateTo) return true;
    return Object.values(c.facets).some((v) => v != null);
}

/** The neutral, unfiltered criteria for a descriptor (every facet cleared, the
 *  default sort and default page size). Shared by "Clear all" and the WebMCP
 *  reset path. */
export function defaultCriteria(d: DimensionDescriptor): RawCriteria {
    const facets: Record<string, string | null> = {};
    for (const f of d.facets) {
        if (f.kind === "select" || f.kind === "boolean") facets[f.param] = null;
    }
    return {
        q: null,
        sort: d.defaultSort.key,
        dir: d.defaultSort.dir,
        facets,
        dateFrom: null,
        dateTo: null,
        limit: null,
    };
}

/* ------------------------------- page size -------------------------------- */

/** The effective page size: the chosen option, else the descriptor default. */
export function resolveLimit(d: DimensionDescriptor, c: RawCriteria): number {
    return c.limit != null && d.pageSize.options.includes(c.limit)
        ? c.limit
        : d.pageSize.default;
}

/** The page-size options worth offering for a given result count. Excludes
 *  options that exceed what's available (no point offering "50" for 3 rows), but
 *  always includes the first option ≥ total (so the user can fit everything on
 *  one page) plus the default and the current selection. Returns [] when a
 *  selector would be pointless (everything already fits at the default size) —
 *  the UI then hides the control. */
export function visiblePageSizes(
    d: DimensionDescriptor,
    total: number,
    current: number,
): number[] {
    const opts = [...d.pageSize.options].sort((a, b) => a - b);
    const set = new Set<number>();
    for (const o of opts) if (o < total) set.add(o);
    const fit = opts.find((o) => o >= total);
    if (fit) set.add(fit);
    set.add(d.pageSize.default);
    set.add(current);
    const list = [...set].filter((n) => n > 0).sort((a, b) => a - b);
    // Hide when there's nothing meaningful to choose between — unless a non-default
    // size is already active (e.g. via a deep link), so the user can change it back.
    const worthShowing =
        list.length > 1 && (total > d.pageSize.default || current !== d.pageSize.default);
    return worthShowing ? list : [];
}