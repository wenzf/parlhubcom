// BodyAffairs.tsx
//
// The affairs (parliamentary business) of ONE body — the /bodies/:id/affairs feed.
// Page variant only: paginated, with search / type / state / date-range / sort
// controls and a CC BY 4.0 data credit, rendered below <BodyBase /> via the bodies
// layout's <Outlet />. Each row is one affair (title → official record, number,
// type, state, begin/end dates).
//
// Driven by `bodyAffairsDescriptor` + the URL: the loader applies the same criteria
// in body_affairs_by_id.sql, so `affairs` here is already the filtered, sorted page
// slice and `total_count` is the filtered total. The `type` / `state` facets are
// sourced client-side (full harmonized vocabulary) via the `sourced` prop — no
// per-page wiring needed.
//
// All visible labels come from the `loc` map; the second arg to t() is the English
// fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type { AffairClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { formatEpoch } from "~/lib/domain/person";
import { bodyAffairsDescriptor } from "~/lib/dimensions/descriptors";
import { affairHref } from "~/lib/urls/hrefs";

import { Badge } from "@/components/ui/badge";

import { InternalLink, makeT, isoOf, hostLabel } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { Icon } from "../../icons/opd_icons";

export interface BodyAffairsProps {
    /** The filtered page slice + filtered total: `dat.affairs`. */
    affairs: PaginatedList<AffairClient>;
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string> | undefined;
    locale?: string;
    /**
     * "page"    — full dimension route: controls + pager + data credit (default).
     * "snippet" — embedded on the body overview: no controls / pager, just the rows
     *             the loader passed plus a link to the /bodies/:id/affairs feed.
     */
    variant?: "page" | "snippet";
    /** The body id — drives the "view all" feed link in the snippet variant. */
    bodyId?: number;
    /** Page size ($7) and page start ($8), echoed from the loader. ("page" only.) */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. ("page" only.) */
    pageParam?: string;
    className?: string;
}

export function BodyAffairs({
    affairs,
    loc = {},
    locale = "de-CH",
    variant = "page",
    bodyId: _bodyId,
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: BodyAffairsProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);

    return (
        <FeedShell
            descriptor={bodyAffairsDescriptor}
            feedNs="NS_BODIES_AFFAIRS"
            icon="file-text"
            titleKey="body_affairs_title"
            titleFallback="Affairs"
            emptyKey="no_affairs"
            emptyFallback="No recorded affairs."
            noResultsFallback="No affairs match your search."
            viewAllKey="view_all_affairs"
            viewAllFallback="View all affairs"
            mcpNamespace="body"
            mcpSubject="this institution's"
            list={affairs}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            sourced
            className={className}
            renderRow={(a) => <AffairRow key={a.id} affair={a} t={t} locale={locale} />}
        />
    );
}

/* --------------------------------- a row ---------------------------------- */

function AffairRow({
    affair,
    t,
    locale,
}: {
    affair: AffairClient;
    t: (key: string) => string;
    locale: string;
}) {
    const params = useParams();
    const title = affair.title ?? affair.title_long ?? t("affair_untitled");
    const url = affair.url_external ?? null;
    const domain = hostLabel(url);
    const typeLabel = affair.type_name ?? affair.type_harmonized ?? null;
    const stateLabel = affair.state_name_harmonized ?? affair.state_name ?? null;
    const beginDate = formatEpoch(affair.begin_date, locale);
    const endDate = formatEpoch(affair.end_date, locale);

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                {/* title → the affair's own detail page (NS_AFFAIRS_OVERVIEW). */}
                <div className="text-sm font-medium leading-snug">
                    <InternalLink
                        to={affairHref(params.lang, affair.id)}
                    >
                        <span>{title}</span>
                    </InternalLink>
                </div>

                {/* official external record — labelled with the source domain, e.g.
            "External link (grosserrat.ch)" */}
                {url ? (
                    <div className="text-xs">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            <Icon name="external-link" className="size-3 shrink-0" />
                            <span>
                                {t("external_link")}
                                {domain ? ` (${domain})` : ""}
                            </span>
                        </a>
                    </div>
                ) : null}

                {/* meta: number · type · state */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {affair.number ? (
                        <span className="font-mono">
                            {affair.number}
                        </span>
                    ) : null}
                    {typeLabel ? (
                        <Badge variant="secondary" className="font-normal">
                            {typeLabel}
                        </Badge>
                    ) : null}
                    {stateLabel ? <span>{stateLabel}</span> : null}
                </div>

                {/* dates: begin → end */}
                {beginDate || endDate ? (
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <Icon name="calendar-days" className="size-3 shrink-0" />
                        {beginDate ? (
                            <time dateTime={isoOf(affair.begin_date)}>
                                {beginDate}
                            </time>
                        ) : null}
                        {beginDate && endDate ? <span>–</span> : null}
                        {endDate ? (
                            <time dateTime={isoOf(affair.end_date)}>{endDate}</time>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default BodyAffairs;
