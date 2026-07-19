// BodyDiscussion.tsx            → ~/components/opd_views/bodies/BodyDiscussion.tsx
//
// Presentational visualization + explanation for the /parliaments/:id/discussion
// Wordfish prototype. Give it the JSON produced by body_discussion.ts (runs the
// scaling) and it renders three things:
//
//   1. a plain-language explanation of what the scaling is and its caveats,
//   2. a BEESWARM strip: each active member as a dot along the (standardized)
//      axis, with faint ±1·SE whiskers; extremes are labelled, everyone else is
//      on hover (197 labels would be unreadable), low-confidence members muted,
//   3. the WORDS AT EACH POLE (the axis is only meaningful once you read these),
//   4. a member table with the numbers.
//
// No chart library — hand-coded SVG in a fixed viewBox that scales to width,
// matching VotingChart.tsx. All copy runs through the `loc` map (t(key, fallback)).
//
// Reading guide, restated in the UI: the axis DIRECTION is arbitrary (Wordfish
// finds the split, not which side is "left"); `position` is standardized so the
// spread is a convention, not a real distance; and `std_error` is the honest
// uncertainty — wide bars / muted dots mean "don't over-read this person".

import * as React from "react";
import { useParams } from "react-router";
import { peopleHref } from "~/lib/urls/hrefs";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { InternalLink, makeT, SectionCardHeader } from "../opd_micros";
import { chartCtx } from "../_shared/chart_alt";
import { MethodologyLink } from "../_shared/MethodologyLink";
import { Icon } from "../../icons/opd_icons";

/* -------------------------------- data shape ------------------------------ */

export interface DiscussionPerson {
    person_id: number;
    name: string;
    party_key: string | null;
    party_label: string | null;
    position: number | null;
    std_error: number | null;
    n_speeches: number;
    n_words: number;
    date_from: string | null;
    date_to: string | null;
    below_floor: boolean;
    scored: boolean;
}

export interface DiscussionWord {
    word: string;
    beta: number;
    psi: number;
}

export interface DiscussionResult {
    body_id: number;
    window: { mode: string; months: number; start: string | null; as_of: string };
    params: {
        floor_words: number;
        min_doc_freq: number;
        min_total_count: number;
        stopwords: string | boolean;
    };
    fit: {
        converged: boolean;
        iterations: number;
        n_documents: number;
        vocab_size: number;
    };
    n_members: number;
    people: DiscussionPerson[];
    words: DiscussionWord[];
}

export interface BodyDiscussionProps {
    result: DiscussionResult;
    loc?: Record<string, string>;
    locale?: string;
}

/* --------------------------------- helpers -------------------------------- */

// Ordinal party palette + fallback come from the shared module so the
// discussion beeswarm matches the hemicycle and every other diagram.
import { NO_PARTY, assignPaletteByOrder } from "~/lib/export/colors";

interface PartyColors {
    colorOf: (p: { party_key: string | null }) => string;
    legend: { key: string; label: string; color: string }[];
}

function buildPartyColors(people: DiscussionPerson[]): PartyColors {
    const count = new Map<string, number>();
    const label = new Map<string, string>();
    for (const p of people) {
        const key = p.party_key ?? p.party_label ?? null;
        if (!key) continue;
        count.set(key, (count.get(key) ?? 0) + 1);
        if (!label.has(key)) label.set(key, p.party_label ?? p.party_key ?? "—");
    }
    const ordered = [...count.entries()].sort(
        (a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1),
    );
    const color = assignPaletteByOrder(ordered.map(([key]) => key));
    return {
        colorOf: (p) => {
            const key = p.party_key ?? null;
            return key ? color.get(key) ?? NO_PARTY : NO_PARTY;
        },
        legend: ordered.map(([key]) => ({
            key,
            label: label.get(key) ?? key,
            color: color.get(key) ?? NO_PARTY,
        })),
    };
}

/** Greedy beeswarm: place points along x, nudging them off the centre line only
 *  as far as needed to avoid overlap. Returns a y-offset (in px) per input. */
function beeswarmOffsets(xs: number[], r: number): number[] {
    const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const placed: { x: number; y: number }[] = [];
    const offset = new Array<number>(xs.length).fill(0);
    const step = r * 2 + 0.5;
    for (const [x, i] of order) {
        let y = 0;
        for (let k = 0; ; k++) {
            // try 0, +step, -step, +2step, -2step, …
            y = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * step;
            const clash = placed.some(
                (p) => Math.abs(p.x - x) < step && Math.abs(p.y - y) < step,
            );
            if (!clash) break;
        }
        placed.push({ x, y });
        offset[i] = y;
    }
    return offset;
}

