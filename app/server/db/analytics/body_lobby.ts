"server-only";
// body_lobby.ts                   → ~/server/db/body_lobby.ts
//
// /bodies/:id/lobby runner. Runs body_lobby_by_id.sql (body base block + the
// person↔organization shared-tie graph + payment breakdown), then lays out the
// force-directed graph HERE (SQL can't): a deterministic Fruchterman–Reingold
// pass places every person + shared-org node in [-1,1]², so members who share
// lobby ties pull together and coalition clusters emerge. Positions are stable
// across reloads (fixed circular seed, no randomness).
//
// The member set is bounded by the chamber and the shared-org pruning keeps the
// graph to its connective tissue, so everything is returned WHOLE. Server-only.

import body_lobby_by_id from "~/server/db/sql/bodies/body_lobby_by_id.sql?raw";
import { runByIdLocalizedRaw } from "../core/runner";
import type { BodyClient } from "@/types/opd_db";
import type { BodyChamber } from "@/types/opd_paginated_client";

export type Payment = "paid" | "unpaid" | "unknown";

export interface LobbyPerson {
    person_id: number;
    fullname: string | null;
    party: string | null;
    party_key: string | null;
    n_interests: number;
    n_paid: number;
    degree: number; // shared-org ties
    x: number | null; // graph coords, null when not in the graph (degree 0)
    y: number | null;
}

export interface LobbyOrg {
    key: string;
    name: string | null;
    n_members: number;
    x: number | null;
    y: number | null;
}

export interface LobbyEdge {
    person_id: number;
    org_key: string;
    payment: Payment;
}

export interface LobbyTie {
    person_id: number;
    org_key: string;
    org_name: string | null;
    role: string | null;
    payment: Payment;
    begin_date: number | null;
    end_date: number | null;
}

export interface BodyLobbyResult {
    body: BodyClient;
    people: { total_count: number; items: LobbyPerson[] };
    orgs: LobbyOrg[];
    edges: LobbyEdge[];
    ties: LobbyTie[];
    payment: { paid: number; unpaid: number; unknown: number };
    /** The body's voting chambers; ≥ 2 → the BOTH/per-chamber switcher renders. */
    chambers: BodyChamber[];
}

export interface BodyLobbyOptions {
    bodyId: number;
    langs: string[];
    from: number | null;
    to: number | null;
    /** groups.id to scope to one chamber (via membership), or null = BOTH. */
    chamber?: number | null;
    minMembers?: number; // shared-org threshold
}

const MIN_MEMBERS = 2;

/** Raw graph payload straight from SQL — everything EXCEPT the force-directed
 *  node positions. Cheap to produce; used so the route can stream the expensive
 *  layout separately (the body base block is available immediately). */
export interface BodyLobbyRaw {
    body: BodyClient;
    peopleTotal: number;
    rawPeople: any[];
    rawOrgs: any[];
    edges: LobbyEdge[];
    ties: LobbyTie[];
    payment: { paid: number; unpaid: number; unknown: number };
    chambers: BodyChamber[];
}

/** The layout-dependent half of the payload (positions baked in). */
export type BodyLobbyNetwork = Omit<BodyLobbyResult, "body">;

/** Stage 1 (fast): run the SQL and parse the raw graph. No force layout. */
export async function runBodyLobbyData(
    opts: BodyLobbyOptions,
): Promise<BodyLobbyRaw | null> {
    const { bodyId, langs, from, to, chamber = null, minMembers = MIN_MEMBERS } = opts;

    // $1 body id + $2..$6 langs, then $7 min_members / $8 from / $9 to (epoch-ms,
    // nullable) / $10 chamber (nullable = BOTH). NOTE: min_members precedes the
    // window bounds here.
    const row = await runByIdLocalizedRaw<any>(body_lobby_by_id, {
        id: bodyId,
        langs,
        params: [
            { type: "integer", value: minMembers },
            { type: "double", value: from },
            { type: "double", value: to },
            { type: "integer", value: chamber },
        ],
    });
    if (!row) return null;

    const rawPeople = (row.people?.items ?? []) as any[];
    const rawOrgs = (row.orgs?.items ?? []) as any[];
    const edges: LobbyEdge[] = (row.edges?.items ?? []).map((e: any) => ({
        person_id: Number(e.person_id),
        org_key: String(e.org_key),
        payment: (e.payment ?? "unknown") as Payment,
    }));
    const ties: LobbyTie[] = (row.ties?.items ?? []).map((tt: any) => ({
        person_id: Number(tt.person_id),
        org_key: String(tt.org_key),
        org_name: tt.org_name ?? null,
        role: tt.role ?? null,
        payment: (tt.payment ?? "unknown") as Payment,
        begin_date: tt.begin_date == null ? null : Number(tt.begin_date),
        end_date: tt.end_date == null ? null : Number(tt.end_date),
    }));

    const chambers: BodyChamber[] = (row.chambers ?? []).map((c: any) => ({
        id: Number(c.id),
        name: c.name ?? null,
        abbreviation: c.abbreviation ?? null,
    }));

    return {
        body: row.body,
        peopleTotal: Number(row.people?.total_count ?? rawPeople.length),
        rawPeople,
        rawOrgs,
        edges,
        ties,
        payment: {
            paid: Number(row.payment?.paid ?? 0),
            unpaid: Number(row.payment?.unpaid ?? 0),
            unknown: Number(row.payment?.unknown ?? 0),
        },
        chambers,
    };
}

