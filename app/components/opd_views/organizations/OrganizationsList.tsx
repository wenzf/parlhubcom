// components/opd_views/organizations/OrganizationsList.tsx
//
// The /organizations catalogue list: search + sort (DimensionControls, driven by
// organizationsDescriptor) over the register-of-interests entries grouped by
// organization, with a pager. Each row links to /organizations/:id (org_key
// base64url-encoded via orgPath). Mirrors DocsList's shell.

import * as React from "react";
import { useParams } from "react-router";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { organizationsDescriptor } from "~/lib/dimensions/descriptors";
import { InternalLink, makeT, StatCount } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { localizedOrgPath } from "~/lib/urls/org_id";

interface OrgItem {
    key: string;
    name: string | null;
    n_members: number;
    n_mandates: number;
    n_paid: number;
    n_bodies: number;
}

export interface OrganizationsListProps {
    organizations?: PaginatedList<OrgItem>;
    loc?: Record<string, string>;
    locale?: string;
    limit?: number;
    offset?: number;
    pageParam?: string;
    /** Enable data export (catalogue use only) — forwarded to FeedShell. Omit for scoped reuses. */
    exportConfig?: {
        segment: string;
        datasetKey: string;
        filenameBase: string;
        subject?: string;
    };
    className?: string;
}

export default function OrganizationsList({
    organizations,
    loc = {},
    locale = "de-CH",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    exportConfig,
    className,
}: OrganizationsListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const params = useParams();

    return (
        <FeedShell
            descriptor={organizationsDescriptor}
            icon="share-2"
            titleKey="organizations_title"
            titleFallback="Organizations"
            emptyKey="organizations_none"
            emptyFallback="No organizations."
            noResultsFallback="No organizations match your search."
            mcpNamespace="catalog"
            mcpSubject="all"
            list={organizations ?? { items: [], total_count: 0 }}
            renderRow={(o) => (
                <li
                    key={o.key}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm leading-snug"
                >
                    <InternalLink to={localizedOrgPath(params.lang, o.key)}>
                        {o.name ?? "—"}
                    </InternalLink>
                    <span className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                        <StatCount n={o.n_members} label={t("org_members")} />
                        <StatCount n={o.n_mandates} label={t("org_mandates")} />
                        {o.n_paid > 0 ? <StatCount n={o.n_paid} label={t("interest_paid")} /> : null}
                        <StatCount n={o.n_bodies} label={t("org_bodies")} />
                    </span>
                </li>
            )}
            loc={loc}
            locale={locale}
            variant="page"
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            exportConfig={exportConfig}
            className={className}
        />
    );
}