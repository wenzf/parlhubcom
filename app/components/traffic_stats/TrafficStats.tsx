// TrafficStats.tsx                → ~/components/traffic_stats/TrafficStats.tsx
//
// /project/traffic-stats — the traffic cube, pivoted in the browser.
//
// Shape follows the other charts here (VotingChart, PersonTopics): hand-rolled
// SVG in a fixed viewBox that scales to width, no chart library. The <svg> is
// role="img" with a one-sentence aria-label, and the table underneath is its text
// equivalent — that pairing is what makes an interactive chart AAA-able, since a
// screen reader can't walk <rect>s.
//
// All visible copy comes from `loc` (/public/locales/<lang>/loc_traffic_stats.json)
// via makeT. The chart's aria-label is a tokenized template — grammar in TS, flat
// strings in JSON — and its one conditional (health checks in or out) is a sibling
// key rather than a branch inside the JSON, matching the SEO copy's shape.

import * as React from "react";
import { useSearchParams } from "react-router";

import { Card, CardContent } from "@/components/ui/card";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { makeT } from "~/lib/lang";
import { NO_PARTY, assignPaletteByOrder } from "~/lib/export/colors";
import { MethodologyLink } from "~/components/opd_views/_shared/MethodologyLink";
import {
    DIMS,
    GRAINS,
    avgMs,
    dropOther,
    grainCube,
    groupBy,
    p95Ms,
    scopeCube,
    timeSeries,
    topKeys,
    total,
    type Audience,
    type Buckets,
    type Cube,
    type Dim,
    type Filters,
    type Grain,
    type Series,
} from "~/lib/analytics/cube";

/** Keys of the `traffic_stats` object in loc_traffic_stats.json. */
export type TrafficStatsLoc = {
    title: string;
    lead: string;
    no_data: string;
    group_by: string;
    group_by_aria: string;
    audience: string;
    audience_aria: string;
    aud_human: string;
    aud_bot: string;
    aud_both: string;
    view: string;
    view_aria: string;
    view_daily: string;
    view_monthly: string;
    dim_route: string;
    dim_lang: string;
    dim_visitor: string;
    dim_device: string;
    include_internal: string;
    include_other: string;
    stat_requests: string;
    stat_average: string;
    stat_p95: string;
    stat_slowest: string;
    col_share: string;
    other: string;
    route_other_note: string;
    chart_alt: string;
    chart_alt_excl: string;
    table_caption: string;
    footnote: string;
};

/** Synthetic series key for everything past MAX_SERIES. Never displayed raw. */
const OTHER = "other";

/**
 * Series colours come from the app's shared diagram palette (~/lib/export/colors),
 * the same one the hemicycle, beeswarm and alignment scatter use — not the
 * --chart-1..5 ramp, which is defined identically in light and dark and so has
 * steps that all but vanish against one theme or the other.
 *
 * assignPaletteByOrder wants keys already ordered by size; groupBy() returns them
 * sorted by requests descending, which is exactly the contract ("the largest
 * groups get the most distinct colours").
 *
 * The cap is about legibility, not palette size — PALETTE has 16 entries, but a
 * stack of more than a handful of bands, and its legend, stop being readable.
 * Everything past it folds into one "other" band in the neutral fallback swatch.
 */
const OTHER_COLOR = NO_PARTY;
/** 1px background edge between stacked bands, so neighbours never bleed together. */
const SEG_STROKE = "var(--background)";
const MAX_SERIES = 6;

// View state lives in the URL so a link carries the exact chart the reader is
// looking at (group / audience / health-checks). Only values that differ from the
// default are written, so the bare /project/traffic-stats URL stays param-free and
// canonical — the meta() canonical uses the pathname only, never the search.
const PARAM = { group: "group", audience: "audience", view: "view", health: "health", other: "other", sort: "sort" } as const;
const DIM_DEFAULT: Dim = "visitor";
const AUD_DEFAULT: Audience = "human";
const AUDIENCES: Audience[] = ["human", "bot", "both"];
// Daily is what a reader checks day to day; monthly is the long-run view once
// the archive outgrows the summary's 90-day full-grain window.
const GRAIN_DEFAULT: Grain = "daily";

