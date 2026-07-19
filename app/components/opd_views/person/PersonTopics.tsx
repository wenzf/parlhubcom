// PersonTopics.tsx           → ~/components/opd_views/people/PersonTopics.tsx
//
// Treemap of the words a person uses most in their speeches (German stopwords
// removed). Tiles are sized by frequency; the period control re-queries via the
// URL (?from / ?to), defaulting to the person's whole record.
//
// The treemap is a hand-coded squarified layout (no chart dependency), rendered
// as SVG in a fixed viewBox that scales to width — same approach as VotingChart
// / the discussion beeswarm. All copy runs through the `loc` map.

import * as React from "react";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { makeT, SectionCardHeader, AttributionFooter } from "../opd_micros";
import { chartCtx } from "../_shared/chart_alt";

/* -------------------------------- data shape ------------------------------ */

export interface TopicWord {
    word: string;
    count: number;
}

export interface PersonTopicsResult {
    person_id: number;
    name: string | null;
    window: {
        from: string | null;
        to: string | null;
        data_from: string | null;
        data_to: string | null;
        as_of: string;
        preset_4y: string;
        preset_8y: string;
    };
    params: { stopwords: string; top_n: number; min_count: number };
    n_speeches: number;
    n_words: number;
    n_distinct: number;
    words: TopicWord[];
}

export interface PersonTopicsProps {
    result: PersonTopicsResult;
    loc?: Record<string, string>;
    locale?: string;
}

/* ------------------------------ squarified treemap ------------------------- */

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Worst aspect ratio of a row of areas laid along `side` (lower = squarer). */
function worst(row: number[], side: number): number {
    if (row.length === 0) return Infinity;
    const s = row.reduce((a, b) => a + b, 0);
    const rmax = Math.max(...row);
    const rmin = Math.min(...row);
    return Math.max((side * side * rmax) / (s * s), (s * s) / (side * side * rmin));
}

/** Classic squarified treemap: `values` (sorted desc) → one rect each, filling
 *  the W×H box with areas proportional to value. */
function squarify(values: number[], W: number, H: number): Rect[] {
    const rects: Rect[] = new Array(values.length);
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const scale = (W * H) / total;
    const areas = values.map((v) => v * scale);

    let x = 0;
    let y = 0;
    let w = W;
    let h = H;
    let i = 0;
    while (i < areas.length) {
        const side = Math.min(w, h);
        let row: number[] = [];
        let j = i;
        while (j < areas.length) {
            const test = [...row, areas[j]];
            if (row.length === 0 || worst(test, side) <= worst(row, side)) {
                row = test;
                j++;
            } else break;
        }
        const s = row.reduce((a, b) => a + b, 0);
        if (w <= h) {
            const rowH = s / w || 0;
            let cx = x;
            for (let k = 0; k < row.length; k++) {
                const tw = row[k] / rowH || 0;
                rects[i + k] = { x: cx, y, w: tw, h: rowH };
                cx += tw;
            }
            y += rowH;
            h -= rowH;
        } else {
            const colW = s / h || 0;
            let cy = y;
            for (let k = 0; k < row.length; k++) {
                const th = row[k] / colW || 0;
                rects[i + k] = { x, y: cy, w: colW, h: th };
                cy += th;
            }
            x += colW;
            w -= colW;
        }
        i += row.length;
    }
    return rects;
}

/** Deterministic integer grouping (Swiss apostrophe) — identical on server and
 *  client, unlike Intl.NumberFormat whose ICU can differ and break hydration. */
function gi(n: number): string {
    return Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019");
}

/** Frequency → tile colour (light → deep blue) + a readable text colour. */
function tileColor(t: number): { fill: string; text: string } {
    const light = [219, 234, 254]; // #dbeafe
    const deep = [30, 58, 138]; // #1e3a8a
    const c = light.map((L, i) => Math.round(L + (deep[i] - L) * t));
    return {
        fill: `rgb(${c[0]}, ${c[1]}, ${c[2]})`,
        text: t > 0.5 ? "#ffffff" : "#0f172a",
    };
}

/* ------------------------------- component -------------------------------- */

