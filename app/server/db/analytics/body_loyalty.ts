"server-only";
// body_loyalty.ts                 → ~/server/db/body_loyalty.ts
//
// /bodies/:id/loyalty runner. Runs body_loyalty_by_id.sql (body base block +
// the per-member dissent-rate aggregation) in one localized query. The member
// set is bounded by the chamber (≤ a few hundred), so it's returned WHOLE — the
// beeswarm + the sortable table both read the full list; no pagination.
//
// Server-only (touches DuckDB).

import body_loyalty_by_id from "~/server/db/sql/bodies/body_loyalty_by_id.sql?raw";
import { runByIdLocalizedRaw } from "../core/runner";
import { mapMemberBase, type MemberBase } from "./members";
import type { BodyClient } from "@/types/opd_db";
import type { BodyChamber } from "@/types/opd_paginated_client";

export interface LoyaltyMember extends MemberBase {
    n_ballots: number;
    n_dissents: number;
    dissent_rate: number; // 0..1
}

export interface GroupCohesion {
    group_key: string | null;
    group: string | null;
    n_ballots: number;
    cohesion: number; // 0..1 (Agreement Index, mean over ballots)
}

export interface BodyLoyaltyResult {
    body: BodyClient;
    loyalty: { total_count: number; items: LoyaltyMember[] };
    cohesion: { items: GroupCohesion[] };
    /** The body's voting chambers; ≥ 2 → the BOTH/per-chamber switcher renders. */
    chambers: BodyChamber[];
}

export interface BodyLoyaltyOptions {
    bodyId: number;
    langs: string[];
    /** Epoch-ms bounds (compared against votings.date, a DOUBLE) or null = open. */
    from: number | null;
    to: number | null;
    /** votings.group_id to scope to one chamber, or null = BOTH (pool chambers). */
    chamber?: number | null;
    minGroup?: number; // decisive voters a group needs on a ballot to count
    minBallots?: number; // counted ballots a member needs to appear
}

const MIN_GROUP = 4;
const MIN_BALLOTS = 10;

export async function runBodyLoyalty(
    opts: BodyLoyaltyOptions,
): Promise<BodyLoyaltyResult | null> {
    const {
        bodyId,
        langs,
        from,
        to,
        chamber = null,
        minGroup = MIN_GROUP,
        minBallots = MIN_BALLOTS,
    } = opts;

    // $1 body id + $2..$6 langs, then $7 window_start / $8 window_end (epoch-ms,
    // nullable) / $9 min_group / $10 min_ballots / $11 chamber (nullable = BOTH).
    const row = await runByIdLocalizedRaw<BodyLoyaltyResult>(body_loyalty_by_id, {
        id: bodyId,
        langs,
        params: [
            { type: "double", value: from },
            { type: "double", value: to },
            { type: "integer", value: minGroup },
            { type: "integer", value: minBallots },
            { type: "integer", value: chamber },
        ],
    });
    if (!row) return null;

    // Coerce the aggregate numerics (BIGINT/DOUBLE arrive JSON-typed).
    const items: LoyaltyMember[] = (row.loyalty?.items ?? []).map((m) => ({
        ...mapMemberBase(m),
        n_ballots: Number(m.n_ballots),
        n_dissents: Number(m.n_dissents),
        dissent_rate: Number(m.dissent_rate),
    }));

    const cohesion: GroupCohesion[] = ((row as any).cohesion?.items ?? []).map(
        (c: any) => ({
            group_key: c.group_key ?? null,
            group: c.group ?? null,
            n_ballots: Number(c.n_ballots),
            cohesion: Number(c.cohesion),
        }),
    );

    const chambers: BodyChamber[] = ((row as any).chambers ?? []).map((c: any) => ({
        id: Number(c.id),
        name: c.name ?? null,
        abbreviation: c.abbreviation ?? null,
    }));

    return {
        body: row.body,
        loyalty: { total_count: Number(row.loyalty?.total_count ?? items.length), items },
        cohesion: { items: cohesion },
        chambers,
    };
}