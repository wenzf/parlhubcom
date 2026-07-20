// BodyAlignment.tsx
//
// /bodies/:id/alignment — the co-voting SPATIAL MODEL of one chamber. Two views
// (a URL ?view toggle, so switching never refetches — see the route's
// shouldRevalidate):
//   • "scatter" — each member is a dot placed by classical MDS on the member×vote
//     agreement matrix (the W-NOMINATE idea): members who vote alike sit close,
//     opponents far apart. Dots are coloured by party, so blocs cluster visibly.
//   • "heatmap" — the party×party mean-agreement matrix; coalition structure
//     (which parties vote together vs against) falls out of the colour field. The
//     diagonal is each party's own internal cohesion.
//
// Coordinates + the party matrix are computed in body_alignment.ts (MDS) and
// body_alignment_by_id.sql (pairwise agreement). Party colours reuse
// buildColorMap from VotingChart. Hand-rendered SVG (no chart dep). SSR-safe:
// no window / storage; all copy runs through `loc`.

import * as React from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ControlGroup, ControlRow, ghostDateField } from "@/components/ui/control-group";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { InternalLink, makeT, AttributionFooter, SectionCardHeader } from "../opd_micros";
import { peopleHref } from "~/lib/urls/hrefs";
import { buildColorMap } from "../votings/VotingChart";
import { ChartExportButton, ChartExportDialog, ChartFullscreenButton, FullscreenChart } from "../_shared/ChartExport";
import { chartCtx } from "../_shared/chart_alt";
import type {
    AlignmentMember,
    PartyCell,
    AlignmentParty,
} from "~/server/db/analytics/body_alignment";
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

export interface BodyAlignmentProps {
    members: AlignmentMember[];
    partyMatrix: PartyCell[];
    parties: AlignmentParty[];
    /** The body's voting chambers; the switcher renders only with ≥ 2 (CH: NR/SR). */
    chambers?: BodyChamber[];
    /** Effective chamber the matrix was computed on (server-resolved default). */
    chamberId?: number | null;
    bodyTitle?: string | null;
    from?: string | null;
    to?: string | null;
    loc?: Record<string, string>;
    locale?: string;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

// green (aligned) → red (opposed), through amber at 50%.
function agreementColor(a: number): string {
    return `hsl(${Math.round(a * 120)} 60% 45%)`;
}

/* -------------------------------- scatter --------------------------------- */

const PLOT = 560; // square viewBox
const PAD = 28;

function Scatter({
    members: placed,
    colorOf,
    t,
    alt,
    fill = false,
}: {
    /** Already filtered to the placeable members (see `plotted` in the parent),
     *  so the dot count and `alt`'s `{count}` cannot drift apart. */
    members: AlignmentMember[];
    colorOf: (m: { party_key: string | null; party: string | null }) => string;
    t: (k: string) => string;
    /** Data-driven text alternative (count + scope + window), built by the parent. */
    alt: string;
    /** Fill the parent (fullscreen) instead of the centred max-w block. */
    fill?: boolean;
}) {
    const [hover, setHover] = React.useState<number | null>(null);

    const svgRef = React.useRef<SVGSVGElement | null>(null);
    const [view, setView] = React.useState({ k: 1, tx: 0, ty: 0 });
    const drag = React.useRef<null | { x: number; y: number; tx: number; ty: number; moved: boolean }>(null);
    const [dragging, setDragging] = React.useState(false);

    // [-1,1] → [PAD, PLOT-PAD]; invert y so +y is up
    const sx = (x: number) => PAD + ((x + 1) / 2) * (PLOT - 2 * PAD);
    const sy = (y: number) => PLOT - (PAD + ((y + 1) / 2) * (PLOT - 2 * PAD));
    // pan/zoom transform applied to viewBox coords
    const Tx = (bx: number) => bx * view.k + view.tx;
    const Ty = (by: number) => by * view.k + view.ty;

    const clientToVB = React.useCallback((cx: number, cy: number): [number, number] => {
        const r = svgRef.current!.getBoundingClientRect();
        return [((cx - r.left) / r.width) * PLOT, ((cy - r.top) / r.height) * PLOT];
    }, []);

    const zoomAt = React.useCallback((vbx: number, vby: number, factor: number) => {
        setView((v) => {
            const k = Math.min(12, Math.max(1, v.k * factor));
            const ratio = k / v.k;
            let tx = vbx - (vbx - v.tx) * ratio;
            let ty = vby - (vby - v.ty) * ratio;
            if (k === 1) { tx = 0; ty = 0; } // snap back to centred when fully out
            return { k, tx, ty };
        });
    }, []);

    // native wheel listener (passive:false so we can prevent page scroll)
    React.useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const [vbx, vby] = clientToVB(e.clientX, e.clientY);
            zoomAt(vbx, vby, e.deltaY < 0 ? 1.15 : 1 / 1.15);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [clientToVB, zoomAt]);

