// VotingChart.tsx           → ~/components/opd_views/votings/VotingChart.tsx
//
// Visualization of a single voting. Two exports:
//
//   • <VotingHemicycle />  — the parliament arch ALONE (seats + party band +
//        parliamentary-group brackets/labels + colour-mode toggle + hover
//        tooltip + vote legend). Self-contained and presentational: pass it the
//        votes and it renders. Reuse it anywhere a seat map is wanted WITHOUT the
//        stats (e.g. a compact card, a person page, a comparison view).
//
//   • <VotingChart />      — the full panel: result summary (counts + %),
//        the hemicycle (via <VotingHemicycle/>), the vote-by-party bars, and the
//        sortable member list. Used on /votings/:id.
//
// Both receive the already-loaded votes via props (the /votings/:id loader runs
// voting_votes_by_id.sql). All visible labels come from the `loc` map; the second
// arg to t() is the English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import { peopleHref } from "~/lib/urls/hrefs";

import { Card, CardContent } from "@/components/ui/card";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { InternalLink, makeT, SectionCardHeader } from "../opd_micros";
import { MethodologyLink } from "../_shared/MethodologyLink";
import { ChartExportButton, ChartExportDialog, type ChartExportRenderCtx } from "../_shared/ChartExport";
import { excerpt } from "~/lib/std/strings";

/** Base URL for the person pages seats link to in an interactive export. */
const PERSON_EXPORT_BASE = "https://parlhub.com/people/";

/* -------------------------------- data shape ------------------------------ */

export interface VotingChartVote {
    person_id?: number | null;
    fullname?: string | null;
    /** raw vote token (e.g. "yes" | "no" | "abstention" | "absent" | …) */
    vote?: string | null;
    /** localized vote label */
    vote_display?: string | null;
    /** localized party label (display) */
    party?: string | null;
    /** stable, language-independent party key (colour map key) */
    party_key?: string | null;
    parliamentary_group?: string | null;
    parliament_seat?: number | null;
    /** chamber sector/section (currently unused for ordering; kept for callers) */
    parliament_sector?: string | null;
}

/* ------------------------------- colour map ------------------------------- */

// Ordinal party palette + fallbacks now live in one place (see the module
// comment). Re-exported here so existing importers of PALETTE keep working.
export { PALETTE } from "~/lib/export/colors";
import { EMPTY_SEAT, NO_PARTY, assignPaletteByOrder } from "~/lib/export/colors";

/** Pure default party colour map: distinct parties ordered by member count
 *  (codepoint tiebreak = SSR-stable), each assigned a palette colour. Used as the
 *  baseline the editor lets users override. */
export function buildColorMap(votes: VotingChartVote[]) {
    const counts = new Map<string, { label: string; count: number }>();
    for (const v of votes) {
        const key = v.party_key ?? v.party ?? "—";
        const label = v.party ?? v.party_key ?? "—";
        const cur = counts.get(key);
        if (cur) cur.count++;
        else counts.set(key, { label, count: 1 });
    }
    const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
    const ordered = [...counts.entries()].sort(
        (a, b) => b[1].count - a[1].count || cmpStr(a[1].label, b[1].label) || cmpStr(a[0], b[0]),
    );
    const color = assignPaletteByOrder(ordered.map(([key]) => key));
    const colorOf = (v: VotingChartVote) => {
        const key = v.party_key ?? v.party ?? null;
        return key ? color.get(key) ?? NO_PARTY : NO_PARTY;
    };
    const legend = ordered.map(([key, info]) => ({
        key,
        label: info.label,
        count: info.count,
        color: color.get(key) ?? NO_PARTY,
    }));
    return { colorOf, legend };
}

function useColorMap(votes: VotingChartVote[]) {
    return React.useMemo(() => buildColorMap(votes), [votes]);
}

/* ------------------------------ vote outcomes ----------------------------- */

// Calm, limited outcome palette. yes/no stay green/red (the established vote
// convention) but muted; absent is a light neutral so non-votes recede. The raw
// `vote` token is normalized to one of these keys (language-tolerant); unknown
// tokens fall through to "other". `vote_display` supplies the legend label.
// Vote-outcome palette now lives in ~/lib/export/colors (re-exported so
// existing importers of outcomeColor keep working).
export { outcomeColor } from "~/lib/export/colors";
import { outcomeColor } from "~/lib/export/colors";
const OUTCOME_ORDER = ["yes", "no", "abstention", "absent", "president", "other"];
/** Order for the result summary (Yes · Abstain · No · …), matching convention. */
const STAT_ORDER = ["yes", "abstention", "no", "absent", "president", "other"];

export function outcomeKey(raw?: string | null): string {
    const v = (raw ?? "").toLowerCase().trim();
    if (!v) return "other";
    if (v.includes("abst") || v.includes("enthalt")) return "abstention";
    if (
        v.includes("absent") || v.includes("excus") || v.includes("entschuld") ||
        v.includes("notvot") || v.includes("hasnot") || v.includes("nonpart") ||
        v.includes("not_part") || v.includes("no_part")
    )
        return "absent";
    if (v.includes("yes") || v === "ja" || v.includes("oui") || v === "si" || v === "sì")
        return "yes";
    if (v === "no" || v.includes("nein") || v === "non") return "no";
    if (v.includes("presid") || v.includes("präsid")) return "president";
    return "other";
}

/** Outcome keys present in the data (canonical order) + their display labels. */
export function summarizeOutcomes(votes: VotingChartVote[]) {
    const outcomeLabel: Record<string, string> = {};
    for (const v of votes) {
        const k = outcomeKey(v.vote);
        if (!(k in outcomeLabel)) outcomeLabel[k] = v.vote_display ?? v.vote ?? k;
    }
    const presentOutcomes = OUTCOME_ORDER.filter((k) => k in outcomeLabel).concat(
        Object.keys(outcomeLabel).filter((k) => !OUTCOME_ORDER.includes(k)),
    );
    return { presentOutcomes, outcomeLabel };
}

/* ------------------------------- seat marker ------------------------------ */

