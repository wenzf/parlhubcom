// AffairContributors.tsx  → ~/components/opd_views/affairs/AffairContributors.tsx
//
// The people who contributed to ONE affair — the /affairs/:id/contributors feed.
// Thin wrapper over the shared <FeedShell> rendering the shared <ContributorRow>.
// Each row links to the contributor's /people/:id page.

import { useParams } from "react-router";
import type { ContributorClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { affairContributorsDescriptor } from "~/lib/dimensions/descriptors";
import { peopleHref } from "~/lib/urls/hrefs";

import { makeT } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { ContributorRow } from "../_shared/rows/ContributorRow";

export interface AffairContributorsProps {
    contributors: PaginatedList<ContributorClient>;
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

export function AffairContributors({
    contributors,
    loc = {},
    locale = "de-CH",
    variant = "page",
    affairId: _affairId,
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: AffairContributorsProps) {
    const { lang } = useParams();
    const t = makeT(loc);
    return (
        <FeedShell
            descriptor={affairContributorsDescriptor}
            feedNs="NS_AFFAIRS_CONTRIBUTORS"
            icon="file-signature"
            titleKey="section_contributions"
            titleFallback="Contributions"
            emptyKey="no_contributions"
            emptyFallback="No recorded contributions."
            noResultsFallback="No contributors match your search."
            viewAllKey="view_all_contributions"
            viewAllFallback="View all contributions"
            mcpNamespace="affair"
            mcpSubject="this affair's"
            list={contributors}
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

export default AffairContributors;