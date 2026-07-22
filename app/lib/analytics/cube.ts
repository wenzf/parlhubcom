// cube.ts                              → ~/lib/analytics/cube.ts
//
// Client-side pivot over the traffic cube that deploy/analytics.ts writes to
// s3://<bucket>/analytics/summary.json. The shape here IS that file's shape —
// swapping the dummy generator for the real fetch must not touch this module.
//
// Why a cube and not a prepared series: the page lets the reader group by route,
// language, visitor type or device, so no single pre-baked view works. The file
// ships one dictionary-encoded fact row per
// period × route × lang × visitor × device and the browser re-aggregates on every
// interaction — one fetch, then instant, offline pivots.
//
// The measures are chosen so they stay correct under re-aggregation, which is the
// whole trick:
//   • reqs, sum_ms, hist[] are SUMS      → add them
//   • max_ms is a MAX                    → max of maxes
//   • avg is NOT stored                  → derived as sum_ms / reqs, per slice
//   • p95 is NOT stored                  → read off the histogram, per slice
// Storing avg or p95 directly would be wrong the moment anyone filters: you
// cannot average averages, and percentiles do not merge.

/** Column order of `rows` — mirrors `cols` in summary.json. */
const I_PERIOD = 0, I_ROUTE = 1, I_LANG = 2, I_VISITOR = 3, I_DEVICE = 4;
const I_REQS = 5, I_SUM_MS = 6, I_MAX_MS = 7, I_HIST = 8;

/** Upper bound (ms) of each histogram bucket; the last is open-ended (null). */
export type Buckets = (number | null)[];

export type Cube = {
    schema: number;
    generated_at: string;
    buckets: Buckets;
    /** ISO day ("2026-07-16") for recent periods, month ("2026-07") once rolled up. */
    periods: string[];
    routes: string[];
    langs: string[];
    visitors: string[];
    devices: string[];
    /** [periodIdx, routeIdx, langIdx, visitorIdx, deviceIdx, reqs, sum_ms, max_ms, ...hist] */
    rows: number[][];
};

/** The dimensions a reader can group or filter by. */
export type Dim = "route" | "lang" | "visitor" | "device";
export const DIMS: Dim[] = ["route", "lang", "visitor", "device"];

const DIM_COL: Record<Dim, number> = {
    route: I_ROUTE,
    lang: I_LANG,
    visitor: I_VISITOR,
    device: I_DEVICE,
};

const dimLabels = (cube: Cube, dim: Dim): string[] =>
    dim === "route" ? cube.routes : dim === "lang" ? cube.langs : dim === "visitor" ? cube.visitors : cube.devices;

export type Measures = {
    reqs: number;
    sum_ms: number;
    max_ms: number;
    hist: number[];
};

const empty = (n: number): Measures => ({ reqs: 0, sum_ms: 0, max_ms: 0, hist: Array(n).fill(0) });

const add = (a: Measures, row: number[], nBuckets: number): Measures => {
    a.reqs += row[I_REQS];
    a.sum_ms += row[I_SUM_MS];
    a.max_ms = Math.max(a.max_ms, row[I_MAX_MS]);
    for (let i = 0; i < nBuckets; i++) a.hist[i] += row[I_HIST + i] ?? 0;
    return a;
};

/** Mean response time for a slice. Null when the slice has no requests. */
export const avgMs = (m: Measures): number | null => (m.reqs ? m.sum_ms / m.reqs : null);

/**
 * Approximate p95 from bucket counts.
 *
 * Returns the upper bound of the bucket the 95th request falls in — i.e. "95% of
 * requests were faster than this". Coarse by construction (bucket-resolution),
 * but it re-aggregates correctly at any slice, which an exact stored p95 cannot.
 * Null for the open-ended top bucket: all we know is "slower than the last bound".
 */