// The segmented controls must survive a 320px viewport (WCAG 1.4.10 reflow):
// four localized labels in one pill overflow a phone, so the track may wrap.
// The item min-height keeps a single-row track at exactly the standard 44px
// (38px item + track padding + border) and stops wrapped rows collapsing to
// text height.
const SEG_WRAP = "h-auto min-h-11 max-w-full flex-wrap";
const SEG_WRAP_ITEM = "min-h-[2.375rem]";

/** Table sort columns. `share` is reqs/total, so it orders identically to `reqs` —
 *  it still gets its own key so clicking that header visibly responds. */
type SortCol = "name" | "reqs" | "share" | "avg" | "p95" | "max";
const SORT_COLS: SortCol[] = ["name", "reqs", "share", "avg", "p95", "max"];
/** Encoded as `?sort=<col>` (ascending) / `?sort=-<col>` (descending). */
const SORT_DEFAULT = "-reqs";

/** Numeric rank of a row for a sort column. p95's open-ended top bucket reads
 *  null ("slower than the last bound") — rank it above every finite value rather
 *  than treating it as missing. */
function sortRank(g: Series, col: SortCol, buckets: Buckets): number {
    const m = g.measures;
    switch (col) {
        case "reqs":
        case "share":
            return m.reqs;
        case "avg":
            return avgMs(m) ?? 0;
        case "p95":
            return p95Ms(m, buckets) ?? Number.POSITIVE_INFINITY;
        default:
            return m.max_ms;
    }
}

const VB_W = 960;
const VB_H = 300;
const PAD = { top: 12, right: 12, bottom: 26, left: 54 };

