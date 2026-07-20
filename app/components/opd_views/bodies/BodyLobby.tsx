// BodyLobby.tsx
//
// /bodies/:id/lobby — the register-of-interests network of one chamber, shown as:
//   1. a force-directed person↔organization graph (members = party-coloured dots,
//      shared organizations = neutral squares, edges coloured by paid/unpaid).
//      CLICK a node to focus it: its ties light up, everything else dims, and a
//      detail panel lists the ties in full (a member's organizations, or an
//      organization's members) with role · payment · period.
//   2. an INCIDENCE TABLE — members (rows) × shared organizations (columns), each
//      cell marked by payment. The exhaustive who-is-tied-to-what view; row/column
//      headers are clickable and drive the same selection as the graph.
//   3. the paid/unpaid breakdown + most-shared orgs + members-by-mandates lists.
//
// Positions + payment split computed in body_lobby.ts / body_lobby_by_id.sql.
// Party colours reuse buildColorMap. Org names link to /organizations/:id.

import * as React from "react";
import { useNavigate, useSearchParams, useParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ControlGroup, ControlRow, ghostDateField } from "@/components/ui/control-group";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { InternalLink, makeT, AttributionFooter, SectionCardHeader, type TFunc } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";
import { buildColorMap } from "../votings/VotingChart";
import { ChartExportButton, ChartExportDialog, ChartFullscreenButton, FullscreenChart } from "../_shared/ChartExport";
import { chartCtx } from "../_shared/chart_alt";
import { localizedOrgPath } from "~/lib/urls/org_id";
import { peopleHref } from "~/lib/urls/hrefs";
import type {
    LobbyPerson,
    LobbyOrg,
    LobbyEdge,
    LobbyTie,
    Payment,
} from "~/server/db/analytics/body_lobby";
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

export interface BodyLobbyProps {
    people: LobbyPerson[];
    orgs: LobbyOrg[];
    edges: LobbyEdge[];
    ties: LobbyTie[];
    payment: { paid: number; unpaid: number; unknown: number };
    /** The body's voting chambers; the switcher renders only with ≥ 2 (CH: NR/SR). */
    chambers?: BodyChamber[];
    /** Selected chamber (groups.id), or null = BOTH (all members of the body). */
    chamberId?: number | null;
    bodyTitle?: string | null;
    from?: string | null;
    to?: string | null;
    loc?: Record<string, string>;
    locale?: string;
}

type Sel = { type: "person"; id: number } | { type: "org"; key: string } | null;

const PLOT = 560;
const PAD = 24;
const ORG_FILL = "hsl(220 9% 46%)";
const PAY_COLOR: Record<Payment, string> = {
    paid: "hsl(38 92% 50%)",
    unpaid: "hsl(220 9% 60%)",
    unknown: "hsl(220 9% 40%)",
};

const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "0%");
const year = (e: number | null) => (e == null ? null : new Date(e).getUTCFullYear());
function period(b: number | null, en: number | null): string | null {
    const yb = year(b);
    const ye = year(en);
    if (yb == null && ye == null) return null;
    if (yb != null && ye != null) return yb === ye ? `${yb}` : `${yb}–${ye}`;
    return yb != null ? `${yb}–` : `–${ye}`;
}

/* --------------------------------- graph ---------------------------------- */