/** Stage 2 (expensive, synchronous CPU): run the Fruchterman–Reingold layout and
 *  attach [-1,1]² coordinates. Split out so it can be deferred / streamed. */
export function layoutBodyLobby(raw: BodyLobbyRaw): BodyLobbyNetwork {
    const { rawPeople, rawOrgs, edges, ties, payment, peopleTotal, chambers } = raw;

    const personIds = rawPeople
        .filter((p) => Number(p.degree) > 0)
        .map((p) => Number(p.person_id));
    const orgKeys = rawOrgs.map((o) => String(o.key));
    const coords = forceLayout(personIds, orgKeys, edges);

    const people: LobbyPerson[] = rawPeople.map((p) => {
        const id = Number(p.person_id);
        const c = coords.person.get(id);
        return {
            person_id: id,
            fullname: p.fullname ?? null,
            party: p.party ?? null,
            party_key: p.party_key ?? null,
            n_interests: Number(p.n_interests),
            n_paid: Number(p.n_paid),
            degree: Number(p.degree),
            x: c?.[0] ?? null,
            y: c?.[1] ?? null,
        };
    });

    const orgs: LobbyOrg[] = rawOrgs.map((o) => {
        const key = String(o.key);
        const c = coords.org.get(key);
        return {
            key,
            name: o.name ?? null,
            n_members: Number(o.n_members),
            x: c?.[0] ?? null,
            y: c?.[1] ?? null,
        };
    });

    return {
        people: { total_count: peopleTotal, items: people },
        orgs,
        edges,
        ties,
        payment,
        chambers,
    };
}

/* --------------------- Fruchterman–Reingold (deterministic) --------------- */

interface Node {
    x: number;
    y: number;
    dx: number;
    dy: number;
}

function forceLayout(
    personIds: number[],
    orgKeys: string[],
    edges: LobbyEdge[],
): { person: Map<number, [number, number]>; org: Map<string, [number, number]> } {
    const idOf = new Map<string, number>();
    const key = (t: "p" | "o", v: string | number) => `${t}${v}`;
    personIds.forEach((id) => idOf.set(key("p", id), idOf.size));
    orgKeys.forEach((k) => idOf.set(key("o", k), idOf.size));
    const n = idOf.size;

    const person = new Map<number, [number, number]>();
    const org = new Map<string, [number, number]>();
    if (n === 0) return { person, org };

    // edges as index pairs (skip endpoints not in the graph)
    const E: Array<[number, number]> = [];
    for (const e of edges) {
        const a = idOf.get(key("p", e.person_id));
        const b = idOf.get(key("o", e.org_key));
        if (a != null && b != null) E.push([a, b]);
    }

    // deterministic seed: evenly on a circle (stable across reloads)
    const nodes: Node[] = Array.from({ length: n }, (_, i) => {
        const a = (2 * Math.PI * i) / n;
        return { x: 0.5 * Math.cos(a), y: 0.5 * Math.sin(a), dx: 0, dy: 0 };
    });

    const AREA = 4; // unit square is [-1,1]²
    const k = Math.sqrt(AREA / n); // ideal edge length
    const iters = 300;
    let temp = 0.25;

    for (let it = 0; it < iters; it++) {
        for (const nd of nodes) { nd.dx = 0; nd.dy = 0; }

        // repulsion (all pairs)
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                let ddx = nodes[i].x - nodes[j].x;
                let ddy = nodes[i].y - nodes[j].y;
                let dist = Math.hypot(ddx, ddy) || 1e-4;
                const rep = (k * k) / dist;
                ddx /= dist; ddy /= dist;
                nodes[i].dx += ddx * rep; nodes[i].dy += ddy * rep;
                nodes[j].dx -= ddx * rep; nodes[j].dy -= ddy * rep;
            }
        }
        // attraction (edges)
        for (const [a, b] of E) {
            let ddx = nodes[a].x - nodes[b].x;
            let ddy = nodes[a].y - nodes[b].y;
            const dist = Math.hypot(ddx, ddy) || 1e-4;
            const att = (dist * dist) / k;
            ddx /= dist; ddy /= dist;
            nodes[a].dx -= ddx * att; nodes[a].dy -= ddy * att;
            nodes[b].dx += ddx * att; nodes[b].dy += ddy * att;
        }
        // integrate, capped by temperature (cooling)
        for (const nd of nodes) {
            const disp = Math.hypot(nd.dx, nd.dy) || 1e-4;
            nd.x += (nd.dx / disp) * Math.min(disp, temp);
            nd.y += (nd.dy / disp) * Math.min(disp, temp);
        }
        temp = Math.max(0.02, temp * 0.985);
    }

    // normalize into [-1,1]
    let maxAbs = 1e-6;
    for (const nd of nodes) maxAbs = Math.max(maxAbs, Math.abs(nd.x), Math.abs(nd.y));
    const norm = (v: number) => v / maxAbs;

    personIds.forEach((id) => {
        const nd = nodes[idOf.get(key("p", id))!];
        person.set(id, [norm(nd.x), norm(nd.y)]);
    });
    orgKeys.forEach((kk) => {
        const nd = nodes[idOf.get(key("o", kk))!];
        org.set(kk, [norm(nd.x), norm(nd.y)]);
    });
    return { person, org };
}