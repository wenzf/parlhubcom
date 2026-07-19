// BodyVotings.tsx  → ~/components/opd_views/bodies/BodyVotings.tsx
//
// The votings held in ONE body — the /bodies/:id/votings feed. Thin wrapper over
// the shared <FeedShell> rendering the shared <VotingRow>. Each row links to its
// voting and (when present) its parent affair.

import * as React from "react";
import { useParams } from "react-router";
import type { VotingClient } from "@/types/opd_db";
import type { BodyChamber, PaginatedList } from "@/types/opd_paginated_client";
import { bodyVotingsDescriptor, withCodeOptions } from "~/lib/dimensions/descriptors";
import { affairHref, votingHref } from "~/lib/urls/hrefs";

import { makeT } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { VotingRow } from "../_shared/rows/VotingRow";

export interface BodyVotingsProps {
    votings: PaginatedList<VotingClient>;
    /** The body's voting chambers (SQL `chambers` output). The chamber facet and
     *  per-row chamber label render only with ≥ 2 (i.e. CH federal: NR/SR). */
    chambers?: BodyChamber[];
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    /** Kept for API compatibility; the feed link derives from route params. */
    bodyId?: number;
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function BodyVotings({
    votings,
    chambers,
    loc = {},
    locale = "de-CH",
    variant = "page",
    bodyId: _bodyId,
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: BodyVotingsProps) {
    const { lang } = useParams();
    const t = makeT(loc);

    // Multi-chamber body (CH federal): inject the chamber facet options (stable
    // value = the chamber's group id). Single-chamber / unknown: drop the facet —
    // filtering by the only chamber is meaningless.
    const multiChamber = (chambers?.length ?? 0) >= 2;
    const descriptor = React.useMemo(
        () =>
            multiChamber
                ? withCodeOptions(
                    bodyVotingsDescriptor,
                    "chamber",
                    (chambers ?? []) as unknown as Record<string, unknown>[],
                    "id",
                    (r) => {
                        const c = r as unknown as BodyChamber;
                        return c.name ?? c.abbreviation ?? String(c.id);
                    },
                )
                : {
                    ...bodyVotingsDescriptor,
                    facets: bodyVotingsDescriptor.facets.filter(
                        (f) => !(f.kind === "select" && f.param === "chamber"),
                    ),
                },
        [multiChamber, chambers],
    );

    // group_id → chamber label for the per-row meta (multi-chamber feeds only).
    const chamberById = React.useMemo(() => {
        const m = new Map<number, string>();
        if (multiChamber)
            for (const c of chambers ?? [])
                m.set(c.id, c.abbreviation ?? c.name ?? String(c.id));
        return m;
    }, [multiChamber, chambers]);

    return (
        <FeedShell
            descriptor={descriptor}
            feedNs="NS_BODIES_VOTINGS"
            icon="landmark"
            titleKey="body_votings_title"
            titleFallback="Votings"
            emptyKey="no_votings"
            emptyFallback="No recorded votings."
            noResultsFallback="No votings match your search."
            viewAllKey="view_all_votings"
            viewAllFallback="View all votings"
            mcpNamespace="body"
            mcpSubject="this institution's"
            list={votings}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            className={className}
            renderRow={(v) => (
                <VotingRow
                    key={v.id}
                    voting={v}
                    t={t}
                    locale={locale}
                    href={votingHref(lang, v.id)}
                    chamber={v.group_id != null ? chamberById.get(v.group_id) ?? null : null}
                    affairHref={
                        v.affair_id != null
                            ? affairHref(lang, v.affair_id)
                            : null
                    }
                />
            )}
        />
    );
}

export default BodyVotings;