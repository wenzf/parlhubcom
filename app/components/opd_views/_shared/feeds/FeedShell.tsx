// _shared/feeds/FeedShell.tsx
//
// The generic PERSON-family feed chrome shared by every entity-scoped feed:
// Card + title(+count) + (page) DimensionControls + DimensionMcpTools + a
// <ul> of rows + (page) pager + CC-BY footer, or (snippet) a "view all (N)"
// link back to the full feed. The only per-feed differences are the row
// renderer, descriptor, title/icon, empty copy, feed namespace and the MCP
// namespace/subject — all props.
//
// Promoted from the private FeedShell in meetings/MeetingFeeds.tsx (the MCP
// namespace/subject, previously hardcoded to "meeting", are now props). Use it
// for any new feed instead of re-copying the chrome.

import * as React from "react";
import { useParams, useSearchParams } from "react-router";
import type { PaginatedList } from "@/types/opd_paginated_client";
import type { DimensionDescriptor } from "~/lib/dimensions/filters";
import type { PageNamespaces } from "@/types/site";
import { parseRaw, hasActiveCriteria } from "~/lib/dimensions/filters";
import { localizedPath } from "~/lib/lang";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InternalLink, makeT, AttributionFooter, PagerLink, usePagerHref } from "../../../opd_views/opd_micros";
import { MethodologyLink } from "../MethodologyLink";
import { DimensionControls } from "../../../opd_views/controls/DimensionControls";
import { DimensionMcpTools } from "../../../opd_views/controls/DimensionMcpTools";
import { PendingOverlay, useSameRoutePending } from "./PendingOverlay";
import DataExport from "../DataExport";
import { DataExportMcpTool } from "../DataExportMcpTool";
import { rowsTable, exportBaseHref, langExportConfig } from "../export_helpers";
import { Icon, type IconName } from "../../../icons/opd_icons";

export interface FeedShellProps<T> {
    descriptor: DimensionDescriptor;
    /** Namespace of the full feed route — drives the snippet "view all" link when
     *  `feedHref` is not given. Optional: the person-family feeds pass an explicit
     *  `feedHref` instead (their routes are `/people/:id/<feed>`, not a namespace). */
    feedNs?: PageNamespaces;
    /** Explicit override for the snippet "view all" target. Takes precedence over
     *  `feedNs`; e.g. `feedPath(personId, "votes")` → `/people/:id/votes`. */
    feedHref?: string;
    icon: IconName;
    titleKey: string;
    titleFallback: string;
    emptyKey: string;
    emptyFallback: string;
    noResultsFallback: string;
    /** Snippet "view all" link copy. Optional — catalogue lists are always the
     *  `page` variant and never render the snippet link. */
    viewAllKey?: string;
    viewAllFallback?: string;
    /** MCP tool scoping — e.g. "affair" / "this affair's". Omit to fall back to
     *  DimensionMcpTools' person-oriented defaults. */
    mcpNamespace?: string;
    mcpSubject?: string;
    list: PaginatedList<T>;
    /** `position` is the 1-based index across the whole result set
     *  (`offset + i + 1`). Structured-data ListItems now live in the page head
     *  (JSON-LD), so most callers can ignore it. */
    renderRow: (row: T, position: number) => React.ReactNode;
    /** Optional trailing control in the title row (e.g. a <MethodologyLink> on
     *  metric feeds). Rendered right-aligned; used only where `exportConfig` is
     *  not set (detail-page feeds), so the two never fight over `ml-auto`. */
    titleAction?: React.ReactNode;
    /** Deep-link anchor for this metric's `{ } Methodology` link, rendered at the
     *  *bottom* of the card (on the attribution footer for the `page` variant, on
     *  the "view all" row for the `snippet`) rather than up in the header. Prefer
     *  this over threading a <MethodologyLink> through `titleAction`. */
    methodologyAnchor?: string;
    loc: Record<string, string>;
    locale: string;
    variant: "page" | "snippet";
    limit: number;
    offset: number;
    pageParam: string;
    /** Render the row list as an ordered `<ol>` (e.g. a chronological voting
     *  record) instead of the default `<ul>`. */
    ordered?: boolean;
    /** Forwarded to DimensionControls: source the facet options client-side from
     *  the full harmonized vocabulary (e.g. body-affairs, group-memberships). */
    sourced?: boolean;
    /** Opt-in data export (the <DataExport> control in the card header + the
     *  `<segment>_export` WebMCP tool). Set ONLY on catalogue `page` variants —
     *  the visible rows become the in-browser export and the full filtered list is
     *  offered via the /:lang?/<segment>/export/:dataset/:format resource route.
     *  Detail-page feeds omit it (their export lives in the result layout). */
    exportConfig?: {
        /** URL segment of the export resource route, e.g. "people". */
        segment: string;
        /** dataset key the route registers (usually === segment). */
        datasetKey: string;
        /** Download filename base (without extension). */
        filenameBase: string;
        /** How the MCP tool description names the subject, e.g. "all people". */
        subject?: string;
    } | undefined;
    className?: string | undefined;
}