export function p95Ms(m: Measures, buckets: Buckets): number | null {
    if (!m.reqs) return null;
    const target = m.reqs * 0.95;
    let seen = 0;
    for (let i = 0; i < m.hist.length; i++) {
        seen += m.hist[i];
        if (seen >= target) return buckets[i] ?? null;
    }
    return null;
}

export type Filters = Partial<Record<Dim, string>>;

const rowPasses = (cube: Cube, row: number[], filters: Filters): boolean => {
    for (const dim of DIMS) {
        const want = filters[dim];
        if (!want) continue;
        if (dimLabels(cube, dim)[row[DIM_COL[dim]]] !== want) return false;
    }
    return true;
};

/** Audience scope over the visitor dimension — the human/bot split the page
 *  toggles between. "both" keeps everyone. */
export type Audience = "human" | "bot" | "both";

/**
 * Which side of the human/bot split a *visitor label* falls on. The labels are
 * the ones classifyVisitor emits (agents.ts): "browser" is the only human class;
 * "bot:*", "tool" and "unknown" are automated; "internal:*" (the load balancer's
 * health checks) is infrastructure — neither, gated by `includeInternal` instead.
 *
 * Deliberately keyed off the already-classified LABEL, not the raw user-agent, so
 * this stays a pure string check with no `isbot` dependency dragged into the
 * client bundle.
 */
export function visitorGroup(label: string): "human" | "bot" | "internal" {
    if (label.startsWith("internal:")) return "internal";
    return label === "browser" ? "human" : "bot";
}

/**
 * A cube narrowed to an audience. Health-check traffic is kept only when
 * `includeInternal` is set, and never in the human view (it is not a human).
 * Pure row filter — the measures are untouched, so every downstream aggregate
 * (avg, p95, shares) stays correct at the narrowed slice.
 */
export function scopeCube(cube: Cube, audience: Audience, includeInternal: boolean): Cube {
    const groups = cube.visitors.map(visitorGroup);
    return {
        ...cube,
        rows: cube.rows.filter((r) => {
            const g = groups[r[I_VISITOR]];
            if (g === "internal") return includeInternal && audience !== "human";
            return audience === "both" || g === audience;
        }),
    };
}

/** The synthetic route bucket deploy/analytics.ts folds off-site / junk paths into
 *  (scanners, malformed or mistyped URLs). Its raw label in `cube.routes`. */
export const OTHER_ROUTE = "(other)";

/**
 * A cube with the "(other)" route bucket dropped. That bucket is off-site noise —
 * scanner and malformed-URL traffic that never touches a real page — so it inflates
 * every total without describing usage. Excluded by default, kept on request: the
 * same in/out scoping the health checks get. Pure row filter, measures untouched, so
 * downstream aggregates stay correct at the narrowed slice.
 */
export function dropOther(cube: Cube, includeOther: boolean): Cube {
    if (includeOther) return cube;
    const otherIdx = cube.routes.indexOf(OTHER_ROUTE);
    if (otherIdx < 0) return cube;
    return { ...cube, rows: cube.rows.filter((r) => r[I_ROUTE] !== otherIdx) };
}

/** Time grain of the page's time axis — the daily/monthly view toggle. */
export type Grain = "daily" | "monthly";
export const GRAINS: Grain[] = ["daily", "monthly"];

/**
 * A cube re-binned to one time grain. The summary mixes grains (recent days at
 * day grain, older ones pre-rolled to months by deploy/analytics.ts), and a
 * chart must not show both at once: a bar summing a whole month towers over a
 * bar holding a single day.
 *   • "daily"   keeps only the day-grain periods — the recent full-grain window.
 *     The pre-rolled months carry no per-day facts, so they cannot appear here.
 *   • "monthly" collapses every period to its month, including the running,
 *     incomplete one — additive measures merge by sum, max_ms by max, which is
 *     exactly what makes the rows safe to re-bin (see the header comment).
 */
