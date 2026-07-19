"server-only";
// body_alignment.ts               → ~/server/db/body_alignment.ts
//
// /bodies/:id/alignment runner. Runs body_alignment_by_id.sql (body base block +
// the member×member pairwise agreement + party×party matrix) in one localized
// query, then finishes the 2-D SCATTER here: classical MDS on the member distance
// matrix (distance = 1 − agreement), which SQL can't do. Returns members with
// (x, y) coordinates in [-1, 1], the party×party matrix for the heatmap, and the
// party legend. The bulky raw `pairs` list is consumed here and NOT forwarded to
// the client.
//
// The member set is bounded by the chamber (≤ a few hundred), so everything is
// returned WHOLE — no pagination. Server-only (touches DuckDB). Mirrors
// body_loyalty.ts.

import body_alignment_by_id from "~/server/db/sql/bodies/body_alignment_by_id.sql?raw";
import { runByIdLocalizedRaw } from "../core/runner";
import { mapMemberBase, type MemberBase } from "./members";
import type { BodyClient } from "@/types/opd_db";
import type { BodyChamber } from "@/types/opd_paginated_client";

export interface AlignmentMember extends MemberBase {
    n_ballots: number;
    /** mean pairwise agreement with the rest of the chamber (0..1), or null. */
    avg_agreement: number | null;
    /** mean pairwise agreement with own-party colleagues (0..1), or null. */
    avg_own_party: number | null;
    /** MDS coordinates, in [-1, 1]. Null when MDS could not place the member. */
    x: number | null;
    y: number | null;
}

export interface PartyCell {
    party_a: string;
    party_b: string;
    agreement: number; // 0..1 (mean pairwise agreement; a==b = intra-party cohesion)
    n: number; // member-pairs behind the cell
    /** 95% confidence half-width on the mean (1.96·sd/√n); 0 when n<2. Lower = more
     *  significant / reliable. */
    ci: number;
}

export interface AlignmentParty {
    party_key: string;
    party: string | null;
    size: number;
}

export interface BodyAlignmentResult {
    body: BodyClient;
    members: { total_count: number; items: AlignmentMember[] };
    partyMatrix: PartyCell[];
    parties: AlignmentParty[];
    /** The body's voting chambers; < 2 = single-chamber (switcher hidden). */
    chambers: BodyChamber[];
    /** Effective chamber scope the matrix was computed on (SQL-resolved:
     *  explicit ?chamber, else the busiest chamber of a multi-chamber body,
     *  else null = unscoped). */
    chamberId: number | null;
}

export interface BodyAlignmentOptions {
    bodyId: number;
    langs: string[];
    from: number | null; // epoch-ms (votings.date >=) or null = open
    to: number | null; // epoch-ms (votings.date <=) or null = open
    minShared?: number; // pair floor
    minBallots?: number; // member floor
    chamber?: number | null; // votings.group_id, or null = auto (see chamberId)
}

const MIN_SHARED = 20;
const MIN_BALLOTS = 20;

interface RawPair {
    a: number;
    b: number;
    agreement: number;
}

