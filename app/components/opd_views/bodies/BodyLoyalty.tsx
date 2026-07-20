// BodyLoyalty.tsx                  → ~/components/opd_views/bodies/BodyLoyalty.tsx
//
// /bodies/:id/loyalty panel: party-loyalty (dissent rate) for every qualifying
// MP of a body, plus per-group COHESION (Agreement Index). Three linked views:
//   • a 1-D BEESWARM of dissent rate, dots coloured by party, with a hover
//     tooltip styled like the /votings/:id hemicycle (name · party · value);
//   • per-group COHESION bars (mean Agreement Index over the window);
//   • a sortable MEMBER TABLE in the same style as the /votings/:id vote list.
//
// Dissent rate + cohesion are computed in body_loyalty_by_id.sql. Party colours
// reuse buildColorMap from VotingChart. Hand-rendered SVG (no chart dep). SSR-
// safe: no window / storage; all copy runs through `loc`.

import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ControlGroup, ControlRow, ghostDateField } from "@/components/ui/control-group";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { InternalLink, makeT, SectionCardHeader, AttributionFooter } from "../opd_micros";
import { peopleHref } from "~/lib/urls/hrefs";
import { buildColorMap } from "../votings/VotingChart";
import { ChartExportButton, ChartExportDialog } from "../_shared/ChartExport";
import { chartCtx } from "../_shared/chart_alt";
import type { LoyaltyMember, GroupCohesion } from "~/server/db/analytics/body_loyalty";
import type { BodyChamber } from "@/types/opd_paginated_client";