// Dual-encodable seat. The CALLER picks the primary hue via `fill` (vote outcome
// in "Vote" mode, party in "Party" mode). `dotColor` is an optional inner dot —
// used in Party mode to carry the vote outcome ON TOP of a party-coloured seat;
// a white halo keeps it legible even when the two hues are close. `hollow` draws
// an open ring (no fill) for absent / non-voting, so absence reads by SHAPE, not
// colour alone (accessible / colour-blind safe).
function SeatMark({
    fill,
    dotColor = null,
    hollow = false,
    x,
    y,
    r,
    active,
    interactive,
    onEnter,
    onLeave,
    title,
    pid = null,
}: {
    fill: string;
    dotColor?: string | null;
    hollow?: boolean;
    x: number;
    y: number;
    r: number;
    active: boolean;
    interactive: boolean;
    onEnter?: (() => void) | undefined;
    onLeave?: (() => void) | undefined;
    title?: string | undefined;
    /** person id, emitted as data-pid so an export can wrap the seat in a link */
    pid?: number | null;
}) {
    const rr = active ? r + 1.5 : r;
    return (
        <g
            className={interactive ? "cursor-pointer" : ""}
            data-pid={pid ?? undefined}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onFocus={onEnter}
            onBlur={onLeave}
            tabIndex={interactive ? 0 : -1}
        >
            <circle
                cx={x}
                cy={y}
                r={rr}
                fill={hollow ? "transparent" : fill}
                stroke={active ? "var(--foreground, #111827)" : hollow ? fill : "none"}
                strokeWidth={active ? 1.5 : hollow ? 1.4 : 0}
                strokeOpacity={hollow ? 0.6 : 1}
            />
            {dotColor ? (
                <circle
                    cx={x}
                    cy={y}
                    r={round2(Math.max(1, rr * 0.5))}
                    fill={dotColor}
                    stroke="var(--card, #ffffff)"
                    strokeWidth={0.5}
                />
            ) : null}
            {title ? <title>{title}</title> : null}
        </g>
    );
}

/** Mini legend marker: a filled vote-colour dot, or a faded open ring for absent. */
function OutcomeGlyph({ outcome }: { outcome: string }) {
    const r = 4.5;
    if (outcome === "absent") {
        return (
            <svg
                width="13"
                height="13"
                viewBox="-7 -7 14 14"
                aria-hidden="true"
                className="text-muted-foreground"
            >
                <circle cx={0} cy={0} r={r} fill="none" stroke="currentColor" strokeWidth={1.4} strokeOpacity={0.6} />
            </svg>
        );
    }
    return (
        <svg width="13" height="13" viewBox="-7 -7 14 14" aria-hidden="true">
            <circle cx={0} cy={0} r={r} fill={outcomeColor(outcome)} />
        </svg>
    );
}

/* ----------------------------- hemicycle math ----------------------------- */

/** Deterministic 2-dp round — pins SVG coordinates identically on server/client. */
const round2 = (v: number) => Math.round(v * 100) / 100;

/** viewBox margin around the arch, reserving room for the party band and the
 *  parliamentary-group brackets + (truncated) labels drawn outside the seats. */
const HEMI_MARGIN = 120;

/** Group labels are truncated to this many chars (full name shown on hover) so
 *  long names don't run off the side of the viewBox. */
const GROUP_LABEL_MAX = 22;

//const truncate = (s: string, max = GROUP_LABEL_MAX) =>
//  s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;

interface Seat {
    x: number;
    y: number;
    row: number;
    angle: number;
}
interface Hemicycle {
    seats: Seat[];
    rows: number;
    width: number;
    height: number;
    seatR: number;
    cx: number;
    baseY: number;
    rOuter: number;
}

function computeHemicycle(
    N: number,
    width = 800,
    innerRatio = 0.4,
    outerMargin = 40,
): Hemicycle {
    const height = width / 2 + 24;
    const cx = width / 2;
    const baseY = width / 2;
    const rOuter = width / 2 - outerMargin;
    if (!N || N < 1)
        return { seats: [], rows: 0, width, height, seatR: 6, cx, baseY, rOuter };
    const rInner = rOuter * innerRatio;

    const radiusOf = (i: number, R: number) =>
        R === 1 ? (rInner + rOuter) / 2 : rInner + (rOuter - rInner) * (i / (R - 1));

    const capacityFor = (R: number) => {
        let cap = 0;
        for (let i = 0; i < R; i++) {
            const radius = radiusOf(i, R);
            const pitch = (rOuter - rInner) / Math.max(R, 1) || rOuter * 0.5;
            cap += Math.max(1, Math.floor((Math.PI * radius) / Math.max(pitch, 1)) + 1);
        }
        return cap;
    };

    let rows = 1;
    while (capacityFor(rows) < N && rows < 60) rows++;

    const radii: number[] = [];
    for (let i = 0; i < rows; i++) radii.push(radiusOf(i, rows));

    // largest-remainder allocation of N across rings, weighted by ring radius
    const wsum = radii.reduce((a, b) => a + b, 0);
    const raw = radii.map((w) => (N * w) / wsum);
    const base = raw.map((v) => Math.floor(v));
    let used = base.reduce((a, b) => a + b, 0);
    const order = raw
        .map((v, i) => ({ i, frac: v - base[i] }))
        .sort((a, b) => b.frac - a.frac);
    let k = 0;
    while (used < N) {
        base[order[k % rows].i]++;
        used++;
        k++;
    }

    const seats: Seat[] = [];
    for (let i = 0; i < rows; i++) {
        const count = base[i];
        const radius = radii[i];
        for (let s = 0; s < count; s++) {
            const tt = count === 1 ? 0.5 : s / (count - 1);
            const angle = Math.PI - tt * Math.PI;
            // Round to 2 dp: Math.sin/cos precision is implementation-defined, so the
            // server (Node) and client (browser) can otherwise emit slightly different
            // float strings for cx/cy → SVG hydration mismatch. Rounding pins them.
            seats.push({
                x: round2(cx + radius * Math.cos(angle)),
                y: round2(baseY - radius * Math.sin(angle)),
                row: i,
                angle,
            });
        }
    }
    // global order left → right (angle desc), back ring first on ties
    seats.sort((a, b) => (a.angle === b.angle ? a.row - b.row : b.angle - a.angle));

    const ringPitch = rows > 1 ? (rOuter - rInner) / (rows - 1) : rOuter * 0.5;
    const seatR = round2(Math.max(2.5, Math.min(9, ringPitch * 0.42)));
    return { seats, rows, width, height, seatR, cx, baseY, rOuter };
}

/* ---- arc helpers (concentric with the seat arch; angle π=left → 0=right) ---- */

/** Point on the arch circle at angle a, radius r. */
const ptOn = (cx: number, baseY: number, r: number, a: number): [number, number] => [
    round2(cx + r * Math.cos(a)),
    round2(baseY - r * Math.sin(a)),
];

