// AffairVotings.tsx  → ~/components/opd_views/affairs/AffairVotings.tsx
//
// The votings linked to ONE affair — the /affairs/:id/votings feed. Thin wrapper
// over the shared <FeedShell> (Card + controls + pager + snippet "view all" +
// CC-BY) rendering the shared <VotingRow>. The affair is fixed, so the per-row
// parent-affair link is omitted. Purely presentational — no structured data.

import { useParams } from "react-router";
import type { VotingClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { affairVotingsDescriptor } from "~/lib/dimensions/descriptors";
import { votingHref } from "~/lib/urls/hrefs";

import { makeT } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { VotingRow } from "../_shared/rows/VotingRow";

export interface AffairVotingsProps {
    votings: PaginatedList<VotingClient>;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    /** Kept for API compatibility; the feed link derives from route params. */
    affairId?: number;
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function AffairVotings({
    votings,
    loc = {},
    locale = "de-CH",
    variant = "page",
    affairId: _affairId,
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: AffairVotingsProps) {
    const { lang } = useParams();
    const t = makeT(loc);
    return (
        <FeedShell
            descriptor={affairVotingsDescriptor}
            feedNs="NS_AFFAIRS_VOTINGS"
            icon="vote"
            titleKey="body_votings_title"
            titleFallback="Votings"
            emptyKey="no_votings"
            emptyFallback="No recorded votings."
            noResultsFallback="No votings match your search."
            viewAllKey="view_all_votings"
            viewAllFallback="View all votings"
            mcpNamespace="affair"
            mcpSubject="this affair's"
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
                />
            )}
        />
    );
}

export default AffairVotings;