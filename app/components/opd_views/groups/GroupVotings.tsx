// GroupVotings.tsx  → ~/components/opd_views/groups/GroupVotings.tsx
//
// The votings held by ONE group — the /groups/:id/votings feed. Thin wrapper over
// the shared <FeedShell> rendering the shared <VotingRow>. Each row shows its
// body (from the response-scoped `bodies` lookup) and links to the voting and
// its parent affair.

import * as React from "react";
import { useParams } from "react-router";
import type { VotingClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { groupVotingsDescriptor } from "~/lib/dimensions/descriptors";
import { affairHref, votingHref } from "~/lib/urls/hrefs";

import { makeT, keyById } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { VotingRow } from "../_shared/rows/VotingRow";

export interface GroupVotingsProps {
    votings: PaginatedList<VotingClient>;
    /** Response-scoped body lookup (`dat.bodies.items`), keyed by id. */
    bodies?: BodyClient[] | undefined;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    /** Kept for API compatibility; the feed link derives from route params. */
    groupId?: number;
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function GroupVotings({
    votings,
    bodies,
    loc = {},
    locale = "de-CH",
    variant = "page",
    groupId: _groupId,
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: GroupVotingsProps) {
    const { lang } = useParams();
    const t = makeT(loc);
    const bodyById = React.useMemo(() => keyById(bodies), [bodies]);
    return (
        <FeedShell
            descriptor={groupVotingsDescriptor}
            feedNs="NS_GROUPS_VOTINGS"
            icon="vote"
            titleKey="section_votings"
            titleFallback="Votings"
            emptyKey="no_votings"
            emptyFallback="No recorded votings."
            noResultsFallback="No votings match your search."
            viewAllKey="view_all_votings"
            viewAllFallback="View all votings"
            mcpNamespace="group"
            mcpSubject="this group's"
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
                    body={v.body_id != null ? bodyById.get(v.body_id) : undefined}
                    href={votingHref(lang, v.id)}
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

export default GroupVotings;