export async function runBodyAlignment(
    opts: BodyAlignmentOptions,
): Promise<BodyAlignmentResult | null> {
    const {
        bodyId,
        langs,
        from,
        to,
        minShared = MIN_SHARED,
        minBallots = MIN_BALLOTS,
        chamber = null,
    } = opts;

    // $1 body id + $2..$6 langs, then $7 from / $8 to (epoch-ms, nullable) /
    // $9 min_shared / $10 min_ballots / $11 chamber (nullable).
    const row = await runByIdLocalizedRaw<any>(body_alignment_by_id, {
        id: bodyId,
        langs,
        params: [
            { type: "double", value: from },
            { type: "double", value: to },
            { type: "integer", value: minShared },
            { type: "integer", value: minBallots },
            { type: "integer", value: chamber },
        ],
    });
    if (!row) return null;

    const rawMembers = (row.members?.items ?? []) as any[];
    const rawPairs = (row.pairs?.items ?? []) as RawPair[];

    // ── per-member averages (mean agreement to chamber + within own party) ────
    const partyOf = new Map<number, string | null>(
        rawMembers.map((m) => [Number(m.person_id), m.party_key ?? null]),
    );
    const acc = new Map<number, { all: number; allN: number; own: number; ownN: number }>();
    const bump = (id: number, agr: number, sameParty: boolean) => {
        const a = acc.get(id) ?? { all: 0, allN: 0, own: 0, ownN: 0 };
        a.all += agr;
        a.allN += 1;
        if (sameParty) {
            a.own += agr;
            a.ownN += 1;
        }
        acc.set(id, a);
    };
    for (const p of rawPairs) {
        const pa = partyOf.get(p.a) ?? null;
        const pb = partyOf.get(p.b) ?? null;
        const same = pa != null && pa === pb;
        bump(p.a, p.agreement, same);
        bump(p.b, p.agreement, same);
    }

    // ── classical MDS → (x, y) per member ────────────────────────────────────
    const ids = rawMembers.map((m) => Number(m.person_id));
    const coords = classicalMDS(ids, rawPairs);

    const members: AlignmentMember[] = rawMembers.map((m, i) => {
        const base = mapMemberBase(m);
        const a = acc.get(base.person_id);
        return {
            ...base,
            n_ballots: Number(m.n_ballots),
            avg_agreement: a && a.allN ? a.all / a.allN : null,
            avg_own_party: a && a.ownN ? a.own / a.ownN : null,
            x: coords[i]?.[0] ?? null,
            y: coords[i]?.[1] ?? null,
        };
    });

    const partyMatrix: PartyCell[] = (row.party_matrix?.items ?? []).map(
        (c: any) => {
            const n = Number(c.n);
            const sd = c.sd == null ? 0 : Number(c.sd);
            return {
                party_a: c.party_a,
                party_b: c.party_b,
                agreement: Number(c.agreement),
                n,
                ci: n > 1 ? (1.96 * sd) / Math.sqrt(n) : 0,
            };
        },
    );

    const parties: AlignmentParty[] = (row.parties?.items ?? []).map((p: any) => ({
        party_key: p.party_key,
        party: p.party ?? null,
        size: Number(p.size),
    }));

    const chambers: BodyChamber[] = (row.chambers ?? []).map((c: any) => ({
        id: Number(c.id),
        name: c.name ?? null,
        abbreviation: c.abbreviation ?? null,
    }));

    return {
        body: row.body,
        members: {
            total_count: Number(row.members?.total_count ?? members.length),
            items: members,
        },
        partyMatrix,
        parties,
        chambers,
        chamberId: row.chamber_id == null ? null : Number(row.chamber_id),
    };
}

/* ------------------------------ classical MDS ----------------------------- */
//
// distance d_ij = 1 − agreement_ij (missing pair → 1, the max). Classical MDS:
// B = −½ J (D∘D) J with J = I − 11ᵀ/n; the top-2 eigenvectors of B (scaled by
// √λ) are the coordinates. We only need the top 2, so power iteration + one
// deflation is enough — far cheaper than a full eigensolver, and n ≤ a few
// hundred. Coordinates are normalised into [−1, 1].