function fmt(n: number, d = 2): string {
    return n.toFixed(d);
}

type SortKey = "person" | "party" | "position" | "words" | "speeches";

/** Sortable column header — same affordance as VotingChart's list. */
function Th({
    label,
    k,
    sort,
    onSort,
    align = "left",
}: {
    label: string;
    k: SortKey;
    sort: { key: SortKey; dir: "asc" | "desc" };
    onSort: (k: SortKey) => void;
    align?: "left" | "right";
}) {
    const active = sort.key === k;
    return (
        <th
            className={`px-2 py-2 font-medium ${align === "right" ? "text-right" : ""}`}
            aria-sort={
                active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
            }
        >
            <button
                type="button"
                onClick={() => onSort(k)}
                className={`inline-flex min-h-11 items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${align === "right" ? "flex-row-reverse" : ""
                    }`}
            >
                {label}
                <span className={active ? "text-foreground" : "opacity-30"}>
                    {active && sort.dir === "desc" ? "↓" : "↑"}
                </span>
            </button>
        </th>
    );
}

/* ------------------------------- component -------------------------------- */

export function BodyDiscussion({ result, loc, locale }: BodyDiscussionProps) {
    const t = makeT(loc);
    const nf = new Intl.NumberFormat(locale ?? "de-CH");
    const { lang } = useParams();
    const personHref = React.useCallback(
        (id: number) => peopleHref(lang, id),
        [lang],
    );

    const scored = React.useMemo(
        () =>
            result.people.filter((p) => p.position != null && p.std_error != null),
        [result.people],
    );

    const [hover, setHover] = React.useState<number | null>(null);
    const [reliableOnly, setReliableOnly] = React.useState(false);
    const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>(
        { key: "position", dir: "asc" },
    );
    const toggleSort = (key: SortKey) =>
        setSort((s) =>
            s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
        );

    const party = React.useMemo(
        () => buildPartyColors(result.people),
        [result.people],
    );

    // members shown in the plot + list (fit still used everyone; this is display).
    const visible = React.useMemo(
        () => (reliableOnly ? scored.filter((p) => !p.below_floor) : scored),
        [scored, reliableOnly],
    );

    // ---- party alignment: how much of the position spread does party explain? ----
    // eta^2 = between-party sum-of-squares / total sum-of-squares (0..1). 1 = parties
    // are perfectly separated on the axis; ~0 = party tells you nothing about position.
    const partyStats = React.useMemo(() => {
        const withParty = visible.filter((p) => p.party_key || p.party_label);
        const n = withParty.length;
        if (n < 2) return null;
        const xs = withParty.map((p) => p.position as number);
        const grand = xs.reduce((s, v) => s + v, 0) / n;
        const groups = new Map<
            string,
            { label: string; color: string; vals: number[] }
        >();
        for (const p of withParty) {
            const key = (p.party_key ?? p.party_label) as string;
            let g = groups.get(key);
            if (!g) {
                g = {
                    label: p.party_label ?? key,
                    color: party.colorOf(p),
                    vals: [],
                };
                groups.set(key, g);
            }
            g.vals.push(p.position as number);
        }
        let ssBetween = 0;
        let ssTotal = 0;
        for (const v of xs) ssTotal += (v - grand) * (v - grand);
        const rows = [...groups.values()].map((g) => {
            const mean = g.vals.reduce((s, v) => s + v, 0) / g.vals.length;
            ssBetween += g.vals.length * (mean - grand) * (mean - grand);
            return { label: g.label, color: g.color, mean, n: g.vals.length };
        });
        rows.sort((a, b) => a.mean - b.mean);
        const eta2 = ssTotal > 0 ? ssBetween / ssTotal : 0;
        return { eta2, rows, n };
    }, [visible, party]);

    // ---- axis scale: driven by POSITIONS, not the standard-error whiskers ----
    // (thin speakers can have enormous SEs; letting them set the scale squashes
    // everyone into the centre. Use a robust 2nd–98th percentile of positions.)
    const domain = React.useMemo(() => {
        const vals = visible
            .map((p) => p.position as number)
            .sort((a, b) => a - b);
        if (vals.length === 0) return [-1, 1] as const;
        const q = (f: number) => vals[Math.min(vals.length - 1, Math.max(0, Math.round(f * (vals.length - 1))))];
        let lo = q(0.02);
        let hi = q(0.98);
        if (hi - lo < 1e-6) {
            lo -= 1;
            hi += 1;
        }
        const pad = (hi - lo) * 0.08;
        return [lo - pad, hi + pad] as const;
    }, [visible]);

    // ---- SVG geometry (fixed viewBox, scales to width) ----
    const W = 720;
    const M = { top: 20, right: 24, bottom: 40, left: 24 };
    const plotW = W - M.left - M.right;
    const r = 3.5;
    const CAP_HALF = 120; // hard cap on the strip's half-height (keeps it on-screen)
    const xRaw = (v: number) =>
        M.left + ((v - domain[0]) / (domain[1] - domain[0])) * plotW;
    // clamp so out-of-range points (and whiskers) sit at the plot edge, never off it
    const x = (v: number) =>
        Math.max(M.left, Math.min(W - M.right, xRaw(v)));

    // beeswarm collisions in PIXEL space (previously mixed value-units with a pixel
    // step, so every point "collided" and stacked into one vertical column).
    const offsets = React.useMemo(() => {
        const px = visible.map((p) => x(p.position as number));
        const raw = beeswarmOffsets(px, r);
        const rawMax = raw.reduce((m, o) => Math.max(m, Math.abs(o)), 0);
        if (rawMax > CAP_HALF) {
            const s = CAP_HALF / rawMax;
            return raw.map((o) => o * s);
        }
        return raw;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, domain]);
    const maxOff = offsets.reduce((m, o) => Math.max(m, Math.abs(o)), 0);
    const midY = M.top + maxOff + r + 2;
    const H = midY + maxOff + r + M.bottom;

    // one geometry record per scored member, reused by the dots and the tooltip
    const pts = React.useMemo(
        () =>
            visible.map((p, i) => ({
                p,
                i,
                cx: x(p.position as number),
                cy: midY + offsets[i],
                muted: p.below_floor,
            })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [visible, offsets, midY],
    );
    const hoveredPt = hover != null ? pts.find((d) => d.p.person_id === hover) : null;

    // integer axis ticks across the domain
    const ticks: number[] = [];
    for (let v = Math.ceil(domain[0]); v <= Math.floor(domain[1]); v++) ticks.push(v);

    // ---- word poles (axis is only meaningful once you read these) ----
    const byBeta = React.useMemo(
        () => [...result.words].sort((a, b) => a.beta - b.beta),
        [result.words],
    );
    const negWords = byBeta.slice(0, 12); // one pole
    const posWords = byBeta.slice(-12).reverse(); // the other pole
    const maxAbsBeta =
        Math.max(
            Math.abs(negWords[0]?.beta ?? 0),
            Math.abs(posWords[0]?.beta ?? 0),
            1e-6,
        ) || 1;

    // extremes to label directly on the strip
    const sortedByPos = [...visible].sort(
        (a, b) => (a.position as number) - (b.position as number),
    );
    const labelled = new Set(
        [sortedByPos[0], sortedByPos[sortedByPos.length - 1]]
            .filter(Boolean)
            .map((p) => (p as DiscussionPerson).person_id),
    );

    const notConverged = !result.fit.converged;

    // rows for the list, ordered by the active sort (VotingChart-style)
    const sortedRows = React.useMemo(() => {
        const dir = sort.dir === "asc" ? 1 : -1;
        const rows = [...visible];
        rows.sort((a, b) => {
            switch (sort.key) {
                case "person":
                    return a.name.localeCompare(b.name) * dir;
                case "party":
                    return (a.party_label ?? "").localeCompare(b.party_label ?? "") * dir;
                case "words":
                    return (a.n_words - b.n_words) * dir;
                case "speeches":
                    return (a.n_speeches - b.n_speeches) * dir;
                case "position":
                default:
                    return ((a.position as number) - (b.position as number)) * dir;
            }
        });
        return rows;
    }, [visible, sort]);

    // No member could be placed on the axis. The scaling needs the actual TEXT of
    // members' speeches, and for most bodies the corpus has none (no speeches, or
    // speech records without transcripts) — so show a plain explanation instead of
    // an empty plot that reads as "broken". `n_members` distinguishes "nobody
    // spoke in this window" from "some spoke but there was too little text to fit".
    if (scored.length === 0) {
        return (
            <Card>
                <SectionCardHeader
                    icon="mic"
                    title={t("discussion_title")}
                    subtitle={t("discussion_intro")}
                />
                <CardContent>
                    <p className="py-12 text-center text-sm text-muted-foreground">
                        {result.n_members > 0
                            ? t("discussion_empty_sparse")
                            : t("discussion_empty")}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <SectionCardHeader
                icon="mic"
                title={t("discussion_title")}
                subtitle={t(
                    "discussion_intro",
                )}
            />

            <CardContent className="space-y-8">
                {/* ---- fit / provenance strip ---- */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span
                        className={
                            notConverged
                                ? "inline-flex items-center gap-1 font-medium text-destructive"
                                : "inline-flex items-center gap-1"
                        }
                    >
                        <Icon
                            name={notConverged ? "info" : "check"}
                            className="size-3.5"
                        />
                        {notConverged
                            ? t("discussion_not_converged")
                            : t("discussion_converged")}
                    </span>
                    <span>
                        {t("discussion_members_scored")}:{" "}
                        {nf.format(result.fit.n_documents)} / {nf.format(result.n_members)}
                    </span>
                    <span>
                        {t("discussion_vocab")}:{" "}
                        {nf.format(result.fit.vocab_size)}
                    </span>
                    <span>
                        {t("discussion_window")}: {result.window.start} →{" "}
                        {result.window.as_of}
                    </span>
                </div>

                {/* ---- reliable-only toggle (segmented control) ---- */}
                <div className="flex items-center justify-end">
                    <Segmented
                        size="sm"
                        value={reliableOnly ? "reliable" : "all"}
                        onValueChange={(v) => setReliableOnly(v === "reliable")}
                    >
                        <SegmentedItem value="all">{t("discussion_show_all")}</SegmentedItem>
                        <SegmentedItem value="reliable">{t("discussion_show_reliable")}</SegmentedItem>
                    </Segmented>
                </div>

                {/* ---- the beeswarm strip ---- */}
                <figure className="space-y-2">
                    <div className="relative">
                        <svg
                            viewBox={`0 0 ${W} ${H}`}
                            width="100%"
                            role="img"
                            aria-label={t("discussion_plot_alt", {
                                count: visible.length,
                                ctx: chartCtx(null, result.window.start, result.window.as_of),
                            })}
                            className="overflow-visible"
                        >
                            {/* baseline + ticks */}
                            <line
                                x1={M.left}
                                x2={W - M.right}
                                y1={midY}
                                y2={midY}
                                className="stroke-border"
                                strokeWidth={1}
                            />
                            {ticks.map((tk) => (
                                <g key={tk}>
                                    <line
                                        x1={x(tk)}
                                        x2={x(tk)}
                                        y1={midY - 4}
                                        y2={midY + 4}
                                        className="stroke-border"
                                        strokeWidth={1}
                                    />
                                    <text
                                        x={x(tk)}
                                        y={H - M.bottom + 24}
                                        textAnchor="middle"
                                        className="fill-muted-foreground text-[10px]"
                                    >
                                        {tk}
                                    </text>
                                </g>
                            ))}

                            {/* pole hints — direction is arbitrary, so we don't say left/right */}
                            <text
                                x={M.left}
                                y={H - M.bottom + 24}
                                textAnchor="start"
                                className="fill-muted-foreground text-[10px]"
                            >
                                ◀ {t("discussion_pole_a")}
                            </text>
                            <text
                                x={W - M.right}
                                y={H - M.bottom + 24}
                                textAnchor="end"
                                className="fill-muted-foreground text-[10px]"
                            >
                                {t("discussion_pole_b")} ▶
                            </text>

                            {/* points — styled like VotingChart seats: filled = confident,
                hollow ring = below the word floor (confidence reads by SHAPE,
                not opacity); active gets a foreground stroke. */}
                            {pts.map(({ p, i, cx, cy, muted }) => {
                                const se = p.std_error as number;
                                const isHover = hover === p.person_id;
                                const rr = isHover ? r + 1.5 : r;
                                const fill = party.colorOf(p);
                                return (
                                    <g
                                        key={p.person_id}
                                        className="cursor-pointer"
                                        onMouseEnter={() => setHover(p.person_id)}
                                        onMouseLeave={() =>
                                            setHover((h) => (h === p.person_id ? null : h))
                                        }
                                        onFocus={() => setHover(p.person_id)}
                                        onBlur={() => setHover((h) => (h === p.person_id ? null : h))}
                                        tabIndex={0}
                                    >
                                        {/* ±1 SE whisker — only for the hovered dot, so hundreds of
                      wide error bars don't weave into a grey background. */}
                                        {isHover && (
                                            <line
                                                x1={x((p.position as number) - se)}
                                                x2={x((p.position as number) + se)}
                                                y1={cy}
                                                y2={cy}
                                                stroke="var(--foreground, #111827)"
                                                strokeWidth={1.5}
                                                strokeOpacity={0.7}
                                            />
                                        )}
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={rr}
                                            fill={muted ? "transparent" : fill}
                                            stroke={
                                                isHover
                                                    ? "var(--foreground, #111827)"
                                                    : muted
                                                        ? fill
                                                        : "none"
                                            }
                                            strokeWidth={isHover ? 1.5 : muted ? 1.4 : 0}
                                            strokeOpacity={muted && !isHover ? 0.7 : 1}
                                        />
                                        {/* label only the two extremes; anchor inward so they don't clip */}
                                        {labelled.has(p.person_id) && !isHover && (
                                            <text
                                                x={cx}
                                                y={cy - (r + 6)}
                                                textAnchor={
                                                    cx < W / 2 ? "start" : "end"
                                                }
                                                className="fill-foreground text-[10px]"
                                            >
                                                {p.name}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>

                        {/* hover tooltip — name / party · position (mirrors VotingChart) */}
                        {hoveredPt ? (
                            <div
                                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[120%] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
                                style={{
                                    left: `${(hoveredPt.cx / W) * 100}%`,
                                    top: `${(hoveredPt.cy / H) * 100}%`,
                                }}
                            >
                                <div className="font-medium">{hoveredPt.p.name}</div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <span
                                        className="inline-block size-2 rounded-full"
                                        style={{ backgroundColor: party.colorOf(hoveredPt.p) }}
                                    />
                                    {hoveredPt.p.party_label ??
                                        t("discussion_no_party")}
                                    <span className="text-foreground">
                                        · {fmt(hoveredPt.p.position as number)} ±{" "}
                                        {fmt(hoveredPt.p.std_error as number)}
                                    </span>
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <figcaption className="space-y-2 text-xs text-muted-foreground">
                        <div>
                            {t(
                                "discussion_plot_caption",
                            )}
                        </div>

                        {/* party legend + confidence key — same layout as VotingChart */}
                        {party.legend.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                                <span>{t("discussion_col_party")}:</span>
                                {party.legend.map((l) => (
                                    <span key={l.key} className="inline-flex items-center gap-1.5">
                                        <span
                                            className="inline-block size-2.5 shrink-0 rounded-full"
                                            style={{ backgroundColor: l.color }}
                                        />
                                        {l.label}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* confidence key: filled = enough text, ring = below the word floor */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block size-2.5 shrink-0 rounded-full bg-muted-foreground" />
                                {t(
                                    "discussion_key_filled",
                                )}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block size-2.5 shrink-0 rounded-full border-[1.4px] border-muted-foreground bg-transparent" />
                                {t(
                                    "discussion_key_ring",
                                )}
                            </span>
                        </div>
                    </figcaption>
                </figure>

                {/* ---- party alignment: does the axis track party? ---- */}
                {partyStats && (
                    <section className="space-y-3">
                        <h3 className="text-sm font-medium">
                            {t("discussion_align_title")}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {t(
                                "discussion_align_hint",
                            )}
                        </p>

                        {/* the headline number + a qualitative reading */}
                        <div className="flex items-baseline gap-3">
                            <span className="text-2xl font-semibold tabular-nums">
                                {(partyStats.eta2 * 100).toFixed(0)}%
                            </span>
                            <span className="text-sm text-muted-foreground">
                                {partyStats.eta2 >= 0.6
                                    ? t("discussion_align_strong")
                                    : partyStats.eta2 >= 0.25
                                        ? t("discussion_align_moderate")
                                        : t("discussion_align_weak")}
                            </span>
                        </div>

                        {/* each party's mean position, on the same axis orientation */}
                        <ul className="space-y-1.5">
                            {partyStats.rows.map((row) => (
                                <li
                                    key={row.label}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <span
                                        className="inline-block size-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: row.color }}
                                    />
                                    <span className="w-48 shrink-0 truncate" title={row.label}>
                                        {row.label}
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">
                                        {fmt(row.mean)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        (n = {nf.format(row.n)})
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* ---- what the axis is made of ---- */}
                <section className="space-y-3">
                    <h3 className="text-sm font-medium">
                        {t("discussion_poles_title")}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {t(
                            "discussion_poles_hint",
                        )}
                    </p>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {[
                            { key: "a", label: t("discussion_pole_a"), words: negWords },
                            { key: "b", label: t("discussion_pole_b"), words: posWords },
                        ].map((pole) => (
                            <div key={pole.key} className="space-y-1.5">
                                <div className="text-xs font-medium text-muted-foreground">
                                    {pole.label}
                                </div>
                                {pole.words.map((w) => (
                                    <div key={w.word} className="flex items-center gap-2">
                                        <span className="w-28 shrink-0 truncate text-sm" title={w.word}>
                                            {w.word}
                                        </span>
                                        <span className="h-2 flex-1 rounded-full bg-muted">
                                            <span
                                                className="block h-full rounded-full bg-primary/70"
                                                style={{
                                                    width: `${Math.max(4, (Math.abs(w.beta) / maxAbsBeta) * 100)}%`,
                                                }}
                                            />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                {/* ---- member list (styled like the /votings/:id list) ---- */}
                <section className="space-y-2">
                    <h3 className="text-sm font-medium">
                        {t("discussion_table_title")}
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <caption className="sr-only">
                                {t("discussion_table_alt", {
                                    count: visible.length,
                                    ctx: chartCtx(null, result.window.start, result.window.as_of),
                                })}
                            </caption>
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <Th
                                        label={t("discussion_col_name")}
                                        k="person"
                                        sort={sort}
                                        onSort={toggleSort}
                                    />
                                    <Th
                                        label={t("discussion_col_party")}
                                        k="party"
                                        sort={sort}
                                        onSort={toggleSort}
                                    />
                                    <Th
                                        label={t("discussion_col_position")}
                                        k="position"
                                        sort={sort}
                                        onSort={toggleSort}
                                        align="right"
                                    />
                                    <th className="px-2 py-2 text-right font-medium">± SE</th>
                                    <Th
                                        label={t("discussion_col_words")}
                                        k="words"
                                        sort={sort}
                                        onSort={toggleSort}
                                        align="right"
                                    />
                                    <Th
                                        label={t("discussion_col_speeches")}
                                        k="speeches"
                                        sort={sort}
                                        onSort={toggleSort}
                                        align="right"
                                    />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRows.map((p) => (
                                    <tr
                                        key={p.person_id}
                                        className="border-b border-border/50 last:border-0"
                                        onMouseEnter={() => setHover(p.person_id)}
                                        onMouseLeave={() =>
                                            setHover((h) => (h === p.person_id ? null : h))
                                        }
                                    >
                                        <td className="px-2 py-1.5">
                                            <InternalLink to={personHref(p.person_id)}>
                                                {p.name}
                                            </InternalLink>
                                            {p.below_floor && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    {t("discussion_low_confidence")}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span
                                                    className="inline-block size-2.5 shrink-0 rounded-full"
                                                    style={{ backgroundColor: party.colorOf(p) }}
                                                />
                                                {p.party_label ?? "—"}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">
                                            {fmt(p.position as number)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                            {fmt(p.std_error as number)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">
                                            {nf.format(p.n_words)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">
                                            {nf.format(p.n_speeches)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* ---- how to read this ---- */}
                <section className="space-y-2 rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
                    <h3 className="text-sm font-medium text-foreground">
                        {t("discussion_read_title")}
                    </h3>
                    <p>
                        {t(
                            "discussion_read_direction",
                        )}
                    </p>
                    <p>
                        {t(
                            "discussion_read_uncertainty",
                        )}
                    </p>
                    <p>
                        {t(
                            "discussion_read_confound",
                        )}
                    </p>
                </section>

                {/* Methodology deep-link at the foot of the card (this view has no
                    attribution footer of its own to carry it). */}
                <div className="mt-4 flex justify-end border-t pt-3">
                    <MethodologyLink anchor="discussion" />
                </div>
            </CardContent>
        </Card>
    );
}

export default BodyDiscussion;