function Network({
    people,
    orgs,
    edges,
    colorOf,
    sel,
    onSelect,
    t,
    alt,
    fill = false,
}: {
    people: LobbyPerson[];
    orgs: LobbyOrg[];
    edges: LobbyEdge[];
    colorOf: (m: { party_key: string | null; party: string | null }) => string;
    sel: Sel;
    onSelect: (s: Sel) => void;
    t: (k: string) => string;
    /** Data-driven text alternative (node counts + scope), built by the parent. */
    alt: string;
    /** Fill the parent (fullscreen) instead of the centred max-w block. */
    fill?: boolean;
}) {
    const svgRef = React.useRef<SVGSVGElement | null>(null);
    const [view, setView] = React.useState({ k: 1, tx: 0, ty: 0 });
    const drag = React.useRef<null | { x: number; y: number; tx: number; ty: number }>(null);
    const movedRef = React.useRef(false);
    const [dragging, setDragging] = React.useState(false);
    const [hover, setHover] = React.useState<Sel>(null);

    const personById = React.useMemo(
        () => new Map(people.filter((p) => p.x != null).map((p) => [p.person_id, p])),
        [people],
    );
    const orgByKey = React.useMemo(
        () => new Map(orgs.filter((o) => o.x != null).map((o) => [o.key, o])),
        [orgs],
    );
    const maxMembers = React.useMemo(() => Math.max(2, ...orgs.map((o) => o.n_members)), [orgs]);

    // neighbour sets for the current selection (highlight)
    const focus = React.useMemo(() => {
        if (!sel) return null;
        const persons = new Set<number>();
        const orgKeys = new Set<string>();
        if (sel.type === "person") {
            persons.add(sel.id);
            for (const e of edges) if (e.person_id === sel.id) orgKeys.add(e.org_key);
        } else {
            orgKeys.add(sel.key);
            for (const e of edges) if (e.org_key === sel.key) persons.add(e.person_id);
        }
        return { persons, orgKeys };
    }, [sel, edges]);

    const dimPerson = (id: number) => (focus ? !focus.persons.has(id) : false);
    const dimOrg = (key: string) => (focus ? !focus.orgKeys.has(key) : false);
    const dimEdge = (e: LobbyEdge) =>
        focus ? !(focus.persons.has(e.person_id) && focus.orgKeys.has(e.org_key)) : false;

    const sx = (x: number) => PAD + ((x + 1) / 2) * (PLOT - 2 * PAD);
    const sy = (y: number) => PLOT - (PAD + ((y + 1) / 2) * (PLOT - 2 * PAD));
    const Tx = (bx: number) => bx * view.k + view.tx;
    const Ty = (by: number) => by * view.k + view.ty;
    const gx = (x: number) => Tx(sx(x));
    const gy = (y: number) => Ty(sy(y));

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
            if (k === 1) { tx = 0; ty = 0; }
            return { k, tx, ty };
        });
    }, []);
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
        drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
        movedRef.current = false;
        setDragging(true);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        const start = drag.current;
        if (!start) return;
        const r = svgRef.current!.getBoundingClientRect();
        const dx = ((e.clientX - start.x) / r.width) * PLOT;
        const dy = ((e.clientY - start.y) / r.height) * PLOT;
        if (Math.abs(dx) + Math.abs(dy) > 1) movedRef.current = true;
        setView((v) => ({ ...v, tx: start.tx + dx, ty: start.ty + dy }));
    };
    const endDrag = () => { drag.current = null; setDragging(false); };
    const zoomed = view.k > 1.001;

    const clickNode = (s: Sel) => {
        if (movedRef.current) return; // was a pan, not a click
        onSelect(
            sel && s && sel.type === s.type &&
                (s.type === "person" ? sel.type === "person" && sel.id === s.id : sel.type === "org" && sel.key === (s as any).key)
                ? null
                : s,
        );
    };

    const orgSide = (o: LobbyOrg) => 6 + (o.n_members / maxMembers) * 10;

    const hoverNode =
        hover?.type === "person" ? personById.get(hover.id) : hover?.type === "org" ? orgByKey.get(hover.key) : null;
    const hoverPos =
        hover?.type === "person" && hoverNode && (hoverNode as LobbyPerson).x != null
            ? { x: gx((hoverNode as LobbyPerson).x as number), y: gy((hoverNode as LobbyPerson).y as number) }
            : hover?.type === "org" && hoverNode && (hoverNode as LobbyOrg).x != null
                ? { x: gx((hoverNode as LobbyOrg).x as number), y: gy((hoverNode as LobbyOrg).y as number) }
                : null;

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
                {edges.map((e, i) => {
                    const p = personById.get(e.person_id);
                    const o = orgByKey.get(e.org_key);
                    if (!p || !o) return null;
                    return (
                        <line key={i}
                            x1={gx(p.x as number)} y1={gy(p.y as number)}
                            x2={gx(o.x as number)} y2={gy(o.y as number)}
                            stroke={PAY_COLOR[e.payment]} strokeWidth={0.75}
                            strokeOpacity={dimEdge(e) ? 0.06 : 0.4} />
                    );
                })}
                {[...orgByKey.values()].map((o) => {
                    const s = orgSide(o);
                    const isSel = sel?.type === "org" && sel.key === o.key;
                    return (
                        <rect key={o.key}
                            x={gx(o.x as number) - s / 2} y={gy(o.y as number) - s / 2}
                            width={s} height={s} rx={1.5}
                            fill={ORG_FILL} fillOpacity={dimOrg(o.key) ? 0.15 : 1}
                            stroke={isSel ? "black" : "white"} strokeWidth={isSel ? 1.5 : 0.75}
                            className="cursor-pointer"
                            onClick={() => clickNode({ type: "org", key: o.key })}
                            onMouseEnter={() => setHover({ type: "org", key: o.key })}
                            onMouseLeave={() => setHover(null)} />
                    );
                })}
                {[...personById.values()].map((p) => {
                    const isSel = sel?.type === "person" && sel.id === p.person_id;
                    return (
                        <circle key={p.person_id}
                            cx={gx(p.x as number)} cy={gy(p.y as number)}
                            r={(3.5 + Math.min(3, p.degree * 0.6)) * (isSel ? 1.4 : 1)}
                            fill={colorOf({ party_key: p.party_key, party: p.party })}
                            fillOpacity={dimPerson(p.person_id) ? 0.18 : 0.9}
                            stroke={isSel ? "black" : "white"} strokeWidth={isSel ? 1.5 : 0.75}
                            className="cursor-pointer"
                            onClick={() => clickNode({ type: "person", id: p.person_id })}
                            onMouseEnter={() => setHover({ type: "person", id: p.person_id })}
                            onMouseLeave={() => setHover(null)} />
                    );
                })}
            </svg>

            <div className="absolute right-2 top-2 flex flex-col gap-1" data-print-hide>
                <button type="button" onClick={() => zoomAt(PLOT / 2, PLOT / 2, 1.3)}
                    className="flex size-11 items-center justify-center rounded-md border border-input bg-background/80 text-sm text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={t("alignment_zoom_in")}>+</button>
                <button type="button" onClick={() => zoomAt(PLOT / 2, PLOT / 2, 1 / 1.3)}
                    className="flex size-11 items-center justify-center rounded-md border border-input bg-background/80 text-sm text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={t("alignment_zoom_out")}>−</button>
                {zoomed ? (
                    <button type="button" onClick={() => setView({ k: 1, tx: 0, ty: 0 })}
                        className="flex size-11 items-center justify-center rounded-md border border-input bg-background/80 text-[10px] text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={t("alignment_zoom_reset")}>⟲</button>
                ) : null}
            </div>

            {hover && hoverPos && !dragging ? (
                <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[120%] rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
                    style={{ left: `${(hoverPos.x / PLOT) * 100}%`, top: `${(hoverPos.y / PLOT) * 100}%` }}>
                    {hover.type === "person" ? (
                        <>
                            <div className="font-medium">{(hoverNode as LobbyPerson).fullname ?? "—"}</div>
                            <div className="text-muted-foreground">
                                {(hoverNode as LobbyPerson).party ?? "—"} · {(hoverNode as LobbyPerson).n_interests} {t("lobby_mandates")}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="font-medium">{(hoverNode as LobbyOrg).name ?? "—"}</div>
                            <div className="text-muted-foreground">{(hoverNode as LobbyOrg).n_members} {t("lobby_members_tied")}</div>
                        </>
                    )}
                </div>
            ) : null}
        </div>
    );
}