export function FeedShell<T>({
    descriptor,
    feedNs,
    feedHref: feedHrefProp,
    icon,
    titleKey,
    titleFallback,
    emptyKey,
    emptyFallback,
    noResultsFallback,
    viewAllKey,
    viewAllFallback,
    mcpNamespace,
    mcpSubject,
    list,
    renderRow,
    titleAction,
    methodologyAnchor,
    loc,
    locale,
    variant,
    limit,
    offset,
    pageParam,
    ordered = false,
    sourced = false,
    exportConfig,
    className,
}: FeedShellProps<T>) {
    const pagerTo = usePagerHref(pageParam);
    const t = React.useMemo(() => makeT(loc), [loc]);
    const [searchParams] = useSearchParams();
    const params = useParams();

    const isPage = variant === "page";
    const samePathPending = useSameRoutePending();
    // A criteria/pager navigation back to this same list is in flight (covers the
    // whole gap on deferred routes too: the held previous tree keeps showing it
    // while <Await> suspends). Stale rows stay visible, dimmed under a spinner.
    const pending = isPage && samePathPending;
    const total = list.total_count ?? 0;
    const items = React.useMemo(() => list.items ?? [], [list.items]);

    const filtersActive =
        isPage && hasActiveCriteria(descriptor, parseRaw(descriptor, searchParams));

    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const feedHref =
        feedHrefProp ?? (feedNs ? localizedPath(params.lang, feedNs, params) : "#");
    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + (items.length || limit), total);
    const prevOffset = Math.max(0, offset - limit);
    const nextOffset = offset + limit;
    const hasPrev = offset > 0;
    const hasNext = nextOffset < total;

    // Opt-in export (catalogue pages): the visible rows are the in-browser export;
    // the full filtered list is the single bulk dataset behind the resource route.
    const exportTables = React.useMemo(
        () => (exportConfig ? [rowsTable(t(titleKey), items as Record<string, unknown>[])] : []),
        [exportConfig, items, t, titleKey],
    );
    const exportBulk =
        exportConfig && total > 0
            ? {
                baseHref: exportBaseHref(params.lang, exportConfig.segment),
                pageSize: 500,
                datasets: [{ key: exportConfig.datasetKey, label: t(titleKey), total }],
            }
            : undefined;

    // Rows keyed by 1-based position across the whole result set (offset + i + 1);
    // catalogue structured data now lives in the page <head> as JSON-LD (an
    // ItemList built in each index route's meta()), not in the DOM.
    const listChildren = items.map((row, i) => renderRow(row, offset + i + 1));

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Icon name={icon} className="size-4 text-muted-foreground" />
                    {t(titleKey)}
                    {total > 0 ? (
                        <span className="text-sm font-normal text-muted-foreground">({total})</span>
                    ) : null}
                    {isPage && exportConfig ? (
                        <DataExport
                            filename={exportConfig.filenameBase}
                            tables={exportTables}
                            bulk={exportBulk}
                            langExport={langExportConfig(params.lang)}
                            jsonMeta={{
                                dataset: exportConfig.datasetKey,
                                languages: langExportConfig(params.lang).initial,
                                totalEntries: total,
                            }}
                            loc={loc}
                            className="ml-auto data-export-hide shrink-0"
                        />
                    ) : null}
                    {titleAction ? <span className="ml-auto shrink-0">{titleAction}</span> : null}
                </CardTitle>
            </CardHeader>

            <CardContent>
                {/* Catalogue Dataset JSON-LD now rides in the head @graph, built in the
            index route meta() (metas factory `catalogueDataset`). */}
                {isPage ? (
                    <DimensionControls
                        descriptor={descriptor}
                        loc={loc}
                        locale={locale}
                        resultCount={total}
                        sourced={sourced}
                        {...(mcpNamespace !== undefined ? { mcpNamespace } : {})}
                    />
                ) : null}

                {isPage && mounted ? (
                    <DimensionMcpTools
                        descriptor={descriptor}
                        {...(mcpNamespace !== undefined ? { namespace: mcpNamespace } : {})}
                        {...(mcpSubject !== undefined ? { subject: mcpSubject } : {})}
                        limit={limit}
                        offset={offset}
                        filteredTotal={total}
                        visibleCount={items.length}
                    />
                ) : null}

                {isPage && mounted && exportConfig && exportBulk ? (
                    <DataExportMcpTool
                        toolName={`${exportConfig.segment}_export`}
                        baseHref={exportBulk.baseHref}
                        pageSize={exportBulk.pageSize}
                        datasets={exportBulk.datasets}
                        subject={exportConfig.subject ?? ""}
                    />
                ) : null}

                <div className="relative" aria-busy={pending || undefined}>
                    {items.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            {filtersActive ? t("controls_no_results") : t(emptyKey)}
                        </p>
                    ) : ordered ? (
                        <ol className="divide-y divide-border/60">{listChildren}</ol>
                    ) : (
                        <ul className="divide-y divide-border/60">{listChildren}</ul>
                    )}
                    {pending ? <PendingOverlay loc={loc} label="controls_loading" /> : null}
                </div>

                {isPage && total > limit ? (
                    <nav className="mt-4 flex items-center justify-between gap-4 border-t pt-4 text-sm" aria-label={t("pagination")}>
                        <span className="text-muted-foreground">
                            {t("showing")} {from}–{to} {t("of")} {total}
                        </span>
                        <div className="flex items-center gap-2">
                            <PagerLink disabled={!hasPrev} to={pagerTo(prevOffset)} rel="prev">
                                <Icon name="arrow-left" className="size-3.5" />
                                {t("pager_prev")}
                            </PagerLink>
                            <PagerLink disabled={!hasNext} to={pagerTo(nextOffset)} rel="next">
                                {t("pager_next")}
                                <Icon name="arrow-right" className="size-3.5" />
                            </PagerLink>
                        </div>
                    </nav>
                ) : null}

                {!isPage && total > 0 ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t pt-4 text-sm">
                        <InternalLink to={feedHref}>
                            {t(viewAllKey ?? "view_all")}
                            {total > items.length ? <span className="text-muted-foreground"> ({total})</span> : null}
                        </InternalLink>
                        {methodologyAnchor ? <MethodologyLink anchor={methodologyAnchor} /> : null}
                    </div>
                ) : null}

                {isPage ? (
                    <AttributionFooter t={t} anchor={methodologyAnchor} />
                ) : null}
            </CardContent>
        </Card>
    );
}

export default FeedShell;