export function TrafficStats({ cube, loc, lang }: { cube: Cube; loc: TrafficStatsLoc; lang: string }) {
    const t = makeT(loc as unknown as Record<string, string>);

    // The URL is the single source of truth for the three view controls, so the
    // page renders the same state on the server and after hydration (both read the
    // same search params — no useState/useEffect divergence) and a copied link
    // restores the exact view. Unknown/empty params fall back to the default.
    const [searchParams, setSearchParams] = useSearchParams();
    const rawDim = searchParams.get(PARAM.group);
    const dim: Dim = DIMS.includes(rawDim as Dim) ? (rawDim as Dim) : DIM_DEFAULT;
    const rawAud = searchParams.get(PARAM.audience);
    // Who the figures are about. Humans first: that is what a reader comes for, and
    // bots outnumber them enough to bury the human signal in a combined view.
    const audience: Audience = AUDIENCES.includes(rawAud as Audience) ? (rawAud as Audience) : AUD_DEFAULT;
    // Health checks are the ALB talking to itself ~5,760x/day — they'd dominate
    // every chart and tell the reader nothing. Off by default, but visible on
    // request rather than silently dropped from the data.
    const showInternal = searchParams.get(PARAM.health) === "1";
    // The "(other)" route bucket is off-site scanner / junk-path noise (deploy/
    // analytics.ts). Off by default like the health checks — inflates every total
    // without describing real usage — but kept in the data and shown on request.
    const showOther = searchParams.get(PARAM.other) === "1";
    const rawGrain = searchParams.get(PARAM.view);
    const grain: Grain = GRAINS.includes(rawGrain as Grain) ? (rawGrain as Grain) : GRAIN_DEFAULT;

    /** Write one control to the URL, dropping the param when it returns to its
     *  default so a shared link carries only what the reader actually changed.
     *  `replace` keeps the back button clean; `preventScrollReset` stops the page
     *  from jumping when a control is toggled. */
    const setParam = React.useCallback(
        (key: string, value: string, isDefault: boolean) =>
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    if (isDefault) next.delete(key);
                    else next.set(key, value);
                    return next;
                },
                { replace: true, preventScrollReset: true },
            ),
        [setSearchParams],
    );

    const dimLabel: Record<Dim, string> = {
        route: t("dim_route"),
        lang: t("dim_lang"),
        visitor: t("dim_visitor"),
        device: t("dim_device"),
    };
    const audLabel: Record<Audience, string> = {
        human: t("aud_human"),
        bot: t("aud_bot"),
        both: t("aud_both"),
    };
    const grainLabel: Record<Grain, string> = {
        daily: t("view_daily"),
        monthly: t("view_monthly"),
    };

    // Numbers follow the UI language: 21,431,416 vs 21.431.416 vs 21 431 416.
    //
    // The locale is passed in explicitly and never left to Intl's default. That
    // default is the SERVER's locale during SSR (de-DE on the box that renders
    // this) and the BROWSER's on the client — so an English page rendered German
    // separators, and every page risked a hydration mismatch (React #418) when the
    // two disagreed. See docs/edge-cases.md.
    const nf = React.useMemo(() => new Intl.NumberFormat(lang), [lang]);
    const fmtInt = (n: number) => nf.format(Math.round(n));
    const fmtMs = (n: number | null) => (n === null ? "—" : `${nf.format(Math.round(n))} ms`);
    /**
     * Share of total. One series holds ~99.99% here, so a plain 1-decimal render
     * shows every human-scale row as a flat "0.0%" — technically true, and useless.
     * Show the smallest meaningful thing instead: non-zero, but under a tenth of a
     * percent.
     */
    const pct = (n: number, of: number) => {
        if (!of) return "—";
        const p = (n / of) * 100;
        if (p === 0) return "0%";
        if (p < 0.1) return "<0.1%";
        return `${p.toFixed(1)}%`;
    };

    const filters: Filters = React.useMemo(() => ({}), []);

    // Audience scope, then time grain — the grain re-bins whatever the scope
    // kept, so stats, chart and table all describe the same slice. In the daily
    // view that slice is the summary's full-grain window (~90 days); monthly
    // covers the whole archive including the running month.
    const cubeView = React.useMemo(
        () => grainCube(dropOther(scopeCube(cube, audience, showInternal), showOther), grain),
        [cube, audience, showInternal, showOther, grain],
    );

    const groups = React.useMemo(() => groupBy(cubeView, dim, filters), [cubeView, dim, filters]);
    const totals = React.useMemo(() => total(cubeView, filters), [cubeView, filters]);
    const points = React.useMemo(() => timeSeries(cubeView, dim, filters), [cubeView, dim, filters]);
    const { keys, hasOther } = React.useMemo(() => topKeys(groups, MAX_SERIES), [groups]);

    // keys are already ordered by requests desc — the ordering assignPaletteByOrder
    // expects. Anything outside the top N (including the "other" band) is neutral.
    const colorMap = React.useMemo(() => assignPaletteByOrder(keys), [keys]);
    const colorOf = (key: string) => colorMap.get(key) ?? OTHER_COLOR;
    /** Series keys are data, not copy — only the synthetic "other" band is localized. */
    const seriesLabel = (key: string) => (key === OTHER ? t("other") : key);

    // Table sort, URL-driven like the other view controls (?sort=avg / ?sort=-avg).
    const rawSort = searchParams.get(PARAM.sort) ?? SORT_DEFAULT;
    const sortDesc = rawSort.startsWith("-");
    const maybeCol = (sortDesc ? rawSort.slice(1) : rawSort) as SortCol;
    const sortCol: SortCol = SORT_COLS.includes(maybeCol) ? maybeCol : "reqs";

    const onSort = (col: SortCol) => {
        // Same column toggles direction; a new column starts at its natural one
        // (names A→Z, numbers largest-first).
        const desc = col === sortCol ? !sortDesc : col !== "name";
        const encoded = `${desc ? "-" : ""}${col}`;
        setParam(PARAM.sort, encoded, encoded === SORT_DEFAULT);
    };

    const sortedGroups = React.useMemo(() => {
        const dir = sortDesc ? -1 : 1;
        return [...groups].sort((a, b) =>
            sortCol === "name"
                ? dir * seriesLabel(a.key).localeCompare(seriesLabel(b.key), lang)
                : dir * (sortRank(a, sortCol, cubeView.buckets) - sortRank(b, sortCol, cubeView.buckets)),
        );
    }, [groups, sortCol, sortDesc, lang, cubeView.buckets]);

    // Stacked totals per period, top-N then "other" — same order as the legend.
    const stacks = React.useMemo(() => {
        const seriesKeys = hasOther ? [...keys, OTHER] : keys;
        return points.map((pt) => {
            const parts = seriesKeys.map((k) => {
                if (k !== OTHER) return { key: k, reqs: pt.byKey.get(k)?.reqs ?? 0 };
                let rest = 0;
                for (const [kk, m] of pt.byKey) if (!keys.includes(kk)) rest += m.reqs;
                return { key: OTHER, reqs: rest };
            });
            return { period: pt.period, parts, sum: parts.reduce((s, p) => s + p.reqs, 0) };
        });
    }, [points, keys, hasOther]);

    /** "2026-07-16" -> "16 Jul"; a rolled-up "2026-07" -> "Jul 2026". */
    const shortPeriod = (p: string) =>
        p.length === 7
            ? new Date(`${p}-01T00:00:00Z`).toLocaleDateString(lang, { month: "short", year: "numeric", timeZone: "UTC" })
            : new Date(`${p}T00:00:00Z`).toLocaleDateString(lang, { day: "numeric", month: "short", timeZone: "UTC" });

    const yMax = Math.max(1, ...stacks.map((s) => s.sum));
    const plotW = VB_W - PAD.left - PAD.right;
    const plotH = VB_H - PAD.top - PAD.bottom;
    const bandW = plotW / Math.max(1, stacks.length);
    const barW = Math.max(1, bandW * 0.72);
    const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;

    // Ticks: 0, mid, max — three is enough at this size and keeps the axis quiet.
    const ticks = [0, yMax / 2, yMax];

    // Sibling keys, not a branch in the JSON: the "excluding health checks" clause
    // is prose, so it can't ride in a punctuation-only {ctx} fact list.
    const alt = t(showInternal ? "chart_alt" : "chart_alt_excl", {
        dim: dimLabel[dim],
        periods: stacks.length,
        count: fmtInt(totals.reqs),
    });

    const legendKeys = hasOther ? [...keys, OTHER] : keys;

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardContent className="flex flex-col gap-5 pt-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div className="flex min-w-0 flex-wrap items-end gap-6">
                            {/* min-w-0 beats the fieldset default (min-inline-size:
                                min-content), which otherwise forbids the pill inside
                                from ever wrapping and pushes it off a phone screen. */}
                            <fieldset className="flex min-w-0 flex-col gap-2">
                                <legend className="text-sm text-muted-foreground">{t("group_by")}</legend>
                                <Segmented
                                    value={dim}
                                    onValueChange={(v) => v && setParam(PARAM.group, v, v === DIM_DEFAULT)}
                                    aria-label={t("group_by_aria")}
                                    className={SEG_WRAP}
                                >
                                    {DIMS.map((d) => (
                                        <SegmentedItem key={d} value={d} className={SEG_WRAP_ITEM}>
                                            {dimLabel[d]}
                                        </SegmentedItem>
                                    ))}
                                </Segmented>
                            </fieldset>

                            <fieldset className="flex min-w-0 flex-col gap-2">
                                <legend className="text-sm text-muted-foreground">{t("audience")}</legend>
                                <Segmented
                                    value={audience}
                                    onValueChange={(v) => v && setParam(PARAM.audience, v, v === AUD_DEFAULT)}
                                    aria-label={t("audience_aria")}
                                    className={SEG_WRAP}
                                >
                                    {AUDIENCES.map((a) => (
                                        <SegmentedItem key={a} value={a} className={SEG_WRAP_ITEM}>
                                            {audLabel[a]}
                                        </SegmentedItem>
                                    ))}
                                </Segmented>
                            </fieldset>

                            <fieldset className="flex min-w-0 flex-col gap-2">
                                <legend className="text-sm text-muted-foreground">{t("view")}</legend>
                                <Segmented
                                    value={grain}
                                    onValueChange={(v) => v && setParam(PARAM.view, v, v === GRAIN_DEFAULT)}
                                    aria-label={t("view_aria")}
                                    className={SEG_WRAP}
                                >
                                    {GRAINS.map((g) => (
                                        <SegmentedItem key={g} value={g} className={SEG_WRAP_ITEM}>
                                            {grainLabel[g]}
                                        </SegmentedItem>
                                    ))}
                                </Segmented>
                            </fieldset>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="show-other"
                                    checked={showOther}
                                    onCheckedChange={(c) => setParam(PARAM.other, "1", !c)}
                                />
                                <label htmlFor="show-other" className="text-sm">
                                    {t("include_other")}
                                </label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="show-internal"
                                    checked={showInternal}
                                    onCheckedChange={(c) => setParam(PARAM.health, "1", !c)}
                                />
                                <label htmlFor="show-internal" className="text-sm">
                                    {t("include_internal")}
                                </label>
                            </div>
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Stat label={t("stat_requests")} value={fmtInt(totals.reqs)} />
                        <Stat label={t("stat_average")} value={fmtMs(avgMs(totals))} />
                        <Stat label={t("stat_p95")} value={fmtMs(p95Ms(totals, cubeView.buckets))} />
                        <Stat label={t("stat_slowest")} value={fmtMs(totals.max_ms || null)} />
                    </dl>

                    <div className="mt-1 flex justify-end border-t pt-3">
                        <MethodologyLink anchor="traffic" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="flex flex-col gap-4 pt-6">
                    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" role="img" aria-label={alt}>
                        {ticks.map((tick, i) => (
                            <g key={i}>
                                <line
                                    x1={PAD.left}
                                    x2={VB_W - PAD.right}
                                    y1={y(tick)}
                                    y2={y(tick)}
                                    stroke="var(--border)"
                                    strokeWidth="1"
                                />
                                <text
                                    x={PAD.left - 8}
                                    y={y(tick)}
                                    textAnchor="end"
                                    dominantBaseline="middle"
                                    fill="var(--muted-foreground)"
                                    fontSize="12"
                                >
                                    {fmtInt(tick)}
                                </text>
                            </g>
                        ))}

                        {stacks.map((s, i) => {
                            let acc = 0;
                            return (
                                <g key={s.period}>
                                    {s.parts.map((p) => {
                                        if (!p.reqs) return null;
                                        const yTop = y(acc + p.reqs);
                                        const h = y(acc) - yTop;
                                        acc += p.reqs;
                                        return (
                                            <rect
                                                key={p.key}
                                                x={PAD.left + i * bandW + (bandW - barW) / 2}
                                                y={yTop}
                                                width={barW}
                                                height={Math.max(0.5, h)}
                                                fill={colorOf(p.key)}
                                                stroke={SEG_STROKE}
                                                strokeWidth="0.75"
                                            />
                                        );
                                    })}
                                </g>
                            );
                        })}

                        {/* Only first/last/middle labels — daily ticks would collide. */}
                        {stacks.map((s, i) => {
                            const show = i === 0 || i === stacks.length - 1 || i === Math.floor(stacks.length / 2);
                            if (!show) return null;
                            return (
                                <text
                                    key={s.period}
                                    x={PAD.left + i * bandW + bandW / 2}
                                    y={VB_H - 8}
                                    textAnchor={i === 0 ? "start" : i === stacks.length - 1 ? "end" : "middle"}
                                    fill="var(--muted-foreground)"
                                    fontSize="12"
                                >
                                    {shortPeriod(s.period)}
                                </text>
                            );
                        })}
                    </svg>

                    <ul className="flex flex-wrap gap-x-5 gap-y-2">
                        {legendKeys.map((k) => (
                            <li key={k} className="flex items-center gap-2 text-sm">
                                <span
                                    aria-hidden="true"
                                    className="inline-block size-3 rounded-xs border border-input"
                                    style={{ background: colorOf(k) }}
                                />
                                {seriesLabel(k)}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <caption className="sr-only">{t("table_caption", { dim: dimLabel[dim] })}</caption>
                            <thead>
                                <tr className="border-b text-xs text-muted-foreground">
                                    <SortTh label={dimLabel[dim]} col="name" align="left" sortCol={sortCol} sortDesc={sortDesc} onSort={onSort} />
                                    <SortTh label={t("stat_requests")} col="reqs" align="right" sortCol={sortCol} sortDesc={sortDesc} onSort={onSort} />
                                    <SortTh label={t("col_share")} col="share" align="right" sortCol={sortCol} sortDesc={sortDesc} onSort={onSort} />
                                    <SortTh label={t("stat_average")} col="avg" align="right" sortCol={sortCol} sortDesc={sortDesc} onSort={onSort} />
                                    <SortTh label={t("stat_p95")} col="p95" align="right" sortCol={sortCol} sortDesc={sortDesc} onSort={onSort} />
                                    <SortTh label={t("stat_slowest")} col="max" align="right" sortCol={sortCol} sortDesc={sortDesc} onSort={onSort} />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedGroups.map((g) => (
                                    <tr key={g.key} className="border-b border-border/50 last:border-0">
                                        <th scope="row" className="px-2 py-1.5 text-left font-normal">
                                            <span className="flex items-center gap-2">
                                                <span
                                                    aria-hidden="true"
                                                    className="inline-block size-3 shrink-0 rounded-xs border border-input"
                                                    style={{ background: colorOf(g.key) }}
                                                />
                                                {seriesLabel(g.key)}
                                            </span>
                                        </th>
                                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{fmtInt(g.measures.reqs)}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                                            {pct(g.measures.reqs, totals.reqs)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{fmtMs(avgMs(g.measures))}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                                            {fmtMs(p95Ms(g.measures, cubeView.buckets))}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                                            {fmtMs(g.measures.max_ms || null)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="pt-4 text-sm text-muted-foreground">{t("footnote")}</p>
                    {/* Only meaningful in the route view, where the "(other)" bucket appears. */}
                    {dim === "route" && (
                        <p className="pt-2 text-sm text-muted-foreground">{t("route_other_note")}</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Sortable column header — the APG sortable-table pattern: a real <button> inside
 * the <th> (keyboard-operable, its accessible name is the column label) and
 * `aria-sort` on the <th> itself. Styling mirrors the vote-list table's `Th` in
 * VotingChart.tsx (muted text-xs header, ↑/↓ glyph at opacity-30 when inactive,
 * ring-offset focus, min-h-11 = the AAA 44px target) so the two tables read as
 * one system; the only addition is per-column alignment, which the numeric
 * columns here need.
 */
function SortTh({
    label,
    col,
    align,
    sortCol,
    sortDesc,
    onSort,
}: {
    label: string;
    col: SortCol;
    align: "left" | "right";
    sortCol: SortCol;
    sortDesc: boolean;
    onSort: (col: SortCol) => void;
}) {
    const active = col === sortCol;
    return (
        <th
            scope="col"
            className={`px-2 py-2 font-medium ${align === "left" ? "text-left" : "text-right"}`}
            aria-sort={active ? (sortDesc ? "descending" : "ascending") : "none"}
        >
            <button
                type="button"
                onClick={() => onSort(col)}
                className="inline-flex min-h-11 items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                {label}
                <span aria-hidden="true" className={active ? "text-foreground" : "opacity-30"}>
                    {active && sortDesc ? "↓" : "↑"}
                </span>
            </button>
        </th>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-[550] tabular-nums">{value}</dd>
        </div>
    );
}