/* ------------------------------ detail panel ------------------------------ */

function PayDot({ p }: { p: Payment }) {
    return <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: PAY_COLOR[p] }} />;
}

function TiePanel({
    sel,
    people,
    orgs,
    ties,
    colorOf,
    onClose,
    t,
}: {
    sel: Sel;
    people: LobbyPerson[];
    orgs: LobbyOrg[];
    ties: LobbyTie[];
    colorOf: (m: { party_key: string | null; party: string | null }) => string;
    onClose: () => void;
    t: (k: string) => string;
}) {
    const params = useParams();
    if (!sel) return null;
    const personById = new Map(people.map((p) => [p.person_id, p]));

    const rows =
        sel.type === "person"
            ? ties.filter((x) => x.person_id === sel.id)
            : ties.filter((x) => x.org_key === sel.key);

    const title =
        sel.type === "person"
            ? personById.get(sel.id)?.fullname ?? "—"
            : orgs.find((o) => o.key === sel.key)?.name ?? "—";
    const subtitle =
        sel.type === "person"
            ? t("lobby_panel_person")
            : t("lobby_panel_org");

    return (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm font-medium">
                        {sel.type === "person" ? (
                            <InternalLink to={peopleHref(params.lang, sel.id)}>{title}</InternalLink>
                        ) : (
                            <InternalLink to={localizedOrgPath(params.lang, sel.key)}>{title}</InternalLink>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground">{subtitle} · {rows.length}</div>
                </div>
                <button type="button" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label={t("close")}>
                    <Icon name="x" className="size-4" />
                </button>
            </div>
            <ul className="divide-y divide-border/60 text-sm">
                {rows.map((r, i) => {
                    const per = period(r.begin_date, r.end_date);
                    if (sel.type === "person") {
                        return (
                            <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                    <PayDot p={r.payment} />
                                    <InternalLink to={localizedOrgPath(params.lang, r.org_key)} className="block min-w-0 truncate">
                                        {r.org_name ?? "—"}
                                    </InternalLink>
                                    {r.role ? <span className="shrink-0 text-muted-foreground">· {r.role}</span> : null}
                                </span>
                                {per ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{per}</span> : null}
                            </li>
                        );
                    }
                    const m = personById.get(r.person_id);
                    return (
                        <li key={i} className="flex items-center justify-between gap-3 py-1.5">
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                                <PayDot p={r.payment} />
                                <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf({ party_key: m?.party_key ?? null, party: m?.party ?? null }) }} />
                                <InternalLink to={peopleHref(params.lang, r.person_id)} className="block min-w-0 truncate">
                                    {m?.fullname ?? `#${r.person_id}`}
                                </InternalLink>
                                {r.role ? <span className="shrink-0 text-muted-foreground">· {r.role}</span> : null}
                            </span>
                            {per ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{per}</span> : null}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

/* ---------------------------- incidence table ----------------------------- */

/** The matrix itself. Its own component, not a JSX variable: below it is mounted
 *  inside a collapsed <CollapsibleContent>, which renders nothing while closed —
 *  so for a 200-member chamber the ~10k cell elements are never built until the
 *  reader asks for them. A variable would be built on every render regardless. */
function Matrix({
    rowPeople,
    cols,
    cell,
    sel,
    onSelect,
    colorOf,
    t,
    alt,
}: {
    rowPeople: LobbyPerson[];
    cols: LobbyOrg[];
    cell: Map<string, Payment>;
    sel: Sel;
    onSelect: (s: Sel) => void;
    colorOf: (m: { party_key: string | null; party: string | null }) => string;
    t: (k: string) => string;
    alt: string;
}) {
    return (
        <div className="w-full max-w-full overflow-x-auto">
            <table className="border-collapse text-xs">
                <caption className="sr-only">{alt}</caption>
                <thead>
                    <tr>
                        <th className="sticky left-0 z-10 bg-background p-1" />
                        {cols.map((o) => {
                            const selCol = sel?.type === "org" && sel.key === o.key;
                            return (
                                <th key={o.key} className={`p-1 font-normal ${selCol ? "text-foreground" : "text-muted-foreground"}`}>
                                    <button type="button" onClick={() => onSelect(selCol ? null : { type: "org", key: o.key })}
                                        className="[writing-mode:vertical-rl] max-h-32 min-h-11 min-w-11 rotate-180 truncate whitespace-nowrap rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                                        {o.name ?? "—"}
                                    </button>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {rowPeople.map((p) => {
                        const selRow = sel?.type === "person" && sel.id === p.person_id;
                        return (
                            <tr key={p.person_id} className={selRow ? "bg-muted/50" : undefined}>
                                <th className="sticky left-0 z-10 bg-background p-1 pr-2 text-right font-normal">
                                    <button type="button" onClick={() => onSelect(selRow ? null : { type: "person", id: p.person_id })}
                                        className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                                        <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf({ party_key: p.party_key, party: p.party }) }} />
                                        {p.fullname ?? "—"}
                                    </button>
                                </th>
                                {cols.map((o) => {
                                    const pay = cell.get(`${p.person_id}|${o.key}`);
                                    const hl = selRow || (sel?.type === "org" && sel.key === o.key);
                                    return (
                                        <td key={o.key} className={`size-6 border border-border/30 text-center align-middle ${hl ? "bg-muted/40" : ""}`}
                                            title={pay ? `${p.fullname} · ${o.name} — ${t(`interest_${pay}`)}` : undefined}>
                                            {pay ? <span className="inline-block size-2.5 rounded-full" style={{ background: PAY_COLOR[pay] }} /> : null}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function IncidenceTable({
    people,
    orgs,
    edges,
    sel,
    onSelect,
    colorOf,
    t,
    ctx,
}: {
    people: LobbyPerson[];
    orgs: LobbyOrg[];
    edges: LobbyEdge[];
    sel: Sel;
    onSelect: (s: Sel) => void;
    colorOf: (m: { party_key: string | null; party: string | null }) => string;
    t: TFunc;
    ctx: string;
}) {
    const rowPeople = people.filter((p) => p.degree > 0);
    const cols = [...orgs].sort((a, b) => b.n_members - a.n_members);
    const cell = new Map<string, Payment>();
    for (const e of edges) cell.set(`${e.person_id}|${e.org_key}`, e.payment);
    if (rowPeople.length === 0 || cols.length === 0) return null;

    // The ties are downloadable via the page's header Export (the uniform control):
    // the loader joins them in long form; this table is the on-page visualization.
    const heading = (
        <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">{t("lobby_table_heading")}</h3>
        </div>
    );

    // The caption is built here, not in BodyLobby: the matrix drops members with
    // no tie (`rowPeople`), so the network graph's own {members} count is larger.
    // A caption counts the rows the reader is actually given.
    const alt = t("lobby_table_alt", { count: rowPeople.length, orgs: cols.length, ctx });

    const matrix = (
        <Matrix rowPeople={rowPeople} cols={cols} cell={cell} sel={sel} onSelect={onSelect} colorOf={colorOf} t={t} alt={alt} />
    );

    // Small chamber → the matrix is cheap, so show it outright.
    if (rowPeople.length <= 30) {
        return (
            <section className="space-y-2" data-print-hide>
                {heading}
                {matrix}
            </section>
        );
    }

    // Large chambers → the full member × organization matrix is heavy to render;
    // explain it and mount it on demand so the page stays responsive. The real
    // Collapsible (not a hand-rolled toggle) so the trigger carries
    // aria-expanded/aria-controls: this table is the network graph's text
    // equivalent, so AT has to be told it is there.
    return (
        <section className="space-y-2" data-print-hide>
            {heading}
            <Collapsible className="space-y-2">
                <div className="space-y-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <p>
                        {t(
                            "lobby_table_explain",
                        )}
                    </p>
                    <p>
                        {t(
                            "lobby_table_large",
                        )}{" "}
                        <span className="text-foreground">
                            {rowPeople.length} × {cols.length}
                        </span>{" "}
                        {t("lobby_table_cells")}.
                    </p>
                    <CollapsibleTrigger className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                        <Icon name="share-2" className="size-3.5" />
                        {t("lobby_table_show")}
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent>{matrix}</CollapsibleContent>
            </Collapsible>
        </section>
    );
}

/* -------------------------------- breakdown -------------------------------- */

function Breakdown({
    people,
    orgs,
    payment,
    colorOf,
    onSelect,
    t,
}: {
    people: LobbyPerson[];
    orgs: LobbyOrg[];
    payment: { paid: number; unpaid: number; unknown: number };
    colorOf: (m: { party_key: string | null; party: string | null }) => string;
    onSelect: (s: Sel) => void;
    t: (k: string) => string;
}) {
    const params = useParams();
    const total = payment.paid + payment.unpaid + payment.unknown;
    const seg: Array<[Payment, number, string]> = [
        ["paid", payment.paid, t("interest_paid")],
        ["unpaid", payment.unpaid, t("interest_unpaid")],
        ["unknown", payment.unknown, t("lobby_unknown")],
    ];
    const topOrgs = [...orgs].sort((a, b) => b.n_members - a.n_members).slice(0, 12);
    const topMembers = [...people].sort((a, b) => b.n_interests - a.n_interests).slice(0, 12);

    return (
        <div className="space-y-6">
            <section className="space-y-2">
                <h3 className="text-sm font-medium">{t("lobby_payment_heading")}</h3>
                <div className="flex h-3 w-full overflow-hidden rounded">
                    {seg.map(([p, n]) => (n > 0 ? <div key={p} style={{ width: `${(n / total) * 100}%`, background: PAY_COLOR[p] }} /> : null))}
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {seg.map(([p, n, lbl]) => (
                        <li key={p} className="flex items-center gap-1.5">
                            <span className="inline-block size-2.5 rounded-full" style={{ background: PAY_COLOR[p] }} />
                            {lbl} · {n} ({pct(n, total)})
                        </li>
                    ))}
                </ul>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
                <section className="min-w-0 space-y-2">
                    <h3 className="text-sm font-medium">{t("lobby_top_orgs")}</h3>
                    <ul className="divide-y divide-border/60 text-sm">
                        {topOrgs.map((o) => (
                            <li key={o.key} className="flex items-center justify-between gap-3 py-1.5">
                                <InternalLink
                                    to={localizedOrgPath(params.lang, o.key)}
                                    className="block min-w-0 truncate text-left"
                                >
                                    {o.name ?? "—"}
                                </InternalLink>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{o.n_members} {t("lobby_members_tied")}</span>
                            </li>
                        ))}
                        {topOrgs.length === 0 ? <li className="py-2 text-muted-foreground">{t("lobby_no_shared")}</li> : null}
                    </ul>
                </section>

                <section className="min-w-0 space-y-2">
                    <h3 className="text-sm font-medium">{t("lobby_top_members")}</h3>
                    <ul className="divide-y divide-border/60 text-sm">
                        {topMembers.map((m) => (
                            <li key={m.person_id} className="flex items-center justify-between gap-3 py-1.5">
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                    <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf({ party_key: m.party_key, party: m.party }) }} />
                                    <button type="button" onClick={() => (m.degree > 0 ? onSelect({ type: "person", id: m.person_id }) : undefined)}
                                        className="truncate rounded-sm text-left underline-offset-4 outline-none hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                                        {m.fullname ?? "—"}
                                    </button>
                                </span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {m.n_interests}{m.n_paid > 0 ? ` · ${m.n_paid} ${t("interest_paid")}` : ""}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
}

/* -------------------------------- component ------------------------------- */

export default function BodyLobby({
    people,
    orgs,
    edges,
    ties,
    payment,
    chambers = [],
    chamberId = null,
    bodyTitle,
    from,
    to,
    loc = {},
    locale: _locale = "de-CH",
}: BodyLobbyProps) {
    const t = makeT(loc);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [sel, setSel] = React.useState<Sel>(null);
    // Multi-chamber body (CH federal: NR/SR): offer the BOTH / per-chamber switcher.
    const multiChamber = chambers.length >= 2;

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
        () => buildColorMap(people.map((p) => ({ party_key: p.party_key, party: p.party }))),
        [people],
    );

    const empty = people.length === 0;
    const noGraph = orgs.length === 0;

    const [exportOpen, setExportOpen] = React.useState(false);
    const [fsOpen, setFsOpen] = React.useState(false);
    const fileBase = `lobby-network${bodyTitle ? `-${slugify(bodyTitle)}` : ""}`;
    const fsTitle = [t("section_lobby"), bodyTitle].filter(Boolean).join(" · ");
    // Text alternative for the graph: the two node kinds it actually draws, plus
    // the body and (when set) the ?from/?to window the ties are declared in.
    const lobbyCtx = chartCtx(bodyTitle, from, to);
    const networkAlt = t("lobby_network_alt", {
        members: people.length,
        orgs: orgs.length,
        ctx: lobbyCtx,
    });
    const series = React.useMemo(
        () => legend.map((g) => ({ key: g.key, label: g.label, color: g.color })),
        [legend],
    );

    return (
        <div className="w-full min-w-0" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}>
            <Card className="min-w-0 max-w-full" style={{ overflowX: "clip" }}>
                <SectionCardHeader
                    icon="share-2"
                    title={t("section_lobby")}
                    suffix={bodyTitle ? <span className="text-sm font-normal text-muted-foreground">· {bodyTitle}</span> : null}
                    action={
                        !empty && !noGraph ? (
                            <span className="ml-auto flex items-center gap-2">
                                <ChartFullscreenButton loc={loc} onClick={() => setFsOpen(true)} />
                                <ChartExportButton loc={loc} onClick={() => setExportOpen(true)} />
                            </span>
                        ) : null
                    }
                    subtitleClassName="mt-1 text-sm text-muted-foreground"
                    subtitle={t(
                        "lobby_subtitle",
                    )}
                />

                <CardContent className="space-y-6">
                    <div data-print-hide>
                        <ControlGroup label={t("lobby_filters")} className="max-w-xs">
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
                            <ControlRow label={t("alignment_from")} bleed>
                                <input type="date" id={`${dateId}-from`} name="from" value={from ?? ""} max={to ?? undefined}
                                    onChange={(e) => setParams({ from: e.target.value || null })} className={ghostDateField} aria-label={t("alignment_from")} />
                            </ControlRow>
                            <ControlRow label={t("alignment_to")} bleed>
                                <input type="date" id={`${dateId}-to`} name="to" value={to ?? ""} min={from ?? undefined}
                                    onChange={(e) => setParams({ to: e.target.value || null })} className={ghostDateField} aria-label={t("alignment_to")} />
                            </ControlRow>
                        </ControlGroup>
                    </div>

                    {empty ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            {t("lobby_empty")}
                        </p>
                    ) : (
                        <>
                            {noGraph ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    {t("lobby_no_shared")}
                                </p>
                            ) : (
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <Network people={people} orgs={orgs} edges={edges} colorOf={colorOf} sel={sel} onSelect={setSel} t={t} alt={networkAlt} />
                                        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <li className="flex items-center gap-1.5">
                                                <span className="inline-block size-2.5 rounded-sm" style={{ background: ORG_FILL }} />
                                                {t("lobby_org_node")}
                                            </li>
                                            {legend.slice(0, 8).map((g) => (
                                                <li key={g.key} className="flex items-center gap-1.5">
                                                    <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                                                    {g.label}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="w-full min-w-0 lg:w-80">
                                        {sel ? (
                                            <TiePanel sel={sel} people={people} orgs={orgs} ties={ties} colorOf={colorOf} onClose={() => setSel(null)} t={t} />
                                        ) : (
                                            <p className="hidden text-sm text-muted-foreground lg:block">
                                                {t("lobby_select_hint")}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <Breakdown people={people} orgs={orgs} payment={payment} colorOf={colorOf} onSelect={setSel} t={t} />

                            {!noGraph ? (
                                <IncidenceTable people={people} orgs={orgs} edges={edges} sel={sel} onSelect={setSel} colorOf={colorOf} t={t} ctx={lobbyCtx} />
                            ) : null}
                        </>
                    )}

                    <AttributionFooter t={t} anchor="lobby" className="border-t pt-3 text-xs text-muted-foreground" />
                </CardContent>
            </Card>

            <ChartExportDialog
                open={exportOpen}
                onClose={() => setExportOpen(false)}
                loc={loc}
                filename={fileBase}
                series={series}
                defaultTitle={t("section_lobby")}
                defaultSubtitle={bodyTitle ?? undefined}
                legend
            >
                {(cx) => (
                    <Network
                        people={people}
                        orgs={orgs}
                        edges={edges}
                        colorOf={(m) => cx.colorFor(m.party_key ?? m.party)}
                        sel={sel}
                        onSelect={setSel}
                        t={t}
                        alt={networkAlt}
                        fill={cx.fullscreen}
                    />
                )}
            </ChartExportDialog>

            <FullscreenChart
                open={fsOpen}
                onClose={() => setFsOpen(false)}
                title={fsTitle}
                loc={loc}
                toolbar={
                    sel ? (
                        <button
                            type="button"
                            onClick={() => setSel(null)}
                            className="inline-flex h-11 items-center rounded-md border border-input bg-background px-2.5 text-xs text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            {t("lobby_clear_selection")}
                        </button>
                    ) : null
                }
            >
                <div className="relative h-full w-full">
                    <div className="flex h-full w-full items-center justify-center">
                        <Network people={people} orgs={orgs} edges={edges} colorOf={colorOf} sel={sel} onSelect={setSel} t={t} alt={networkAlt} fill />
                    </div>
                    {sel ? (
                        <div className="absolute right-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-80 max-w-[calc(100vw-1.5rem)] overflow-auto rounded-lg bg-background shadow-lg">
                            <TiePanel sel={sel} people={people} orgs={orgs} ties={ties} colorOf={colorOf} onClose={() => setSel(null)} t={t} />
                        </div>
                    ) : null}
                </div>
            </FullscreenChart>
        </div>
    );
}