function classicalMDS(
    ids: number[],
    pairs: RawPair[],
): Array<[number, number] | null> {
    const n = ids.length;
    if (n === 0) return [];
    if (n < 3) return ids.map(() => [0, 0] as [number, number]);

    const index = new Map<number, number>();
    ids.forEach((id, i) => index.set(id, i));

    // squared distance matrix (default 1 = max distance for unscored pairs)
    const D2: number[][] = Array.from({ length: n }, () => new Array(n).fill(1));
    for (let i = 0; i < n; i++) D2[i][i] = 0;
    for (const p of pairs) {
        const i = index.get(p.a);
        const j = index.get(p.b);
        if (i == null || j == null) continue;
        const d = 1 - p.agreement;
        const d2 = d * d;
        D2[i][j] = d2;
        D2[j][i] = d2;
    }

    // double centering → B
    const rowMean = new Array(n).fill(0);
    let grand = 0;
    for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += D2[i][j];
        rowMean[i] = s / n;
        grand += s;
    }
    grand /= n * n;
    const B: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
            B[i][j] = -0.5 * (D2[i][j] - rowMean[i] - rowMean[j] + grand);

    // Classical MDS needs the top-2 POSITIVE eigenvalues of B. But B is not
    // guaranteed positive-semidefinite — agreement distances are non-Euclidean, so
    // small or lopsided windows (e.g. a mostly-unanimous chamber) can give B a large
    // NEGATIVE eigenvalue. Power iteration returns the largest-MAGNITUDE eigenvalue,
    // which can be that negative one; scaled by √max(λ,0) it then collapsed a whole
    // axis to 0 → every dot on a single line. Fix: shift B by an upper bound on its
    // spectral radius (Gershgorin: max abs row sum) so Bs = B + σI is PSD; the two
    // largest eigenvalues of Bs are then the two MOST-POSITIVE of B (subtract σ back).
    let sigma = 0;
    for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += Math.abs(B[i][j]);
        if (s > sigma) sigma = s;
    }
    for (let i = 0; i < n; i++) B[i][i] += sigma;

    const e1 = powerIteration(B, n);
    deflate(B, n, e1.value, e1.vector);
    const e2 = powerIteration(B, n);

    // Canonical sign: eigenvectors are defined only up to sign, so pin each so its
    // largest-magnitude entry is positive — otherwise the map flips between loads.
    canonicalSign(e1.vector);
    canonicalSign(e2.vector);

    // undo the shift: λ(B) = λ(Bs) − σ. A still-negative λ means that axis carries
    // no real (Euclidean) signal, so it legitimately flattens to 0.
    const s1 = Math.sqrt(Math.max(e1.value - sigma, 0));
    const s2 = Math.sqrt(Math.max(e2.value - sigma, 0));
    const xs = e1.vector.map((v) => v * s1);
    const ys = e2.vector.map((v) => v * s2);

    // normalise into [-1, 1] using the larger spread so aspect ratio is preserved
    const maxAbs = Math.max(
        1e-9,
        ...xs.map(Math.abs),
        ...ys.map(Math.abs),
    );
    return ids.map((_, i) => [xs[i] / maxAbs, ys[i] / maxAbs] as [number, number]);
}

function powerIteration(
    M: number[][],
    n: number,
    iters = 200,
): { value: number; vector: number[] } {
    // Deterministic seed (was Math.random → map flipped/rotated every refresh).
    // A smooth, index-varying vector is non-degenerate w.r.t. the top eigenvector.
    let v = new Array(n).fill(0).map((_, i) => Math.sin(i + 1));
    normalise(v);
    let value = 0;
    for (let it = 0; it < iters; it++) {
        const w = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            let s = 0;
            const row = M[i];
            for (let j = 0; j < n; j++) s += row[j] * v[j];
            w[i] = s;
        }
        value = norm(w);
        if (value < 1e-12) break;
        for (let i = 0; i < n; i++) w[i] /= value;
        if (dot(w, v) < 0) value = -value; // sign for eigenvalue estimate
        v = w;
    }
    return { value, vector: v };
}

/** Flip a vector so its largest-magnitude entry is positive — a deterministic,
 *  data-independent orientation, so the scatter looks the same on every load. */
function canonicalSign(v: number[]): void {
    let mi = 0;
    for (let i = 1; i < v.length; i++) if (Math.abs(v[i]) > Math.abs(v[mi])) mi = i;
    if (v[mi] < 0) for (let i = 0; i < v.length; i++) v[i] = -v[i];
}

function deflate(M: number[][], n: number, lambda: number, v: number[]): void {
    for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) M[i][j] -= lambda * v[i] * v[j];
}

function dot(a: number[], b: number[]): number {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
}
function norm(a: number[]): number {
    return Math.sqrt(dot(a, a));
}
function normalise(a: number[]): void {
    const nrm = norm(a) || 1;
    for (let i = 0; i < a.length; i++) a[i] /= nrm;
}