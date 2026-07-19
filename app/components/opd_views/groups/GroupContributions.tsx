// GroupContributions.tsx  → ~/components/opd_views/groups/GroupContributions.tsx
//
// The contributions made by ONE group — the /groups/:id/contributions feed. Thin
// wrapper over the shared <FeedShell> rendering the shared <ContributorRow>. Each
// row links to its person and its parent affair, and shows its body (from the
// response-scoped `bodies` / `affairs` lookups).

import * as React from "react";
import { useParams } from "react-router";
import type { ContributorClient, BodyClient, AffairClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { groupContributionsDescriptor } from "~/lib/dimensions/descriptors";
import { affairHref, peopleHref } from "~/lib/urls/hrefs";

import { makeT, keyById } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { ContributorRow } from "../_shared/rows/ContributorRow";

export interface GroupContributionsProps {
    contributions: PaginatedList<ContributorClient>;
    /** Response-scoped body lookup (`dat.bodies.items`), keyed by id. */
    bodies?: BodyClient[] | undefined;
    /** Response-scoped affair lookup (`dat.affairs.items`), keyed by id. */
    affairs?: AffairClient[] | undefined;
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

export function GroupContributions({
    contributions,
    bodies,
    affairs,
    loc = {},
    locale = "de-CH",
    variant = "page",
    groupId: _groupId,
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: GroupContributionsProps) {
    const { lang } = useParams();
    const t = makeT(loc);
    const bodyById = React.useMemo(() => keyById(bodies), [bodies]);
    const affairById = React.useMemo(() => keyById(affairs), [affairs]);
    return (
        <FeedShell
            descriptor={groupContributionsDescriptor}
            feedNs="NS_GROUPS_CONTRIBUTIONS"
            icon="file-signature"
            titleKey="section_contributions"
            titleFallback="Contributions"
            emptyKey="no_contributions"
            emptyFallback="No recorded contributions."
            noResultsFallback="No contributors match your search."
            viewAllKey="view_all_contributions"
            viewAllFallback="View all contributions"
            mcpNamespace="group"
            mcpSubject="this group's"
            list={contributions}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            className={className}
            renderRow={(c) => (
                <ContributorRow
                    key={c.id}
                    contributor={c}
                    t={t}
                    body={c.body_id != null ? bodyById.get(c.body_id) : undefined}
                    affair={c.affair_id != null ? affairById.get(c.affair_id) : undefined}
                    affairHref={
                        c.affair_id != null
                            ? affairHref(lang, c.affair_id)
                            : null
                    }
                    personHref={
                        c.person_id != null
                            ? peopleHref(lang, c.person_id)
                            : null
                    }
                />
            )}
        />
    );
}

export default GroupContributions;