export function PersonTopics({ result, loc, locale: _locale }: PersonTopicsProps) {
    const t = makeT(loc);
    const [params, setParams] = useSearchParams();

    // ---- period control: presets + custom, all via ?from/?to ----
    const setRange = (from: string | null, to: string | null) => {
        const next = new URLSearchParams(params);
        if (from) next.set("from", from);
        else next.delete("from");
        if (to) next.set("to", to);
        else next.delete("to");
        setParams(next, { preventScrollReset: true });
    };
    // Preset window starts come from the loader (server), so this render is
    // deterministic and hydration-safe (no `new Date()` at render time).
    const preset4 = result.window.preset_4y;
    const preset8 = result.window.preset_8y;
    const activePreset =
        !result.window.from && !result.window.to
            ? "all"
            : result.window.from === preset4 && !result.window.to
                ? "4y"
                : result.window.from === preset8 && !result.window.to
                    ? "8y"
                    : "custom";

    // ---- treemap geometry (fixed viewBox, scales to width) ----
    const W = 900;
    const H = 520;
    const words = result.words;
    const maxCount = words[0]?.count ?? 1;
    const rects = React.useMemo(
        () => squarify(words.map((w) => w.count), W, H),
        [words],
    );

    const hasData = words.length > 0;

    // Text alternative for the treemap: how many tiles it draws, whose speeches
    // they come from and the period ?from/?to resolved to. The person's name and
    // the data extent can both be absent, so they ride in {ctx}.
    const topicsCtx = chartCtx(result.name, result.window.data_from, result.window.data_to);
    const treemapAlt = t("topics_alt", { count: words.length, ctx: topicsCtx });
    // The table view carries the same data, so it takes the same facts — but its
    // own sentence: a <caption> naming the treemap would tell a reader who never
    // sees the SVG that they are in a picture.
    const tableAlt = t("topics_table_alt", { count: words.length, ctx: topicsCtx });

    return (
        <Card>
            <SectionCardHeader
                icon="tag"
                title={t("topics_title")}
                suffix={
                    result.name ? (
                        <span className="font-normal text-muted-foreground">
                            · {result.name}
                        </span>
                    ) : null
                }
                subtitle={t(
                    "topics_intro",
                )}
            />

            <CardContent className="space-y-4">
                {/* ---- period control ---- */}
                <div className="flex flex-wrap items-center gap-3">
                    <Segmented
                        size="sm"
                        value={activePreset}
                        onValueChange={(k) =>
                            setRange(k === "4y" ? preset4 : k === "8y" ? preset8 : null, null)
                        }
                    >
                        <SegmentedItem value="all">{t("topics_all_time")}</SegmentedItem>
                        <SegmentedItem value="4y">{t("topics_last_4y")}</SegmentedItem>
                        <SegmentedItem value="8y">{t("topics_last_8y")}</SegmentedItem>
                    </Segmented>

                    {/* custom range */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                            type="date"
                            value={result.window.from ?? ""}
                            onChange={(e) => setRange(e.target.value || null, result.window.to)}
                            className="h-11 rounded border border-input bg-transparent px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            aria-label={t("topics_from")}
                        />
                        <span>–</span>
                        <input
                            type="date"
                            value={result.window.to ?? ""}
                            onChange={(e) => setRange(result.window.from, e.target.value || null)}
                            className="h-11 rounded border border-input bg-transparent px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            aria-label={t("topics_to")}
                        />
                    </div>
                </div>

                {/* ---- summary line ---- */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                        {gi(result.n_speeches)} {t("topics_speeches")}
                    </span>
                    <span>
                        {gi(result.n_words)} {t("topics_words")}
                    </span>
                    <span>
                        {gi(result.n_distinct)} {t("topics_distinct")}
                    </span>
                    {result.window.data_from ? (
                        <span>
                            {result.window.data_from} → {result.window.data_to}
                        </span>
                    ) : null}
                </div>

                {/* ---- treemap ---- */}
                {hasData ? (
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        width="100%"
                        role="img"
                        aria-label={treemapAlt}
                        className="rounded-md"
                    >
                        {rects.map((rc, i) => {
                            const word = words[i];
                            const tnorm = word.count / maxCount;
                            const { fill, text } = tileColor(tnorm);
                            // label sizing: only draw when the tile can hold it
                            const fs = Math.max(
                                9,
                                Math.min(28, Math.floor(Math.min(rc.w / (word.word.length * 0.6), rc.h * 0.5))),
                            );
                            const showLabel = rc.w > 34 && rc.h > 16;
                            const showCount = rc.h > fs * 2.1 && rc.w > 40;
                            return (
                                <g key={word.word}>
                                    <rect
                                        x={rc.x}
                                        y={rc.y}
                                        width={Math.max(0, rc.w - 1.5)}
                                        height={Math.max(0, rc.h - 1.5)}
                                        fill={fill}
                                        rx={2}
                                    >
                                        <title>
                                            {`${word.word} — ${gi(word.count)} ${t("topics_uses")}`}
                                        </title>
                                    </rect>
                                    {showLabel && (
                                        <text
                                            x={rc.x + 4}
                                            y={rc.y + fs + 2}
                                            fontSize={fs}
                                            fill={text}
                                            className="font-medium"
                                            style={{ pointerEvents: "none" }}
                                        >
                                            {word.word}
                                        </text>
                                    )}
                                    {showLabel && showCount && (
                                        <text
                                            x={rc.x + 4}
                                            y={rc.y + fs * 2}
                                            fontSize={Math.max(8, fs * 0.6)}
                                            fill={text}
                                            opacity={0.75}
                                            style={{ pointerEvents: "none" }}
                                        >
                                            {gi(word.count)}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                ) : (
                    <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                        {t(
                            "topics_empty",
                        )}
                    </p>
                )}

                {/* Text equivalent for the treemap. The <svg> above is role="img"
                    with a single label, so its per-tile <title>s are never read out;
                    and a tile only draws its word when it is big enough (showLabel),
                    so the long tail is unreadable for everyone, not just AT users.
                    Same data, as a real table, behind a disclosure so it costs no
                    vertical space until asked for. Mirrors DataMap's approach: the
                    picture is decorative, the DOM carries the data. */}
                {hasData ? (
                    <Collapsible>
                        <CollapsibleTrigger className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                            {t("topics_table_toggle")}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="max-h-96 overflow-auto">
                                <table className="w-full border-collapse text-sm">
                                    <caption className="sr-only">{tableAlt}</caption>
                                    <thead className="sticky top-0 bg-background">
                                        <tr>
                                            <th scope="col" className="border-b py-1.5 text-left font-medium text-muted-foreground">
                                                {t("topics_table_word")}
                                            </th>
                                            <th scope="col" className="border-b py-1.5 text-right font-medium text-muted-foreground">
                                                {t("topics_uses")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {words.map((w) => (
                                            <tr key={w.word}>
                                                <th scope="row" className="border-b py-1.5 text-left font-normal text-foreground">
                                                    {w.word}
                                                </th>
                                                <td className="border-b py-1.5 text-right tabular-nums text-foreground">
                                                    {gi(w.count)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                ) : null}

                <AttributionFooter t={t} anchor="vocabulary" className="border-t pt-3 text-xs text-muted-foreground" />
            </CardContent>
        </Card>
    );
}

export default PersonTopics;