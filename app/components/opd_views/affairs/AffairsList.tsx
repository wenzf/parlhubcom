// AffairsList.tsx
//
// The affairs DIRECTORY (top-level /affairs): a paginated, server-filtered list
// of affairs (parliamentary business items) with search / filter / sort. Driven
// by `affairsDescriptor` + the URL. LIST family (top-level): the loader uses
// runListPaginatedFiltered and `affairs` here is already the filtered, sorted
// page slice (total_count is the filtered total).
//
// Facet options (all sourced client-side via the `sourced` prop on
// <DimensionControls>): type (`affair_types`), state (`affair_states`), body
// (`bodies`, by the `body` param convention). Date range is static.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type { AffairClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { affairsDescriptor } from "~/lib/dimensions/descriptors";
import { affairHref } from "~/lib/urls/hrefs";

import { Badge } from "@/components/ui/badge";

import { InternalLink, makeT, MetaItem, formatPeriod, bodyName as getBodyName, codeSuffix, keyById } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface AffairsListProps {
    /** The filtered page slice + filtered total: `dat.affairs`. */
    affairs: PaginatedList<AffairClient>;
    /** Response-scoped body lookup (`dat.bodies.items`): the bodies referenced by
     *  this page's affairs (b.id = affair.body_id), keyed by body_key for labels. */
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

export function AffairsList({
    affairs,
    bodies,
    loc = {},
    locale = "de-CH",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    exportConfig,
    className,
}: AffairsListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const { lang } = useParams();

    // Resolve each affair's body (b.id = affair.body_id) for the row snippet.
    const bodyById = React.useMemo(() => keyById(bodies), [bodies]);

    return (
        <FeedShell
            descriptor={affairsDescriptor}
            icon="file-text"
            titleKey="affairs_title"
            titleFallback="Affairs"
            emptyKey="no_affairs"
            emptyFallback="No affairs found."
            noResultsFallback="No affairs match your search."
            mcpNamespace="catalog"
            mcpSubject="all"
            sourced
            list={affairs}
            renderRow={(a) => (
                <AffairRow
                    key={a.id}
                    affair={a}
                    t={t}
                    locale={locale}
                    body={a.body_id != null ? bodyById.get(a.body_id) : undefined}
                    href={affairHref(lang, a.id)}
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

function AffairRow({
    affair,
    t,
    locale,
    body,
    href,
}: {
    affair: AffairClient;
    t: (key: string) => string;
    locale: string;
    body?: BodyClient | undefined;
    href: string;
}) {
    const primary =
        affair.title ?? affair.title_long ?? t("affair_untitled");
    const number = affair.number ?? null;
    const typeLabel = affair.type_name ?? affair.type_harmonized ?? null;
    const stateLabel = affair.state_name ?? affair.state_name_harmonized ?? null;
    const period = formatPeriod(
        affair.begin_date ?? null,
        affair.end_date ?? null,
        locale,
    );

    // Body snippet (resolved via b.id = affair.body_id): legislative_name, then
    // (canton_key) when it's a real code (not a numeric id), then name. Falls back
    // to the affair's raw body_key when the body wasn't looked up.
    const bodyName = getBodyName(body);
    const bodySecondary =
        body?.name && body.name !== bodyName ? body.name : null;
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);
    const hasBody = bodyName || affair.body_key;

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    <InternalLink to={href}>{primary}</InternalLink>
                    {number ? (
                        <span className="font-normal text-muted-foreground">({number})</span>
                    ) : null}
                    {typeLabel ? (
                        <Badge variant="secondary" className="font-normal">
                            {typeLabel}
                        </Badge>
                    ) : null}
                    {stateLabel ? (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                            {stateLabel}
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
                                        {bodySecondary ? <span> {bodySecondary}</span> : null}
                                        {cantonSuffix ? <span> ({cantonSuffix})</span> : null}
                                    </>
                                ) : (
                                    affair.body_key
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

export default AffairsList;