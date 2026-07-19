// GroupsList.tsx
//
// The groups DIRECTORY (top-level /groups): a paginated, server-filtered list of
// groups (parliamentary groups / factions / committees) with search / filter /
// sort. Driven by `groupsDescriptor` + the URL. LIST family: the loader uses
// runListPaginatedFiltered and `groups` here is already the filtered, sorted page
// slice (total_count is the filtered total). Mirrors <AffairsList />.
//
// Facet options: body (sourced client-side via the `sourced` prop on
// <DimensionControls>, by the `body` param convention) + type (page-slice
// injected via withCodeOptions, value = stable type_harmonized_id, label =
// localized type_harmonized) + active (tri-state boolean) + date range (static).
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type { GroupClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { groupsDescriptor, withCodeOptions } from "~/lib/dimensions/descriptors";
import { groupHref } from "~/lib/urls/hrefs";

import { Badge } from "@/components/ui/badge";

import { InternalLink, makeT, MetaItem, formatPeriod, bodyName as getBodyName, codeSuffix, keyById } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface GroupsListProps {
    /** The filtered page slice + filtered total: `dat.groups`. */
    groups: PaginatedList<GroupClient>;
    /** Response-scoped body lookup (`dat.bodies.items`): the bodies referenced by
     *  this page's groups (b.id = group.body_id), keyed by id for labels. */
    bodies?: BodyClient[] | undefined;
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string> | undefined;
    locale?: string;
    /** Page size ($6) and page start ($7), echoed from the loader. */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. */
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

export function GroupsList({
    groups,
    bodies,
    loc = {},
    locale = "de-CH",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    exportConfig,
    className,
}: GroupsListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const { lang } = useParams();

    // Resolve each group's body (b.id = group.body_id) for the row snippet.
    const bodyById = React.useMemo(() => keyById(bodies), [bodies]);

    const items = React.useMemo(() => groups.items ?? [], [groups.items]);

    // Inject the `type` facet options from the page slice (stable value =
    // type_harmonized_id, label = localized type_harmonized). The `body` facet is
    // sourced (full vocabulary) via the `sourced` prop below.
    const descriptor = React.useMemo(
        () =>
            withCodeOptions(
                groupsDescriptor,
                "type",
                items as unknown as Record<string, unknown>[],
                "type_harmonized_id",
                (r) => String((r as { type_harmonized?: string | null }).type_harmonized ?? ""),
            ),
        [items],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            icon="users-2"
            titleKey="groups_title"
            titleFallback="Groups"
            emptyKey="no_groups"
            emptyFallback="No groups found."
            noResultsFallback="No groups match your search."
            mcpNamespace="catalog"
            mcpSubject="all"
            sourced
            list={groups}
            renderRow={(g) => (
                <GroupRow
                    key={g.id}
                    group={g}
                    t={t}
                    locale={locale}
                    body={g.body_id != null ? bodyById.get(g.body_id) : undefined}
                    href={groupHref(lang, g.id)}
                />
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

/* --------------------------------- a row ---------------------------------- */

function GroupRow({
    group,
    t,
    locale,
    body,
    href,
}: {
    group: GroupClient;
    t: (key: string) => string;
    locale: string;
    body?: BodyClient | undefined;
    href: string;
}) {
    const primary =
        group.name ?? group.abbreviation ?? t("group_untitled");
    const abbr =
        group.abbreviation && group.abbreviation !== primary
            ? group.abbreviation
            : null;
    const typeLabel = group.type_harmonized ?? group.type_external ?? null;
    const period = formatPeriod(
        group.begin_date ?? null,
        group.end_date ?? null,
        locale,
    );

    const bodyName = getBodyName(body);
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);
    const hasBody = bodyName || group.body_key;

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    <InternalLink to={href}>{primary}</InternalLink>
                    {abbr ? (
                        <span className="font-normal text-muted-foreground">({abbr})</span>
                    ) : null}
                    {typeLabel ? (
                        <Badge variant="secondary" className="font-normal">
                            {typeLabel}
                        </Badge>
                    ) : null}
                    {group.active === false ? (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                            {t("facet_no")}
                        </Badge>
                    ) : null}
                </div>

                {hasBody || period ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {hasBody ? (
                            <MetaItem icon="landmark">
                                {bodyName ? (
                                    <>
                                        <span>{bodyName}</span>
                                        {cantonSuffix ? <span> ({cantonSuffix})</span> : null}
                                    </>
                                ) : (
                                    group.body_key
                                )}
                            </MetaItem>
                        ) : null}
                        {period ? <MetaItem icon="calendar-range">{period}</MetaItem> : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default GroupsList;