/** Filename-safe slug from a body title (for chart download names). */
function slugify(s: string | null | undefined): string {
    return (s ?? "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40);
}

export interface BodyLoyaltyProps {
    members: LoyaltyMember[];
    cohesion?: GroupCohesion[];
    /** The body's voting chambers; the switcher renders only with ≥ 2 (CH: NR/SR). */
    chambers?: BodyChamber[];
    /** Selected chamber (votings.group_id), or null = BOTH (pooled). */
    chamberId?: number | null;
    bodyTitle?: string | null;
    /** effective window (ISO dates) for the date controls. */
    from?: string | null;
    to?: string | null;
    loc?: Record<string, string>;
    locale?: string;
}

/* -- hydration-safe formatters (no Intl → server and client agree) ---------- */
function gi(n: number): string {
    const s = Math.round(n).toString();
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
}
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

/* -- beeswarm geometry ------------------------------------------------------ */
const VBW = 720;
const VBH = 300;
const PLOT = { top: 28, bottom: 250, left: 16, right: 704 };
const MID = (PLOT.top + PLOT.bottom) / 2;
const R = 5;
const STEP = 2 * R + 1.5;
const LOG_FLOOR = 0.002; // 0.2% — left anchor of the log axis (rates ≤ this sit at 0)

// Quantize SVG coordinates to 2 decimals. `xOf` runs Math.log in log mode, and
// transcendental functions aren't spec-required to be correctly rounded, so the
// SSR engine and the browser can disagree in the last ULP — rounding makes both
// sides emit byte-identical cx/x attributes and avoids a hydration mismatch.
const q = (n: number) => Math.round(n * 100) / 100;

const fmtTick = (v: number) => {
    const p = v * 100;
    return p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
};

function niceMax(max: number): number {
    if (max <= 0) return 0.1;
    return Math.min(1, Math.ceil((Math.min(1, max) * 1.1) / 0.05) * 0.05);
}

interface Placed extends LoyaltyMember {
    cx: number;
    cy: number;
    color: string;
}

type SortKey = "dissent_rate" | "fullname" | "party" | "n_ballots" | "n_dissents";

/* -- beeswarm (extracted so it renders identically inline + in the export
 *    dialog + fullscreen; positions are colour-independent, only the dot fill
 *    follows `colorOf`, so recolouring in the dialog re-renders cheaply). ----- */
function Beeswarm({
    members,
    colorOf,
    xScale,
    t,
    alt,
    fill = false,
}: {
    members: LoyaltyMember[];
    colorOf: (m: { party_key: string | null; party: string | null }) => string;
    xScale: "log" | "linear";
    t: (k: string) => string;
    /** Data-driven text alternative (count + scope + window), built by the parent. */
    alt: string;
    fill?: boolean;
}) {
    const [hover, setHover] = React.useState<number | null>(null);

    const domainMax = React.useMemo(
        () => niceMax(members.reduce((mx, m) => Math.max(mx, m.dissent_rate), 0)),
        [members],
    );

    const xOf = React.useCallback(
        (rate: number) => {
            const w = PLOT.right - PLOT.left;
            if (!domainMax) return PLOT.left;
            let frac: number;
            if (xScale === "log") {
                const lo = Math.log(LOG_FLOOR);
                const hi = Math.log(domainMax);
                frac = hi > lo ? (Math.log(Math.max(rate, LOG_FLOOR)) - lo) / (hi - lo) : 0;
            } else {
                frac = Math.min(1, rate / domainMax);
            }
            return q(PLOT.left + Math.max(0, Math.min(1, frac)) * w);
        },
        [domainMax, xScale],
    );

    const placed = React.useMemo<Placed[]>(() => {
        const out: Placed[] = [];
        const collide = (cx: number, cy: number) =>
            out.some((q) => {
                const dx = cx - q.cx;
                if (Math.abs(dx) >= STEP) return false;
                const dy = cy - q.cy;
                return dx * dx + dy * dy < STEP * STEP;
            });
        const findY = (cx: number) => {
            if (!collide(cx, MID)) return MID;
            for (let m = STEP; m < (PLOT.bottom - PLOT.top) / 2 + STEP; m += STEP / 2) {
                if (!collide(cx, MID + m)) return MID + m;
                if (!collide(cx, MID - m)) return MID - m;
            }
            return MID;
        };
        for (const m of [...members].sort((a, b) => b.dissent_rate - a.dissent_rate)) {
            const cx = xOf(m.dissent_rate);
            out.push({ ...m, cx, cy: q(findY(cx)), color: colorOf({ party_key: m.party_key, party: m.party }) });
        }
        return out;
    }, [members, xOf, colorOf]);

    const ticks = React.useMemo(() => {
        if (xScale === "linear") return [0, 0.25, 0.5, 0.75, 1].map((f) => f * domainMax);
        const cand = [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
        const out = cand.filter((c) => c >= LOG_FLOOR && c <= domainMax + 1e-9);
        if (out.length === 0 || out[out.length - 1] < domainMax - 1e-9) out.push(domainMax);
        return out;
    }, [xScale, domainMax]);

    const hovered = hover != null ? placed[hover] : null;

    return (
        <figure className={`relative w-full ${fill ? "h-full" : ""}`}>
            <svg
                viewBox={`0 0 ${VBW} ${VBH}`}
                className={fill ? "h-full w-full" : "w-full"}
                role="img"
                aria-label={alt}
            >
                {ticks.map((tk, i) => {
                    const x = xOf(tk);
                    return (
                        <g key={i}>
                            <line x1={x} x2={x} y1={PLOT.top - 8} y2={PLOT.bottom + 6} stroke="var(--border, #e5e7eb)" strokeWidth={1} />
                            <text x={x} y={PLOT.bottom + 20} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
                                {fmtTick(tk)}
                            </text>
                        </g>
                    );
                })}
                {placed.map((p, i) => (
                    <circle
                        key={p.person_id}
                        cx={p.cx}
                        cy={p.cy}
                        r={hover === i ? R + 1.5 : R}
                        fill={p.color}
                        stroke="var(--background, #fff)"
                        strokeWidth={1}
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                        style={{ cursor: "pointer" }}
                    />
                ))}
            </svg>

            {hovered ? (
                (() => {
                    // Card is overflow-hidden, so a centred tooltip on an edge dot clips.
                    // Anchor left/right near the edges, centre in the middle.
                    const frac = hovered.cx / VBW;
                    const xClass = frac < 0.15 ? "translate-x-0" : frac > 0.85 ? "-translate-x-full" : "-translate-x-1/2";
                    return (
                        <div
                            className={`pointer-events-none absolute z-10 ${xClass} -translate-y-[120%] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md`}
                            style={{ left: `${frac * 100}%`, top: `${(hovered.cy / VBH) * 100}%` }}
                        >
                            <div className="font-medium">{hovered.fullname ?? "—"}</div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="inline-block size-2 rounded-full" style={{ backgroundColor: hovered.color }} />
                                {hovered.party ?? "—"}
                                <span className="text-foreground">
                                    · {pct(hovered.dissent_rate)} {t("loyalty_dissent")}
                                </span>
                            </div>
                            <div className="text-muted-foreground">
                                {gi(hovered.n_dissents)}/{gi(hovered.n_ballots)} {t("loyalty_ballots")}
                            </div>
                        </div>
                    );
                })()
            ) : null}

            <figcaption className="mt-1 text-center text-xs text-muted-foreground">
                {t("loyalty_axis")}
            </figcaption>
        </figure>
    );
}

export function BodyLoyalty({ members, cohesion = [], chambers = [], chamberId = null, bodyTitle, from, to, loc, locale }: BodyLoyaltyProps) {
    const t = makeT(loc);
    const { lang } = useParams();
    // Multi-chamber body (CH federal: NR/SR): offer the BOTH / per-chamber switcher.
    const multiChamber = chambers.length >= 2;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // update the URL (loader reruns via shouldRevalidate); empty/null clears the key.
    const setParams = React.useCallback(
        (patch: Record<string, string | null>) => {
            const sp = new URLSearchParams(searchParams);
            for (const [k, v] of Object.entries(patch)) {
                if (v == null || v === "") sp.delete(k);
                else sp.set(k, v);
            }
            const s = sp.toString();
            navigate({ search: s ? `?${s}` : "" }, { preventScrollReset: true });
        },
        [navigate, searchParams],
    );
    // Devtools/autofill want every form field to carry an id or name.
    const dateId = React.useId();
    const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>({
        key: "dissent_rate",
        dir: "desc",
    });
    // x-scale is driven by ?scale (default log) so a link can preset it
    // (?scale=linear opens in linear). It's a client-only axis choice — see
    // shouldRevalidate in the route, which skips a refetch when only scale changes.
    const xScale: "log" | "linear" = searchParams.get("scale") === "linear" ? "linear" : "log";

    const { colorOf, legend } = React.useMemo(
        () => buildColorMap(members.map((m) => ({ party_key: m.party_key, party: m.party }))),
        [members],
    );

    const sortedRows = React.useMemo(() => {
        const dir = sort.dir === "asc" ? 1 : -1;
        const cmp = (a: LoyaltyMember, b: LoyaltyMember) => {
            let d: number;
            if (sort.key === "fullname" || sort.key === "party") {
                d = (a[sort.key] ?? "").localeCompare(b[sort.key] ?? "", locale);
            } else {
                d = (a[sort.key] as number) - (b[sort.key] as number);
            }
            return d !== 0 ? d * dir : (a.fullname ?? "").localeCompare(b.fullname ?? "", locale);
        };
        return [...members].sort(cmp);
    }, [members, sort, locale]);

    const toggleSort = (key: SortKey) =>
        setSort((s) =>
            s.key === key
                ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
                : { key, dir: key === "fullname" || key === "party" ? "asc" : "desc" },
        );

    // group → its constituent parties (colour + count), to tie each cohesion bar
    // back to the party colours in the beeswarm and show which parties sit in the
    // parliamentary group (a Fraktion can hold more than one party).
    const groupParties = React.useMemo(() => {
        const byGroup = new Map<string, Map<string, { label: string; color: string; count: number }>>();
        for (const m of members) {
            const g = m.parliamentary_group ?? "\u2014";
            const pk = m.party_key ?? m.party ?? "\u2014";
            if (!byGroup.has(g)) byGroup.set(g, new Map());
            const inner = byGroup.get(g)!;
            const cur = inner.get(pk);
            if (cur) cur.count++;
            else inner.set(pk, { label: m.party ?? "\u2014", color: colorOf({ party_key: m.party_key, party: m.party }), count: 1 });
        }
        const out = new Map<string, { label: string; color: string; count: number }[]>();
        for (const [g, inner] of byGroup) out.set(g, [...inner.values()].sort((a, b) => b.count - a.count));
        return out;
    }, [members, colorOf]);

    const personHref = (id: number) => peopleHref(lang, id);

    const [exportOpen, setExportOpen] = React.useState(false);
    // Text alternative for the beeswarm: how many members it plots, for which
    // body, over which window — the two things ?from/?to actually change.
    const loyaltyCtx = chartCtx(bodyTitle, from, to);
    const beeswarmAlt = t("loyalty_chart_alt", {
        count: members.length,
        ctx: loyaltyCtx,
    });
    // The member table is the beeswarm's text equivalent, so it takes the same
    // facts under its own sentence: a <caption> is read where the plot is not.
    const tableAlt = t("loyalty_table_alt", {
        count: members.length,
        ctx: loyaltyCtx,
    });
    const fileBase = `party-loyalty${bodyTitle ? `-${slugify(bodyTitle)}` : ""}`;
    const series = React.useMemo(
        () => legend.map((l) => ({ key: l.key, label: l.label, color: l.color })),
        [legend],
    );

    return (
        <Card>
            <SectionCardHeader
                icon="heart-handshake"
                iconClassName="size-4"
                title={t("loyalty_title")}
                suffix={bodyTitle ? <span className="font-normal text-muted-foreground">· {bodyTitle}</span> : null}
                action={
                    members.length > 0 ? (
                        <span className="ml-auto flex items-center gap-2">
                            <ChartExportButton loc={loc} onClick={() => setExportOpen(true)} />
                        </span>
                    ) : null
                }
                subtitleClassName="text-xs text-muted-foreground"
                subtitle={t(
                    "loyalty_subtitle",
                )}
            />
            <CardContent className="space-y-6">
                {/* ---- controls: chamber scope · date window · scale ---- */}
                <ControlGroup label={t("loyalty_filters")} className="max-w-xs">
                    {multiChamber ? (
                        <ControlRow label={t("facet_chamber")}>
                            <Segmented
                                size="sm"
                                className="rounded-r-none border-transparent"
                                value={chamberId != null ? String(chamberId) : "all"}
                                onValueChange={(v) => setParams({ chamber: v === "all" ? null : v })}
                            >
                                <SegmentedItem value="all">{t("chamber_both")}</SegmentedItem>
                                {chambers.map((c) => (
                                    <SegmentedItem key={c.id} value={String(c.id)}>
                                        {c.abbreviation ?? c.name ?? String(c.id)}
                                    </SegmentedItem>
                                ))}
                            </Segmented>
                        </ControlRow>
                    ) : null}
                    <ControlRow label={t("loyalty_from")} bleed>
                        <input
                            type="date"
                            id={`${dateId}-from`}
                            name="from"
                            value={from ?? ""}
                            max={to ?? undefined}
                            onChange={(e) => setParams({ from: e.target.value || null })}
                            className={ghostDateField}
                            aria-label={t("loyalty_from")}
                        />
                    </ControlRow>
                    <ControlRow label={t("loyalty_to")} bleed>
                        <input
                            type="date"
                            id={`${dateId}-to`}
                            name="to"
                            value={to ?? ""}
                            min={from ?? undefined}
                            onChange={(e) => setParams({ to: e.target.value || null })}
                            className={ghostDateField}
                            aria-label={t("loyalty_to")}
                        />
                    </ControlRow>
                    <ControlRow label={t("loyalty_scale")}>
                        <Segmented
                            size="sm"
                            className="rounded-r-none border-transparent"
                            value={xScale}
                            onValueChange={(m) => setParams({ scale: m === "linear" ? "linear" : null })}
                        >
                            <SegmentedItem value="log">{t("loyalty_scale_log")}</SegmentedItem>
                            <SegmentedItem value="linear">{t("loyalty_scale_linear")}</SegmentedItem>
                        </Segmented>
                    </ControlRow>
                </ControlGroup>

                {/* ---- beeswarm (with hemicycle-style hover tooltip) ---- */}
                {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t("loyalty_empty")}
                    </p>
                ) : (
                    <>
                        <Beeswarm members={members} colorOf={colorOf} xScale={xScale} t={t} alt={beeswarmAlt} />

                        <ChartExportDialog
                            open={exportOpen}
                            onClose={() => setExportOpen(false)}
                            loc={loc}
                            filename={fileBase}
                            series={series}
                            defaultTitle={t("loyalty_title")}
                            defaultSubtitle={bodyTitle ?? undefined}
                            legend
                        >
                            {(cx) => (
                                <Beeswarm
                                    members={members}
                                    colorOf={(m) => cx.colorFor(m.party_key ?? m.party)}
                                    xScale={xScale}
                                    t={t}
                                    alt={beeswarmAlt}
                                />
                            )}
                        </ChartExportDialog>

                        {/* party legend */}
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {legend.map((l) => (
                                <li key={l.key} className="flex items-center gap-1.5">
                                    <span className="inline-block size-2.5 rounded-full" style={{ background: l.color }} />
                                    <span>{l.label}</span>
                                    <span>({l.count})</span>
                                </li>
                            ))}
                        </ul>

                        {/* ---- per-group cohesion (Agreement Index) ---- */}
                        {cohesion.length > 0 ? (
                            <section className="space-y-2">
                                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                                    {t("cohesion_title")}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {t("cohesion_hint")}
                                    </span>
                                </h3>
                                <div className="overflow-x-auto">
                                <ul className="min-w-[26rem] space-y-1.5">
                                    {cohesion.map((c) => {
                                        const parties = groupParties.get(c.group ?? "\u2014") ?? [];
                                        const barColor = parties[0]?.color ?? "var(--primary)";
                                        return (
                                            <li key={c.group_key ?? c.group ?? "—"} className="flex items-center gap-2 text-sm">
                                                {/* party dots: which parties sit in this parliamentary group */}
                                                <span className="flex w-12 shrink-0 items-center justify-end gap-0.5">
                                                    {parties.slice(0, 4).map((p) => (
                                                        <span
                                                            key={p.label}
                                                            className="inline-block size-2.5 rounded-full"
                                                            style={{ background: p.color }}
                                                            title={`${p.label} (${p.count})`}
                                                        />
                                                    ))}
                                                </span>
                                                <span className="w-40 shrink-0 truncate" title={c.group ?? undefined}>
                                                    {c.group ?? "—"}
                                                </span>
                                                <span className="relative h-3 flex-1 overflow-hidden rounded bg-muted">
                                                    <span
                                                        className="absolute inset-y-0 left-0 rounded"
                                                        style={{ width: `${Math.max(2, c.cohesion * 100)}%`, background: barColor }}
                                                    />
                                                </span>
                                                <span className="w-12 shrink-0 text-right font-medium tabular-nums">
                                                    {c.cohesion.toFixed(2)}
                                                </span>
                                                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                                                    {gi(c.n_ballots)} {t("loyalty_ballots")}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                                </div>
                            </section>
                        ) : null}

                        {/* ---- member table — /votings/:id vote-list style ---- */}
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <caption className="sr-only">{tableAlt}</caption>
                                <thead>
                                    <tr className="border-b text-left text-xs text-muted-foreground">
                                        <Th label={t("loyalty_col_member")} k="fullname" sort={sort} onSort={toggleSort} />
                                        <Th label={t("loyalty_col_party")} k="party" sort={sort} onSort={toggleSort} />
                                        <th className="px-2 py-2 font-medium">{t("loyalty_col_group")}</th>
                                        <Th label={t("loyalty_col_ballots")} k="n_ballots" sort={sort} onSort={toggleSort} numeric />
                                        <Th label={t("loyalty_col_dissents")} k="n_dissents" sort={sort} onSort={toggleSort} numeric />
                                        <Th label={t("loyalty_col_rate")} k="dissent_rate" sort={sort} onSort={toggleSort} numeric />
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRows.map((m, i) => (
                                        <tr key={`${m.person_id}-${i}`} className="border-b border-border/50 last:border-0">
                                            <td className="px-2 py-1.5">
                                                <InternalLink to={personHref(m.person_id)}>
                                                    {m.fullname ?? "—"}
                                                </InternalLink>
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span
                                                        className="inline-block size-2.5 shrink-0 rounded-full"
                                                        style={{ backgroundColor: colorOf({ party_key: m.party_key, party: m.party }) }}
                                                    />
                                                    {m.party ?? "—"}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-muted-foreground">{m.parliamentary_group ?? "—"}</td>
                                            <td className="px-2 py-1.5 text-right tabular-nums">{gi(m.n_ballots)}</td>
                                            <td className="px-2 py-1.5 text-right tabular-nums">{gi(m.n_dissents)}</td>
                                            <td className="px-2 py-1.5 text-right font-medium tabular-nums">{pct(m.dissent_rate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <AttributionFooter t={t} anchor="loyalty" className="border-t pt-3 text-xs text-muted-foreground" />
            </CardContent>
        </Card>
    );
}

/* ---- sortable header cell (matches VotingChart's Th) ---- */
function Th({
    label,
    k,
    sort,
    onSort,
    numeric,
}: {
    label: string;
    k: SortKey;
    sort: { key: SortKey; dir: "asc" | "desc" };
    onSort: (k: SortKey) => void;
    numeric?: boolean;
}) {
    const active = sort.key === k;
    return (
        <th
            className={`px-2 py-2 font-medium ${numeric ? "text-right" : ""}`}
            aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        >
            <button
                type="button"
                onClick={() => onSort(k)}
                className={`inline-flex min-h-11 items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${numeric ? "flex-row-reverse" : ""}`}
            >
                {label}
                <span className={active ? "text-foreground" : "opacity-30"}>
                    {active && sort.dir === "desc" ? "↓" : "↑"}
                </span>
            </button>
        </th>
    );
}

export default BodyLoyalty;