export function grainCube(cube: Cube, grain: Grain): Cube {
    if (grain === "daily") {
        const remap = new Map<number, number>();
        const periods: string[] = [];
        cube.periods.forEach((p, i) => {
            if (p.length > 7) {
                remap.set(i, periods.length);
                periods.push(p);
            }
        });
        return {
            ...cube,
            periods,
            rows: cube.rows
                .filter((r) => remap.has(r[I_PERIOD]))
                .map((r) => {
                    const c = [...r];
                    c[I_PERIOD] = remap.get(r[I_PERIOD])!;
                    return c;
                }),
        };
    }
    const monthOf = cube.periods.map((p) => p.slice(0, 7));
    const periods = [...new Set(monthOf)].sort();
    const pIdx = new Map(periods.map((p, i) => [p, i]));
    // period|route|lang|visitor|device -> merged row; collisions are the days
    // (and any pre-rolled month) folding into the same month.
    const merged = new Map<string, number[]>();
    for (const r of cube.rows) {
        const c = [...r];
        c[I_PERIOD] = pIdx.get(monthOf[r[I_PERIOD]])!;
        const key = c.slice(I_PERIOD, I_REQS).join("|");
        const m = merged.get(key);
        if (!m) {
            merged.set(key, c);
            continue;
        }
        m[I_REQS] += c[I_REQS];
        m[I_SUM_MS] += c[I_SUM_MS];
        m[I_MAX_MS] = Math.max(m[I_MAX_MS], c[I_MAX_MS]);
        for (let i = I_HIST; i < c.length; i++) m[i] = (m[i] ?? 0) + (c[i] ?? 0);
    }
    return { ...cube, periods, rows: [...merged.values()] };
}

/** Totals across everything that passes `filters`. */
export function total(cube: Cube, filters: Filters = {}): Measures {
    const acc = empty(cube.buckets.length);
    for (const row of cube.rows) if (rowPasses(cube, row, filters)) add(acc, row, cube.buckets.length);
    return acc;
}

export type Series = { key: string; measures: Measures };

/** One entry per distinct value of `dim`, sorted by requests desc. */
export function groupBy(cube: Cube, dim: Dim, filters: Filters = {}): Series[] {
    const acc = new Map<string, Measures>();
    const labels = dimLabels(cube, dim);
    for (const row of cube.rows) {
        if (!rowPasses(cube, row, filters)) continue;
        const key = labels[row[DIM_COL[dim]]];
        let m = acc.get(key);
        if (!m) acc.set(key, (m = empty(cube.buckets.length)));
        add(m, row, cube.buckets.length);
    }
    return [...acc.entries()]
        .map(([key, measures]) => ({ key, measures }))
        .sort((a, b) => b.measures.reqs - a.measures.reqs);
}

export type TimePoint = { period: string; byKey: Map<string, Measures> };

/**
 * Time series: one point per period, each carrying the measures per `dim` value.
 * Periods with no matching rows still appear (as zeroes) so the x-axis stays
 * continuous and a quiet day reads as a quiet day rather than a gap.
 */
export function timeSeries(cube: Cube, dim: Dim, filters: Filters = {}): TimePoint[] {
    const points: TimePoint[] = cube.periods.map((period) => ({ period, byKey: new Map() }));
    const labels = dimLabels(cube, dim);
    for (const row of cube.rows) {
        if (!rowPasses(cube, row, filters)) continue;
        const pt = points[row[I_PERIOD]];
        if (!pt) continue;
        const key = labels[row[DIM_COL[dim]]];
        let m = pt.byKey.get(key);
        if (!m) pt.byKey.set(key, (m = empty(cube.buckets.length)));
        add(m, row, cube.buckets.length);
    }
    return points;
}

/**
 * Keep the `limit` biggest keys and fold the rest into one "other" series.
 * `route` has ~40 values and no chart can show them at once; without this the
 * legend is unreadable and the colours stop meaning anything.
 */
export function topKeys(series: Series[], limit: number): { keys: string[]; hasOther: boolean } {
    const keys = series.slice(0, limit).map((s) => s.key);
    return { keys, hasOther: series.length > limit };
}