/** SVG arc path from angle aStart down to aEnd (aStart > aEnd) at radius r. */
function arcPath(cx: number, baseY: number, r: number, aStart: number, aEnd: number): string {
    const [x0, y0] = ptOn(cx, baseY, r, aStart);
    const [x1, y1] = ptOn(cx, baseY, r, aEnd);
    const large = Math.abs(aStart - aEnd) > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/* =========================================================================
 * <VotingHemicycle /> — the parliament arch alone (reusable without the stats)
 * ========================================================================= */

/** User-editable overrides for the arch (colours, labels, ordering). All keyed
 *  by the same `party_key`/group name the data carries. Missing entries fall back
 *  to the defaults (palette by size; data labels; size ordering). */
export interface ParliamentConfig {
    /** party_key → colour (hex). */
    partyColors?: Record<string, string>;
    /** party_key → display label. */
    partyLabels?: Record<string, string>;
    /** party_keys in left→right order (partial lists are fine; the rest follow by size). */
    partyOrder?: string[];
    /** group name → colour (hex) — colours the group bracket line. */
    groupColors?: Record<string, string>;
    /** group name → display label. */
    groupLabels?: Record<string, string>;
    /** group names in left→right order (partial lists are fine). */
    groupOrder?: string[];
}

export interface VotingHemicycleProps {
    votes: VotingChartVote[];
    /** Total seats of the voting body (bodies.legislative_seats) — hemicycle size. */
    legislativeSeats?: number | null | undefined;
    loc?: Record<string, string> | undefined;
    locale?: string | undefined;
    className?: string | undefined;
    /** Colour / label / order overrides (from the editor). */
    config?: ParliamentConfig | undefined;
    /** When false, seats don't respond to hover and aren't focusable/linked. Default true. */
    interactive?: boolean | undefined;
    /** When interactive, wrap each seat in a link to this href (e.g. a person page). */
    seatHref?: ((v: VotingChartVote) => string | null | undefined) | undefined;
    /** Hide the Vote/Party colour-mode switch (e.g. in a locked export preview). */
    hideColorToggle?: boolean | undefined;
    /** Force light/dark colours (used by the editor preview + export). When unset,
     *  the component follows the app theme. */
    theme?: "light" | "dark" | undefined;
    /** Voting title — shown above the arch when showTitle is on. */
    title?: string | null | undefined;
    /** Affair title — shown above the arch when showAffairTitle is on. */
    affairTitle?: string | null | undefined;
    /** Body / chamber title — shown above the arch when showBodyTitle is on. */
    bodyTitle?: string | null | undefined;
    showTitle?: boolean | undefined;
    showAffairTitle?: boolean | undefined;
    showBodyTitle?: boolean | undefined;
    /** Show vote counts inside the arch. */
    showCounts?: boolean | undefined;
    /** Show vote percentages inside the arch. */
    showPercent?: boolean | undefined;
    /** Draw the party colour band around the arch ("parliament line"). Default true. */
    showPartyBand?: boolean | undefined;
    /** Draw the parliamentary-group bracket lines + labels. Default true. */
    showGroupLine?: boolean | undefined;
    /** Render the arch even when <80% of voters have a parliament_seat. The editor
     *  sets this so a graphic can still be exported (it already discloses that the
     *  arrangement is by group/party, not true physical seats). Default false. */
    forceHemicycle?: boolean | undefined;
}

/** Explicit tooltip colours for when a fixed theme is requested (so the popup
 *  matches the chosen light/dark). Text vs background meets WCAG AAA (≥7:1). */
const TOOLTIP_THEME = {
    light: { bg: "#ffffff", fg: "#111827", border: "#cbd5e1", muted: "#334155" },
    dark: { bg: "#18181b", fg: "#f4f4f5", border: "#3f3f46", muted: "#cbd5e1" },
} as const;

export function VotingHemicycle({
    votes,
    legislativeSeats,
    loc = {},
    locale = "de-CH",
    className,
    config,
    interactive = true,
    seatHref,
    hideColorToggle = false,
    theme,
    title,
    affairTitle,
    bodyTitle,
    showTitle = false,
    showAffairTitle = false,
    showBodyTitle = false,
    showCounts = false,
    showPercent = false,
    showPartyBand = true,
    showGroupLine = true,
    forceHemicycle = false,
}: VotingHemicycleProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const { colorOf: baseColorOf, legend } = useColorMap(votes);

    // Resolve overrides: colour by party_key (else palette default); display label
    // for parties/groups; left→right order indices for parties/groups.
    const colorOf = React.useCallback(
        (v: VotingChartVote) => {
            const key = v.party_key ?? v.party ?? "—";
            return config?.partyColors?.[key] ?? baseColorOf(v);
        },
        [config, baseColorOf],
    );
    const partyLabelOf = React.useCallback(
        (v: VotingChartVote) => {
            const key = v.party_key ?? v.party ?? "—";
            return config?.partyLabels?.[key] ?? v.party ?? key;
        },
        [config],
    );
    const groupLabelOf = React.useCallback(
        (g: string) => config?.groupLabels?.[g] ?? g,
        [config],
    );
    // explicit-order index maps (entries not listed fall back after, by size)
    const partyOrderIndex = React.useMemo(
        () => new Map((config?.partyOrder ?? []).map((k, i) => [k, i] as const)),
        [config],
    );
    const groupOrderIndex = React.useMemo(
        () => new Map((config?.groupOrder ?? []).map((g, i) => [g, i] as const)),
        [config],
    );

    const [hovered, setHovered] = React.useState<number | null>(null);
    // Which dimension drives the seat hue. Default "vote" (clean single-hue view);
    // "party" colours seats by party and rides the vote along as an inner dot.
    // Default is identical on server + client → no hydration mismatch.
    const [colorMode, setColorMode] = React.useState<"vote" | "party">("vote");

    // Does the data actually carry votes? When it doesn't (e.g. a body's member
    // roster passed in to show the chamber by party), we colour by party, hide the
    // Vote/Party switch, and suppress all vote-specific UI.
    const hasVotes = React.useMemo(
        () => votes.some((v) => (v.vote ?? "").trim() !== ""),
        [votes],
    );
    const mode: "vote" | "party" = hasVotes ? colorMode : "party";

    // Does the data carry parliamentary groups? (≥80% of voters have one.)
    const usingGroups =
        votes.length > 0 &&
        votes.filter((v) => v.parliamentary_group != null).length / votes.length >= 0.8;

    const orderedVoters = React.useMemo(() => {
        const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
        const seatOf = (v: VotingChartVote) =>
            v.parliament_seat ?? Number.MAX_SAFE_INTEGER;
        // base party order by size, then apply explicit overrides on top (listed
        // parties first in the chosen order, the rest after in size order).
        const sizeIndex = new Map(legend.map((p, i) => [p.key, i] as const));
        const partyRank = (v: VotingChartVote) => {
            const key = v.party_key ?? v.party ?? "—";
            const o = partyOrderIndex.get(key);
            return o != null
                ? o
                : (config?.partyOrder?.length ?? 0) + (sizeIndex.get(key) ?? 9999);
        };

        // group ordering by size desc, then explicit overrides on top
        const groupCount = new Map<string, number>();
        for (const v of votes) {
            const g = v.parliamentary_group;
            if (g) groupCount.set(g, (groupCount.get(g) ?? 0) + 1);
        }
        const groupSizeIndex = new Map(
            [...groupCount.entries()]
                .sort((a, b) => b[1] - a[1] || cmpStr(a[0], b[0]))
                .map(([g], i) => [g, i] as const),
        );
        const grpRank = (v: VotingChartVote) => {
            const g = v.parliamentary_group;
            if (g == null) return Number.MAX_SAFE_INTEGER;
            const o = groupOrderIndex.get(g);
            return o != null
                ? o
                : (config?.groupOrder?.length ?? 0) + (groupSizeIndex.get(g) ?? 9999);
        };

        // Left → right: [group →] party → seat number → name. Codepoint tiebreaks = SSR-stable.
        return votes.slice().sort((a, b) => {
            if (usingGroups) {
                const ga = grpRank(a),
                    gb = grpRank(b);
                if (ga !== gb) return ga - gb;
            }
            const pa = partyRank(a),
                pb = partyRank(b);
            if (pa !== pb) return pa - pb;
            const sa = seatOf(a),
                sb = seatOf(b);
            if (sa !== sb) return sa - sb;
            return cmpStr(a.fullname ?? "", b.fullname ?? "");
        });
    }, [votes, legend, usingGroups, partyOrderIndex, groupOrderIndex, config]);

    const { presentOutcomes, outcomeLabel } = React.useMemo(
        () => summarizeOutcomes(votes),
        [votes],
    );
    const total = votes.length;
    const outcomeCounts = React.useMemo(() => {
        const m: Record<string, number> = {};
        for (const v of votes) {
            const k = outcomeKey(v.vote);
            m[k] = (m[k] ?? 0) + 1;
        }
        return m;
    }, [votes]);

    // Show the arch only when seat positions are well-populated: ≥80% of voters
    // must have a parliament_seat, otherwise the arch would be misleading.
    const seatCoverage =
        votes.length > 0
            ? votes.filter((v) => v.parliament_seat != null).length / votes.length
            : 0;
    const N = (legislativeSeats ?? 0) > 0 ? legislativeSeats! : orderedVoters.length;
    const showHemicycle =
        N > 0 && orderedVoters.length > 0 && (forceHemicycle || seatCoverage >= 0.8);
    const hemi = React.useMemo(
        () => (showHemicycle ? computeHemicycle(N) : null),
        [showHemicycle, N],
    );

    // Contiguous party / group runs along the arch → arc spans for the party band
    // and the group brackets+labels. seats are sorted by angle (π→0), so a run of
    // consecutive ordered voters occupies a contiguous angle range; the boundary
    // between runs is the midpoint of the two edge seats' angles.
    const arcRuns = React.useMemo(() => {
        if (!hemi || hemi.seats.length === 0) return null;
        const V = Math.min(orderedVoters.length, hemi.seats.length);
        if (V === 0) return null;
        const boundary = (idx: number) =>
            idx <= 0
                ? Math.PI
                : idx >= V
                    ? 0
                    : (hemi.seats[idx - 1].angle + hemi.seats[idx].angle) / 2;
        const buildRuns = (keyOf: (v: VotingChartVote) => string | null) => {
            const runs: { a: number; b: number }[] = [];
            let start = 0;
            for (let i = 1; i <= V; i++) {
                if (i === V || keyOf(orderedVoters[i]) !== keyOf(orderedVoters[start])) {
                    runs.push({ a: start, b: i - 1 });
                    start = i;
                }
            }
            return runs.map((r) => {
                const aStart = boundary(r.a);
                const aEnd = boundary(r.b + 1);
                return { ...r, aStart, aEnd, mid: (aStart + aEnd) / 2, span: aStart - aEnd };
            });
        };
        const partyRuns = buildRuns((v) => v.party_key ?? v.party ?? "—").map((r) => ({
            ...r,
            color: colorOf(orderedVoters[r.a]),
        }));
        const groupRuns = buildRuns((v) => v.parliamentary_group ?? null)
            .filter((r) => orderedVoters[r.a].parliamentary_group != null)
            .map((r) => {
                const g = orderedVoters[r.a].parliamentary_group as string;
                return { ...r, group: g, label: groupLabelOf(g), color: config?.groupColors?.[g] };
            });
        return { partyRuns, groupRuns };
    }, [hemi, orderedVoters, colorOf, groupLabelOf, config]);

    const hoveredVoter = hovered != null ? orderedVoters[hovered] : null;
    const hoveredSeat = hovered != null && hemi ? hemi.seats[hovered] : null;

    // Text alternative for the seat map. The tally IS the chart's content, so it
    // goes in the label: without it the arch is unreadable to a screen reader
    // (the vote list below is the long alternative, this is the summary). Outcome
    // names come from the data (`vote_display`), so nothing here needs a loc key.
    const hemicycleAlt = t("voting_chart_alt", {
        count: total,
        mode: mode === "party" ? t("voting_chart_col_party") : t("voting_chart_col_vote"),
        summary: presentOutcomes
            .map((k) => `${outcomeLabel[k]}: ${outcomeCounts[k] ?? 0}`)
            .join(", "),
    });

    if (!hemi) {
        return (
            <div className={className}>
                <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
                    {t("voting_chart_no_seatmap")}
                </p>
            </div>
        );
    }

    return (
        <div className={["space-y-2", className].filter(Boolean).join(" ")}>
            {/* accessible colour-mode switch (Vote ↔ Party) — only when votes exist */}
            {hideColorToggle || !hasVotes ? null : (
                <div className="flex items-center justify-end gap-2 text-xs">
                    <span className="text-muted-foreground">
                        {t("voting_chart_colour_by")}:
                    </span>
                    <Segmented
                        size="sm"
                        aria-label={t("voting_chart_colour_by")}
                        value={colorMode}
                        onValueChange={(m) => setColorMode(m as "vote" | "party")}
                    >
                        <SegmentedItem value="vote">{t("voting_chart_col_vote")}</SegmentedItem>
                        <SegmentedItem value="party">{t("voting_chart_col_party")}</SegmentedItem>
                    </Segmented>
                </div>
            )}

            <div className="relative w-full">
                <svg
                    viewBox={`${-HEMI_MARGIN} ${-HEMI_MARGIN} ${hemi.width + 2 * HEMI_MARGIN} ${hemi.baseY + HEMI_MARGIN + 16}`}
                    className="h-auto w-full"
                    role="img"
                    aria-label={hemicycleAlt}
                >
                    {hemi.seats.map((seat, i) => {
                        const voter = orderedVoters[i]; // seats beyond the voters are empty
                        const oKey =
                            voter && (voter.vote ?? "").trim() !== "" ? outcomeKey(voter.vote) : null;
                        const absent = oKey === "absent";
                        const active = hovered === i;
                        const vlabel = voter ? voter.vote_display ?? voter.vote : null;
                        // Vote mode → fill = outcome. Party mode → fill = party, vote rides
                        // along as an inner dot (omitted for absent / no-vote, a hollow ring
                        // either way).
                        const fill = !voter
                            ? EMPTY_SEAT
                            : mode === "party"
                                ? colorOf(voter)
                                : outcomeColor(oKey ?? "other");
                        const dotColor =
                            voter && mode === "party" && oKey && !absent
                                ? outcomeColor(oKey)
                                : null;
                        const canHover = interactive && !!voter;
                        const href = canHover && seatHref ? seatHref(voter) : null;
                        const mark = (
                            <SeatMark
                                fill={fill}
                                dotColor={dotColor}
                                hollow={!!voter && absent}
                                x={seat.x}
                                y={seat.y}
                                r={hemi.seatR}
                                active={active}
                                interactive={canHover}
                                pid={voter?.person_id ?? null}
                                onEnter={canHover ? () => setHovered(i) : undefined}
                                onLeave={canHover ? () => setHovered((h) => (h === i ? null : h)) : undefined}
                                title={
                                    voter
                                        ? `${voter.fullname ?? "—"}${voter.party ? ` · ${partyLabelOf(voter)}` : ""}${vlabel ? ` · ${vlabel}` : ""}`
                                        : undefined
                                }
                            />
                        );
                        return href ? (
                            <a key={i} href={href} target="_blank" rel="noopener noreferrer">
                                {mark}
                            </a>
                        ) : (
                            <React.Fragment key={i}>{mark}</React.Fragment>
                        );
                    })}

                    {/* party arc band ("arc band = party") — the "parliament line" */}
                    {showPartyBand
                        ? arcRuns?.partyRuns.map((r, i) => (
                            <path
                                key={`pb-${i}`}
                                d={arcPath(hemi.cx, hemi.baseY, hemi.rOuter + hemi.seatR + 22, r.aStart, r.aEnd)}
                                fill="none"
                                stroke={r.color}
                                strokeWidth={6}
                            />
                        ))
                        : null}

                    {/* parliamentary-group brackets + labels (when groups present) */}
                    {usingGroups && showGroupLine
                        ? arcRuns?.groupRuns.map((r, i) => {
                            const [lx, ly] = ptOn(
                                hemi.cx,
                                hemi.baseY,
                                hemi.rOuter + hemi.seatR + 46,
                                r.mid,
                            );
                            const anchor =
                                r.mid > Math.PI / 2 + 0.12
                                    ? "end"
                                    : r.mid < Math.PI / 2 - 0.12
                                        ? "start"
                                        : "middle";
                            return (
                                <g key={`gb-${i}`}>
                                    <path
                                        d={arcPath(
                                            hemi.cx,
                                            hemi.baseY,
                                            hemi.rOuter + hemi.seatR + 34,
                                            r.aStart,
                                            r.aEnd,
                                        )}
                                        fill="none"
                                        stroke={r.color ?? "var(--border, #cbd5e1)"}
                                        strokeWidth={1.25}
                                    />
                                    {r.span > 0.14 ? (
                                        <text
                                            x={lx}
                                            y={ly}
                                            textAnchor={anchor}
                                            dominantBaseline="middle"
                                            fontSize="10"
                                            fill="var(--muted-foreground, #334155)"
                                        >
                                            {excerpt(r.label, GROUP_LABEL_MAX)}
                                            <title>{r.label}</title>
                                        </text>
                                    ) : null}
                                </g>
                            );
                        })
                        : null}

                    {/* top: optional vote / affair titles (above the arch) */}
                    {(() => {
                        const lines: { text: string; fill: string; weight?: number; size: number }[] = [];
                        if (showBodyTitle && bodyTitle)
                            lines.push({
                                text: bodyTitle,
                                fill: "var(--foreground, #111827)",
                                weight: 600,
                                size: 15,
                            });
                        if (showTitle && title)
                            lines.push({
                                text: title,
                                fill: "var(--foreground, #111827)",
                                weight: 600,
                                size: 15,
                            });
                        if (showAffairTitle && affairTitle)
                            lines.push({
                                text: affairTitle,
                                fill: "var(--muted-foreground, #334155)",
                                size: 12,
                            });
                        if (lines.length === 0) return null;
                        const lineH = 19;
                        const startY = -HEMI_MARGIN + 24;
                        return (
                            <g>
                                {lines.map((ln, i) => (
                                    <text
                                        key={i}
                                        x={hemi.cx}
                                        y={startY + i * lineH}
                                        textAnchor="middle"
                                        fontSize={ln.size}
                                        fontWeight={ln.weight ?? 400}
                                        fill={ln.fill}
                                    >
                                        {ln.text}
                                    </text>
                                ))}
                            </g>
                        );
                    })()}

                    {/* centre: optional vote counts + % (inside the arch).
              Text uses the theme foreground (WCAG AAA contrast); the outcome
              colour is carried by a small leading dot rather than the text. */}
                    {(showCounts || showPercent) && hasVotes
                        ? (() => {
                            const lines: { text: string; dot: string }[] = [];
                            for (const k of STAT_ORDER) {
                                const n = outcomeCounts[k];
                                if (!n) continue;
                                const pct = total ? Math.round((n / total) * 100) : 0;
                                const parts = [outcomeLabel[k] ?? k];
                                if (showCounts) parts.push(String(n));
                                if (showPercent) parts.push(`${pct}%`);
                                lines.push({ text: parts.join("  "), dot: outcomeColor(k) });
                            }
                            if (lines.length === 0) return null;
                            const lineH = 18;
                            return (
                                <g>
                                    {lines.map((ln, i) => (
                                        <text
                                            key={i}
                                            x={hemi.cx}
                                            y={hemi.baseY - 14 - (lines.length - 1 - i) * lineH}
                                            textAnchor="middle"
                                            fontSize={12}
                                            fill="var(--foreground, #111827)"
                                        >
                                            <tspan fill={ln.dot}>● </tspan>
                                            {ln.text}
                                        </text>
                                    ))}
                                </g>
                            );
                        })()
                        : null}
                </svg>

                {/* hover tooltip — name · party · vote */}
                {hoveredVoter && hoveredSeat ? (
                    <div
                        className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[120%] rounded-md border px-2.5 py-1.5 text-xs shadow-md ${theme ? "" : "border-border bg-popover text-popover-foreground"
                            }`}
                        style={{
                            left: `${((hoveredSeat.x + HEMI_MARGIN) / (hemi.width + 2 * HEMI_MARGIN)) * 100}%`,
                            top: `${((hoveredSeat.y + HEMI_MARGIN) / (hemi.baseY + HEMI_MARGIN + 16)) * 100}%`,
                            ...(theme
                                ? {
                                    backgroundColor: TOOLTIP_THEME[theme].bg,
                                    color: TOOLTIP_THEME[theme].fg,
                                    borderColor: TOOLTIP_THEME[theme].border,
                                }
                                : null),
                        }}
                    >
                        <div className="font-medium">{hoveredVoter.fullname ?? "—"}</div>
                        <div
                            className={`flex items-center gap-1.5 ${theme ? "" : "text-muted-foreground"}`}
                            style={theme ? { color: TOOLTIP_THEME[theme].muted } : undefined}
                        >
                            <span
                                className="inline-block size-2 rounded-full"
                                style={{ backgroundColor: colorOf(hoveredVoter) }}
                            />
                            {partyLabelOf(hoveredVoter)}
                            {hoveredVoter.vote_display ?? hoveredVoter.vote ? (
                                <span style={theme ? { color: TOOLTIP_THEME[theme].fg } : undefined} className={theme ? "" : "text-foreground"}>
                                    · {hoveredVoter.vote_display ?? hoveredVoter.vote}
                                </span>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                {/* legends — horizontal, left-aligned, wrap when a row gets long */}
                <div className="mt-2 flex flex-col gap-2">
                    {mode === "party" && legend.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{t("voting_chart_col_party")}:</span>
                            {legend.map((p) => (
                                <span key={p.key} className="inline-flex items-center gap-1.5">
                                    <span
                                        className="inline-block size-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: config?.partyColors?.[p.key] ?? p.color }}
                                    />
                                    {config?.partyLabels?.[p.key] ?? p.label}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {hasVotes && presentOutcomes.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{t("voting_chart_col_vote")}:</span>
                            {presentOutcomes.map((k) => (
                                <span key={k} className="inline-flex items-center gap-1.5">
                                    <OutcomeGlyph outcome={k} />
                                    {outcomeLabel[k]}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>

                {orderedVoters.length < N ? (
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                        {orderedVoters.length} / {N} {t("voting_chart_seats")}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

/* =========================================================================
 * <VotingChart /> — full panel: summary + hemicycle + by-party bars + list
 * ========================================================================= */

type SortKey = "seat" | "person" | "party" | "vote";

// The export modal shell now lives in the shared ChartExportDialog (used by every
// chart). VotingChart's old local Modal was removed when its "Edit & export"
// button was unified onto that dialog.

export interface VotingChartProps {
    votes: VotingChartVote[];
    legislativeSeats?: number | null | undefined;
    loc?: Record<string, string> | undefined;
    locale?: string | undefined;
    className?: string | undefined;
    /** Voting title — offered as a toggle inside the editor/export. */
    title?: string | null | undefined;
    /** Affair title — offered as a toggle inside the editor/export. */
    affairTitle?: string | null | undefined;
    /** Body / chamber title — offered as a toggle inside the editor/export. */
    bodyTitle?: string | null | undefined;
    /** Show an "Edit" button that lazy-loads the visualization editor. Default true. */
    withEditor?: boolean | undefined;
    /** Optional DOM ids for the hemicycle + vote-list sections (sidebar hash anchors). */
    sectionIds?: { diagram?: string; tally?: string } | undefined;
    /** Chart-only mode: render just the hemicycle + Edit/export, no result pills,
     *  by-party bars or vote list. Used for a body's member roster (no votes). */
    chartOnly?: boolean | undefined;
    /** Override the card title loc key (e.g. members roster vs "How they voted"). */
    titleKey?: string | undefined;
    /** Literal card title (wins over titleKey) — e.g. a chamber name from data. */
    headerTitle?: string | undefined;
    /** Override the card title icon (default "vote"). */
    iconName?: string | undefined;
}

export function VotingChart({
    votes,
    legislativeSeats,
    loc = {},
    locale = "de-CH",
    className,
    title,
    affairTitle,
    bodyTitle,
    withEditor = true,
    sectionIds,
    chartOnly = false,
    titleKey,
    headerTitle,
    iconName,
}: VotingChartProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const { colorOf, legend } = useColorMap(votes);
    const { lang } = useParams();
    const [showEditor, setShowEditor] = React.useState(false);

    // --- hemicycle sector re-ordering (restored) -----------------------------
    // Group order dominates the arc; parties reorder within their own group.
    // Fed to the export preview via config.partyOrder / config.groupOrder.
    const groups = React.useMemo(() => {
        const m = new Map<string, number>();
        for (const v of votes) {
            const g = v.parliamentary_group;
            if (g) m.set(g, (m.get(g) ?? 0) + 1);
        }
        const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
        return [...m.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).map(([n]) => n);
    }, [votes]);
    const groupsUsed =
        votes.length > 0 &&
        groups.length > 0 &&
        votes.filter((v) => v.parliamentary_group != null).length / votes.length >= 0.8;
    const partyToGroup = React.useMemo(() => {
        const tally = new Map<string, Map<string, number>>();
        for (const v of votes) {
            const key = v.party_key ?? v.party ?? "—";
            const g = v.parliamentary_group;
            if (!g) continue;
            if (!tally.has(key)) tally.set(key, new Map());
            const gm = tally.get(key)!;
            gm.set(g, (gm.get(g) ?? 0) + 1);
        }
        const out = new Map<string, string>();
        for (const [key, gm] of tally) {
            let best = "",
                bestN = -1;
            for (const [g, n] of gm) if (n > bestN) (best = g), (bestN = n);
            out.set(key, best);
        }
        return out;
    }, [votes]);

    const [partyOrder, setPartyOrder] = React.useState<string[]>(() => legend.map((p) => p.key));
    const [groupOrder, setGroupOrder] = React.useState<string[]>(() => groups);
    const [groupLabels, setGroupLabels] = React.useState<Record<string, string>>({});
    React.useEffect(() => setPartyOrder(legend.map((p) => p.key)), [legend]);
    React.useEffect(() => setGroupOrder(groups), [groups]);

    const move = <T,>(arr: T[], i: number, dir: -1 | 1): T[] => {
        const j = i + dir;
        if (j < 0 || j >= arr.length) return arr;
        const copy = arr.slice();
        [copy[i], copy[j]] = [copy[j], copy[i]];
        return copy;
    };
    const movePartyScoped = (key: string, dir: -1 | 1) =>
        setPartyOrder((order) => {
            if (!groupsUsed) return move(order, order.indexOf(key), dir);
            const g = partyToGroup.get(key);
            const same = order.map((k, i) => ({ k, i })).filter((x) => partyToGroup.get(x.k) === g);
            const pos = same.findIndex((x) => x.k === key);
            const target = pos + dir;
            if (target < 0 || target >= same.length) return order;
            const a = same[pos]!.i,
                b = same[target]!.i;
            const copy = order.slice();
            [copy[a], copy[b]] = [copy[b], copy[a]];
            return copy;
        });
    const partyGroupsForUi = React.useMemo(() => {
        if (!groupsUsed) return null;
        const byGroup = new Map<string, string[]>();
        for (const key of partyOrder) {
            const g = partyToGroup.get(key) ?? "—";
            if (!byGroup.has(g)) byGroup.set(g, []);
            byGroup.get(g)!.push(key);
        }
        const ordered: { group: string; parties: string[] }[] = [];
        for (const g of groupOrder)
            if (byGroup.has(g)) {
                ordered.push({ group: g, parties: byGroup.get(g)! });
                byGroup.delete(g);
            }
        for (const [g, ps] of byGroup) ordered.push({ group: g, parties: ps });
        return ordered;
    }, [groupsUsed, partyOrder, partyToGroup, groupOrder]);

    const resetOrder = () => {
        setPartyOrder(legend.map((p) => p.key));
        setGroupOrder(groups);
        setGroupLabels({});
    };

    const ARR =
        "flex size-11 items-center justify-center rounded border border-input text-[10px] leading-none " +
        "text-muted-foreground outline-none enabled:hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-30";

    const orderControls = (cx: ChartExportRenderCtx) => {
        const swatch = (key: string) => (
            <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cx.colorFor(key) }} />
        );
        const partyRow = (key: string, up: boolean, down: boolean) => (
            <li key={key} className="flex items-center gap-1.5">
                <button type="button" className={ARR} disabled={!up} onClick={() => movePartyScoped(key, -1)} aria-label="Move up">↑</button>
                <button type="button" className={ARR} disabled={!down} onClick={() => movePartyScoped(key, 1)} aria-label="Move down">↓</button>
                {swatch(key)}
                <span className="min-w-0 truncate">{cx.labelFor(key)}</span>
            </li>
        );
        return (
            <>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t("chart_order")}</span>
                    <button
                        type="button"
                        onClick={resetOrder}
                        className="inline-flex min-h-11 items-center rounded-sm text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        {t("chart_reset")}
                    </button>
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {partyGroupsForUi
                        ? partyGroupsForUi.map((blk, gi) => (
                            <div key={blk.group} className="rounded-md border p-2">
                                <div className="mb-1 flex items-center gap-1.5">
                                    <button type="button" className={ARR} disabled={gi === 0} onClick={() => setGroupOrder((o) => move(o, gi, -1))} aria-label="Move group up">↑</button>
                                    <button type="button" className={ARR} disabled={gi === partyGroupsForUi.length - 1} onClick={() => setGroupOrder((o) => move(o, gi, 1))} aria-label="Move group down">↓</button>
                                    <input
                                        value={groupLabels[blk.group] ?? blk.group}
                                        onChange={(e) => setGroupLabels((l) => ({ ...l, [blk.group]: e.target.value }))}
                                        className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        aria-label={`${t("chart_label_for")} ${blk.group}`}
                                    />
                                </div>
                                <ul className="space-y-1 pl-2 text-sm">
                                    {blk.parties.map((key, i) => partyRow(key, i > 0, i < blk.parties.length - 1))}
                                </ul>
                            </div>
                        ))
                        : (
                            <ul className="space-y-1 text-sm">
                                {partyOrder.map((key, i) => partyRow(key, i > 0, i < partyOrder.length - 1))}
                            </ul>
                        )}
                </div>
            </>
        );
    };

    const personHref = React.useCallback(
        (id: number) => peopleHref(lang, id),
        [lang],
    );

    const { presentOutcomes, outcomeLabel } = React.useMemo(
        () => summarizeOutcomes(votes),
        [votes],
    );

    // Per-party outcome breakdown for the 100%-stacked bars (segments by OUTCOME).
    const byParty = React.useMemo(
        () =>
            legend.map((p) => {
                const counts: Record<string, number> = {};
                let tot = 0;
                for (const v of votes) {
                    if ((v.party_key ?? v.party ?? "—") !== p.key) continue;
                    const k = outcomeKey(v.vote);
                    counts[k] = (counts[k] ?? 0) + 1;
                    tot++;
                }
                return { key: p.key, label: p.label, color: p.color, total: tot, counts };
            }),
        [votes, legend],
    );

    // Outcome counts by canonical key (for the result summary + percentages).
    const outcomeCounts = React.useMemo(() => {
        const m: Record<string, number> = {};
        for (const v of votes) {
            const k = outcomeKey(v.vote);
            m[k] = (m[k] ?? 0) + 1;
        }
        return m;
    }, [votes]);

    const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({
        key: "seat",
        dir: "asc",
    });
    const sortedRows = React.useMemo(() => {
        const rows = votes.slice();
        const dir = sort.dir === "asc" ? 1 : -1;
        const cmp = (a: VotingChartVote, b: VotingChartVote) => {
            switch (sort.key) {
                case "person":
                    return (a.fullname ?? "").localeCompare(b.fullname ?? "") * dir;
                case "party":
                    return (a.party ?? "").localeCompare(b.party ?? "") * dir;
                case "vote":
                    return (
                        (a.vote_display ?? a.vote ?? "").localeCompare(
                            b.vote_display ?? b.vote ?? "",
                        ) * dir
                    );
                case "seat":
                default:
                    return (
                        ((a.parliament_seat ?? Number.MAX_SAFE_INTEGER) -
                            (b.parliament_seat ?? Number.MAX_SAFE_INTEGER)) *
                        dir
                    );
            }
        };
        return rows.sort(cmp);
    }, [votes, sort]);

    const toggleSort = (key: SortKey) =>
        setSort((s) =>
            s.key === key
                ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
                : { key, dir: "asc" },
        );

    const total = votes.length;

    return (
        <>
            <Card className={className}>
                <SectionCardHeader
                    icon={(iconName ?? "vote") as any}
                    title={headerTitle ?? t(titleKey ?? "voting_chart_title")}
                    count={total}
                    action={
                        withEditor && total > 0 ? (
                            <span className="ml-auto flex items-center gap-2">
                                <ChartExportButton
                                    loc={loc}
                                    label={t("voting_chart_edit")}
                                    onClick={() => setShowEditor(true)}
                                />
                            </span>
                        ) : null
                    }
                    subtitleClassName="mt-1 text-xs text-muted-foreground"
                    subtitle={
                        withEditor && total > 0
                            ? t(
                                "voting_chart_seat_note",
                            )
                            : null
                    }
                />

                <CardContent className="space-y-5">
                    {total === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            {t("voting_chart_no_votes")}
                        </p>
                    ) : (
                        <>
                            {/* ------------------ result: compact counts + % ------------------ */}
                            {chartOnly ? null : (
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    {STAT_ORDER.filter((k) => outcomeCounts[k]).map((k) => {
                                        const n = outcomeCounts[k];
                                        const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                                        return (
                                            <span
                                                key={k}
                                                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                                            >
                                                <span
                                                    className="inline-block size-2.5 rounded-full"
                                                    style={{ backgroundColor: outcomeColor(k) }}
                                                />
                                                <span className="font-medium">{outcomeLabel[k] ?? k}</span>
                                                <span className="tabular-nums">{n}</span>
                                                <span className="text-muted-foreground">({pct}%)</span>
                                            </span>
                                        );
                                    })}
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-muted-foreground">
                                        {t("voting_chart_majority")}
                                        <span className="tabular-nums text-foreground">
                                            {Math.floor(total / 2) + 1}
                                        </span>
                                    </span>
                                </div>
                            )}

                            {/* ---------------------------- hemicycle --------------------------- */}
                            <div id={sectionIds?.diagram} className="scroll-mt-24">
                                <VotingHemicycle
                                    votes={votes}
                                    legislativeSeats={legislativeSeats}
                                    loc={loc}
                                    locale={locale}
                                    forceHemicycle
                                />
                            </div>

                            {/* ---------------- party seat share (members chart) --------------- */}
                            {chartOnly && legend.length > 0 ? (
                                <div className="space-y-1.5">
                                    <div className="text-xs font-medium text-muted-foreground">
                                        {t("voting_chart_by_party_seats")}
                                    </div>
                                    <div className="space-y-1.5">
                                        {legend.map((p) => {
                                            const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                                            return (
                                                <div
                                                    key={p.key}
                                                    className="grid grid-cols-[7rem_1fr_3.5rem] items-center gap-2 text-xs sm:grid-cols-[9rem_1fr_4rem]"
                                                >
                                                    <span className="inline-flex min-w-0 items-center gap-1.5">
                                                        <span
                                                            className="inline-block size-2.5 shrink-0 rounded-full"
                                                            style={{ backgroundColor: p.color }}
                                                        />
                                                        <span className="truncate">{p.label}</span>
                                                    </span>
                                                    <span className="flex h-3.5 w-full overflow-hidden rounded-sm bg-muted">
                                                        <span style={{ width: `${pct}%`, backgroundColor: p.color }} />
                                                    </span>
                                                    <span className="text-right tabular-nums text-muted-foreground">
                                                        {p.count}
                                                        <span className="ml-1">({pct}%)</span>
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}

                            {/* --------------------- vote outcome by party --------------------- */}
                            {!chartOnly && byParty.length > 0 && presentOutcomes.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">
                                        {t("voting_chart_by_party")}
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                        {presentOutcomes.map((k) => (
                                            <span key={k} className="inline-flex items-center gap-1.5">
                                                <span
                                                    className="inline-block size-2.5 rounded-sm"
                                                    style={{ backgroundColor: outcomeColor(k) }}
                                                />
                                                {outcomeLabel[k]}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="space-y-1.5">
                                        {byParty.map((p) =>
                                            p.total === 0 ? null : (
                                                <div
                                                    key={p.key}
                                                    className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-xs sm:grid-cols-[9rem_1fr_2.5rem]"
                                                >
                                                    <span className="inline-flex min-w-0 items-center gap-1.5">
                                                        <span
                                                            className="inline-block size-2.5 shrink-0 rounded-full"
                                                            style={{ backgroundColor: p.color }}
                                                        />
                                                        <span className="truncate">{p.label}</span>
                                                    </span>
                                                    <span className="flex h-3.5 w-full overflow-hidden rounded-sm bg-muted">
                                                        {presentOutcomes.map((k) => {
                                                            const n = p.counts[k] ?? 0;
                                                            if (!n) return null;
                                                            return (
                                                                <span
                                                                    key={k}
                                                                    title={`${outcomeLabel[k]}: ${n}`}
                                                                    style={{
                                                                        width: `${(n / p.total) * 100}%`,
                                                                        backgroundColor: outcomeColor(k),
                                                                    }}
                                                                />
                                                            );
                                                        })}
                                                    </span>
                                                    <span className="text-right tabular-nums text-muted-foreground">
                                                        {p.total}
                                                    </span>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {/* ---------------------------- vote list --------------------------- */}
                            {chartOnly ? null : (
                                <div id={sectionIds?.tally} className="scroll-mt-24 overflow-x-auto">
                                    <table className="w-full border-collapse text-sm">
                                        <caption className="sr-only">
                                            {t("voting_table_alt", { count: total })}
                                        </caption>
                                        <thead>
                                            <tr className="border-b text-left text-xs text-muted-foreground">
                                                <Th label={t("voting_chart_col_person")} k="person" sort={sort} onSort={toggleSort} />
                                                <Th label={t("voting_chart_col_party")} k="party" sort={sort} onSort={toggleSort} />
                                                <th className="px-2 py-2 font-medium">
                                                    {t("voting_chart_col_group")}
                                                </th>
                                                <Th label={t("voting_chart_col_vote")} k="vote" sort={sort} onSort={toggleSort} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedRows.map((v, i) => (
                                                <tr
                                                    key={`${v.person_id ?? "x"}-${i}`}
                                                    className="border-b border-border/50 last:border-0"
                                                >
                                                    <td className="px-2 py-1.5">
                                                        {v.person_id != null ? (
                                                            <InternalLink to={personHref(v.person_id)}>
                                                                {v.fullname ?? "—"}
                                                            </InternalLink>
                                                        ) : (
                                                            (v.fullname ?? "—")
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-1.5">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span
                                                                className="inline-block size-2.5 shrink-0 rounded-full"
                                                                style={{ backgroundColor: colorOf(v) }}
                                                            />
                                                            {v.party ?? "—"}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-muted-foreground">
                                                        {v.parliamentary_group ?? "—"}
                                                    </td>
                                                    <td className="px-2 py-1.5">{v.vote_display ?? v.vote ?? "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}

                    {/* Methodology deep-link at the foot of the card (this view has no
                        attribution footer of its own to carry it). */}
                    {withEditor ? (
                        <div className="mt-4 flex justify-end border-t pt-3">
                            <MethodologyLink anchor="hemicycle" />
                        </div>
                    ) : null}
                </CardContent>
            </Card>

            {withEditor ? (
                <ChartExportDialog
                    open={showEditor}
                    onClose={() => setShowEditor(false)}
                    loc={loc}
                    filename="hemicycle"
                    series={legend.map((p) => ({ key: p.key, label: p.label, color: p.color }))}
                    defaultTitle={title ?? bodyTitle ?? affairTitle ?? undefined}
                    defaultSubtitle={affairTitle ?? undefined}
                    extraControls={orderControls}
                >
                    {(cx) => (
                        <VotingHemicycle
                            votes={votes}
                            legislativeSeats={legislativeSeats}
                            loc={loc}
                            locale={locale}
                            theme={cx.theme}
                            interactive={cx.interactive}
                            hideColorToggle
                            forceHemicycle
                            config={{ partyColors: cx.colors, partyLabels: cx.labels, partyOrder, groupLabels, groupOrder }}
                            seatHref={
                                cx.interactive
                                    ? (v) => (v.person_id != null ? `${PERSON_EXPORT_BASE}${v.person_id}` : null)
                                    : undefined
                            }
                        />
                    )}
                </ChartExportDialog>
            ) : null}
        </>
    );
}

/* ---- sortable header cell ---- */
function Th({
    label,
    k,
    sort,
    onSort,
}: {
    label: string;
    k: SortKey;
    sort: { key: SortKey; dir: "asc" | "desc" };
    onSort: (k: SortKey) => void;
}) {
    const active = sort.key === k;
    return (
        <th
            className="px-2 py-2 font-medium"
            aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        >
            <button
                type="button"
                onClick={() => onSort(k)}
                className="inline-flex min-h-11 items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                {label}
                <span className={active ? "text-foreground" : "opacity-30"}>
                    {active && sort.dir === "desc" ? "↓" : "↑"}
                </span>
            </button>
        </th>
    );
}

export default VotingChart;