    const onMouseDown = (e: React.MouseEvent) => {
        drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
        setDragging(true);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        const d = drag.current;
        if (!d) return;
        const r = svgRef.current!.getBoundingClientRect();
        const dx = ((e.clientX - d.x) / r.width) * PLOT;
        const dy = ((e.clientY - d.y) / r.height) * PLOT;
        if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true;
        const baseTx = d.tx;
        const baseTy = d.ty;
        setView((v) => ({ ...v, tx: baseTx + dx, ty: baseTy + dy }));
    };
    const endDrag = () => {
        drag.current = null;
        setDragging(false);
    };

    const active = hover != null ? placed.find((m) => m.person_id === hover) : null;
    const activeColor = active
        ? colorOf({ party_key: active.party_key, party: active.party })
        : undefined;
    const zoomed = view.k > 1.001;

    return (
        <div className={fill ? "relative h-full w-full" : "relative mx-auto w-full max-w-[80vmin]"}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${PLOT} ${PLOT}`}
                className={`${fill ? "h-full w-full" : "w-full"} touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                role="img"
                aria-label={alt}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
            >
                {/* axes cross at centre (follows the transform) */}
                <line x1={Tx(PAD)} y1={Ty(PLOT / 2)} x2={Tx(PLOT - PAD)} y2={Ty(PLOT / 2)}
                    stroke="currentColor" className="text-border" strokeWidth={1} />
                <line x1={Tx(PLOT / 2)} y1={Ty(PAD)} x2={Tx(PLOT / 2)} y2={Ty(PLOT - PAD)}
                    stroke="currentColor" className="text-border" strokeWidth={1} />
                {placed.map((m) => (
                    <circle
                        key={m.person_id}
                        cx={Tx(sx(m.x as number))}
                        cy={Ty(sy(m.y as number))}
                        r={hover === m.person_id ? 6 : 4}
                        fill={colorOf({ party_key: m.party_key, party: m.party })}
                        fillOpacity={hover == null || hover === m.person_id ? 0.9 : 0.35}
                        stroke="white"
                        strokeWidth={0.75}
                        onMouseEnter={() => !drag.current?.moved && setHover(m.person_id)}
                        onMouseLeave={() => setHover(null)}
                    />
                ))}
            </svg>

            {/* zoom controls */}
            <div className="absolute right-2 top-2 flex flex-col gap-1">
                <button
                    type="button"
                    onClick={() => zoomAt(PLOT / 2, PLOT / 2, 1.3)}
                    className="flex size-11 items-center justify-center rounded-md border border-input bg-background/80 text-sm text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={t("alignment_zoom_in")}
                >
                    +
                </button>
                <button
                    type="button"
                    onClick={() => zoomAt(PLOT / 2, PLOT / 2, 1 / 1.3)}
                    className="flex size-11 items-center justify-center rounded-md border border-input bg-background/80 text-sm text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={t("alignment_zoom_out")}
                >
                    −
                </button>
                {zoomed ? (
                    <button
                        type="button"
                        onClick={() => setView({ k: 1, tx: 0, ty: 0 })}
                        className="flex size-11 items-center justify-center rounded-md border border-input bg-background/80 text-[10px] text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={t("alignment_zoom_reset")}
                    >
                        ⟲
                    </button>
                ) : null}
            </div>

            {/* hover tooltip — name · party · agreement (parliament-diagram style) */}
            {active && !dragging ? (
                <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[120%] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
                    style={{
                        left: `${(Tx(sx(active.x as number)) / PLOT) * 100}%`,
                        top: `${(Ty(sy(active.y as number)) / PLOT) * 100}%`,
                    }}
                >
                    <div className="font-medium">{active.fullname ?? "—"}</div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="inline-block size-2 rounded-full" style={{ backgroundColor: activeColor }} />
                        {active.party ?? "—"}
                        {active.avg_agreement != null ? (
                            <span className="text-foreground">· {pct(active.avg_agreement)}</span>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/* -------------------------------- heatmap --------------------------------- */

function Heatmap({
    parties,
    partyMatrix,
    t,
    alt,
}: {
    parties: AlignmentParty[];
    partyMatrix: PartyCell[];
    t: (k: string) => string;
    alt: string;
}) {
    // build an unordered-pair lookup + a label map.
    const label = new Map(parties.map((p) => [p.party_key, p.party ?? p.party_key]));
    const cell = new Map<string, PartyCell>();
    for (const c of partyMatrix) {
        cell.set(`${c.party_a}|${c.party_b}`, c);
        cell.set(`${c.party_b}|${c.party_a}`, c);
    }
    const keys = parties.map((p) => p.party_key);
    const get = (a: string, b: string) => cell.get(`${a}|${b}`) ?? null;

    if (keys.length === 0) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                {t("alignment_no_parties")}
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="border-collapse text-sm">
                <caption className="sr-only">{alt}</caption>
                <thead>
                    <tr>
                        <th className="p-1" />
                        {keys.map((k) => (
                            <th key={k} className="p-1 text-muted-foreground font-normal">
                                <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap">
                                    {label.get(k)}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {keys.map((a) => (
                        <tr key={a}>
                            <th className="p-1 pr-2 text-right font-normal text-muted-foreground whitespace-nowrap">
                                {label.get(a)}
                            </th>
                            {keys.map((b) => {
                                const c = get(a, b);
                                if (!c) return <td key={b} className="size-14 border border-border/40" />;
                                const strong = c.agreement >= 0.5;
                                const ciText = c.ci > 0 ? ` ± ${Math.round(c.ci * 100)}%` : "";
                                return (
                                    <td
                                        key={b}
                                        className="size-14 border border-border/40 text-center align-middle font-medium tabular-nums"
                                        style={{ background: agreementColor(c.agreement) }}
                                        title={`${label.get(a)} · ${label.get(b)} — ${pct(c.agreement)}${ciText} · n=${c.n} ${t("alignment_pairs")}`}
                                    >
                                        <span className={strong ? "text-white" : "text-black/80"}>
                                            {Math.round(c.agreement * 100)}
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            {/* Visible prose about the grid, for everyone. Not the grid's <caption>:
                that is `alignment_heatmap_alt` above, and it is sr-only. */}
            <p className="mt-2 text-xs text-muted-foreground">
                {t("alignment_heatmap_note")}
            </p>
        </div>
    );
}

/* ------------------------------ member list ------------------------------- */

function MemberList({
    members,
    colorOf,
    t,
    alt,
}: {
    members: AlignmentMember[];
    colorOf: (m: { party_key: string | null; party: string | null }) => string;
    t: (k: string) => string;
    alt: string;
}) {
    // most typical of their chamber first (highest mean agreement), nulls last.
    const params = useParams();
    const rows = [...members].sort(
        (a, b) => (b.avg_agreement ?? -1) - (a.avg_agreement ?? -1),
    );
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <caption className="sr-only">{alt}</caption>
                <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="px-2 py-2 font-medium">{t("alignment_col_member")}</th>
                        <th className="px-2 py-2 font-medium">{t("alignment_col_party")}</th>
                        <th className="px-2 py-2 text-right font-medium">{t("alignment_col_votes")}</th>
                        <th className="px-2 py-2 text-right font-medium">{t("alignment_col_chamber")}</th>
                        <th className="px-2 py-2 text-right font-medium">{t("alignment_col_party_align")}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((m, i) => (
                        <tr key={`${m.person_id}-${i}`} className="border-b border-border/50 last:border-0">
                            <td className="px-2 py-1.5">
                                <InternalLink to={peopleHref(params.lang, m.person_id)}>
                                    {m.fullname ?? "—"}
                                </InternalLink>
                            </td>
                            <td className="px-2 py-1.5">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf({ party_key: m.party_key, party: m.party }) }} />
                                    {m.party ?? "—"}
                                </span>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{m.n_ballots}</td>
                            <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                                {m.avg_agreement != null ? pct(m.avg_agreement) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                {m.avg_own_party != null ? pct(m.avg_own_party) : "—"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* -------------------------------- component ------------------------------- */

export default function BodyAlignment({
    members,
    partyMatrix,
    parties,
    chambers = [],
    chamberId = null,
    bodyTitle,
    from,
    to,
    loc = {},
    locale = "de-CH",
}: BodyAlignmentProps) {
    const t = makeT(loc);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const view: "scatter" | "heatmap" =
        searchParams.get("view") === "heatmap" ? "heatmap" : "scatter";

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

    const { colorOf, legend } = React.useMemo(
        () => buildColorMap(members.map((m) => ({ party_key: m.party_key, party: m.party }))),
        [members],
    );

    // Multi-chamber body (CH federal: NR/SR): the matrix is chamber-scoped, so
    // offer the switcher. Single-chamber: nothing to switch.
    const multiChamber = chambers.length >= 2;
    const activeChamber = chambers.find((c) => c.id === chamberId) ?? null;

    const empty = members.length === 0;

    const [exportOpen, setExportOpen] = React.useState(false);
    const [fsOpen, setFsOpen] = React.useState(false);
    // Chamber-scoped views carry the chamber in the title/filenames (multi-chamber only).
    const chamberLabel = multiChamber
        ? activeChamber?.name ?? activeChamber?.abbreviation ?? null
        : null;
    const scopeTitle = [bodyTitle, chamberLabel].filter(Boolean).join(" · ") || null;
    const fileBase = `voting-alignment${scopeTitle ? `-${slugify(scopeTitle)}` : ""}`;
    const fsTitle = [t("section_body_alignment"), scopeTitle]
        .filter(Boolean)
        .join(" · ");
    const series = React.useMemo(
        () => legend.map((g) => ({ key: g.key, label: g.label, color: g.color })),
        [legend],
    );

    // Text alternative for the scatter: what is actually plotted (how many dots,
    // which chamber, which window), not a fixed sentence. Only members the MDS
    // could place are drawn, so the count comes from `plotted`, not `members`.
    const plotted = React.useMemo(
        () => members.filter((m) => m.x != null && m.y != null),
        [members],
    );
    const alignmentCtx = chartCtx(scopeTitle, from, to);
    const scatterAlt = t("alignment_scatter_alt", {
        count: plotted.length,
        ctx: alignmentCtx,
    });
    // The two tables get their own sentences, not the scatter's: each says what
    // it tabulates, since a caption is read where the plot never is. The party
    // grid counts parties, the member list counts every member (the scatter's
    // `plotted` count is smaller: it drops the members MDS could not place).
    const heatmapAlt = t("alignment_heatmap_alt", {
        count: parties.length,
        ctx: alignmentCtx,
    });
    const memberListAlt = t("alignment_members_table_alt", {
        count: members.length,
        ctx: alignmentCtx,
    });

    return (
        <Card>
            <SectionCardHeader
                icon="scatter-chart"
                title={t("section_body_alignment")}
                suffix={
                    scopeTitle ? (
                        <span className="text-sm font-normal text-muted-foreground">
                            · {scopeTitle}
                        </span>
                    ) : null
                }
                action={
                    !empty && view === "scatter" ? (
                        <span className="ml-auto flex items-center gap-2">
                            <ChartFullscreenButton loc={loc} onClick={() => setFsOpen(true)} />
                            <ChartExportButton loc={loc} onClick={() => setExportOpen(true)} />
                        </span>
                    ) : null
                }
                subtitleClassName="mt-1 text-sm text-muted-foreground"
                subtitle={t(
                    "body_alignment_subtitle",
                )}
            />

            <CardContent className="space-y-6">
                {/* controls: chamber scope · date window · view toggle */}
                <ControlGroup label={t("alignment_filters")} className="max-w-xs">
                    {multiChamber ? (
                        <ControlRow label={t("facet_chamber")}>
                            <Segmented
                                size="sm"
                                className="rounded-r-none border-transparent"
                                value={chamberId != null ? String(chamberId) : ""}
                                onValueChange={(v) => setParams({ chamber: v })}
                            >
                                {chambers.map((c) => (
                                    <SegmentedItem key={c.id} value={String(c.id)}>
                                        {c.abbreviation ?? c.name ?? String(c.id)}
                                    </SegmentedItem>
                                ))}
                            </Segmented>
                        </ControlRow>
                    ) : null}
                    <ControlRow label={t("alignment_from")} bleed>
                        <input
                            type="date"
                            id={`${dateId}-from`}
                            name="from"
                            value={from ?? ""}
                            max={to ?? undefined}
                            onChange={(e) => setParams({ from: e.target.value || null })}
                            className={ghostDateField}
                            aria-label={t("alignment_from")}
                        />
                    </ControlRow>
                    <ControlRow label={t("alignment_to")} bleed>
                        <input
                            type="date"
                            id={`${dateId}-to`}
                            name="to"
                            value={to ?? ""}
                            min={from ?? undefined}
                            onChange={(e) => setParams({ to: e.target.value || null })}
                            className={ghostDateField}
                            aria-label={t("alignment_to")}
                        />
                    </ControlRow>
                    <ControlRow label={t("alignment_view")}>
                        <Segmented
                            size="sm"
                            className="rounded-r-none border-transparent"
                            value={view}
                            onValueChange={(v) => setParams({ view: v === "scatter" ? null : v })}
                        >
                            <SegmentedItem value="scatter">{t("alignment_view_scatter")}</SegmentedItem>
                            <SegmentedItem value="heatmap">{t("alignment_view_heatmap")}</SegmentedItem>
                        </Segmented>
                    </ControlRow>
                </ControlGroup>

                <p className="-mt-2 max-w-prose text-xs text-muted-foreground">
                    {t("alignment_window_note")}
                </p>

                {empty ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                        {t("alignment_empty")}
                    </p>
                ) : view === "scatter" ? (
                    <>
                        <Scatter members={plotted} colorOf={colorOf} t={t} alt={scatterAlt} />
                        {/* party legend */}
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {legend.map((g) => (
                                <li key={g.key} className="flex items-center gap-1.5">
                                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                                    {g.label} <span className="opacity-60">({g.count})</span>
                                </li>
                            ))}
                        </ul>

                        <ChartExportDialog
                            open={exportOpen}
                            onClose={() => setExportOpen(false)}
                            loc={loc}
                            filename={fileBase}
                            series={series}
                            defaultTitle={t("section_body_alignment")}
                            defaultSubtitle={scopeTitle ?? undefined}
                            explorable
                            legend
                        >
                            {(cx) => (
                                <Scatter
                                    members={plotted}
                                    colorOf={(m) => cx.colorFor(m.party_key ?? m.party)}
                                    t={t}
                                    alt={scatterAlt}
                                    fill={cx.fullscreen}
                                />
                            )}
                        </ChartExportDialog>

                        <FullscreenChart open={fsOpen} onClose={() => setFsOpen(false)} title={fsTitle} loc={loc}>
                            <div className="flex h-full w-full items-center justify-center">
                                <Scatter members={plotted} colorOf={colorOf} t={t} alt={scatterAlt} fill />
                            </div>
                        </FullscreenChart>
                    </>
                ) : (
                    <Heatmap parties={parties} partyMatrix={partyMatrix} t={t} alt={heatmapAlt} />
                )}

                {!empty ? (
                    <section className="space-y-2">
                        <h3 className="text-sm font-medium">
                            {t("alignment_members_heading")}
                            <span className="ml-1.5 font-normal text-muted-foreground">({members.length})</span>
                        </h3>
                        <MemberList members={members} colorOf={colorOf} t={t} alt={memberListAlt} />
                    </section>
                ) : null}

                <AttributionFooter t={t} anchor="alignment" className="border-t pt-3 text-xs text-muted-foreground" />
            </CardContent>
        </Card>
    );
}