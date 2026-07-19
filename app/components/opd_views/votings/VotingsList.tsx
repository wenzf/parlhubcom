// VotingsList.tsx              → ~/components/opd_views/votings/VotingsList.tsx
//
// The votings DIRECTORY (top-level /votings): a paginated, server-filtered list
// of votings (voting EVENTS, not per-person votes) with search / filter / sort.
// Driven by `votingsDescriptor` + the URL. LIST family (top-level): the loader
// uses runListPaginatedFiltered and `votings` here is already the filtered,
// sorted page slice (total_count is the filtered total).
//
// Facet options: body (`bodies`, by the `body` param convention — sourced
// client-side, grouped by position). Date range is static. The voting `type`
// and `decision` are localized free-text (no stable code) → NOT facets.
//
// Each row links to /votings/:id and, when the voting belongs to an affair, to
// /affairs/:affair_id via the denormalized affair_title. Mirrors AffairsList.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type { VotingClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { votingsDescriptor } from "~/lib/dimensions/descriptors";
import { localizedPath } from "~/lib/lang";
import { votingHref } from "~/lib/urls/hrefs";
import { formatEpoch } from "~/lib/domain/person";

import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, InternalLink, bodyName as getBodyName, codeSuffix, keyById } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface VotingsListProps {
    /** The filtered page slice + filtered total: `dat.votings`. */
    votings: PaginatedList<VotingClient>;
    /** Response-scoped body lookup (`dat.bodies.items`): the bodies referenced by
     *  this page's votings (b.id = voting.body_id), keyed by id for labels. */
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

export function VotingsList({
    votings,
    bodies,
    loc = {},
    locale = "de-CH",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    exportConfig,
    className,
}: VotingsListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const { lang } = useParams();

    // Resolve each voting's body (b.id = voting.body_id) for the row snippet.
    const bodyById = React.useMemo(() => keyById(bodies), [bodies]);

    return (
        <FeedShell
            descriptor={votingsDescriptor}
            icon="vote"
            titleKey="votings_title"
            titleFallback="Votings"
            emptyKey="no_votings"
            emptyFallback="No votings found."
            noResultsFallback="No votings match your search."
            mcpNamespace="catalog"
            mcpSubject="all"
            sourced
            list={votings}
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
                            ? localizedPath(lang, "NS_AFFAIRS_OVERVIEW", {
                                id: String(v.affair_id),
                            })
                            : null
                    }
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

function VotingRow({
    voting,
    t,
    locale,
    body,
    href,
    affairHref,
}: {
    voting: VotingClient;
    t: (key: string) => string;
    locale: string;
    body?: BodyClient | undefined;
    href: string;
    affairHref?: string | null;
}) {
    const primary = voting.title ?? t("voting_untitled");
    const typeLabel = voting.type ?? null;
    const decision = voting.decision ?? null;
    const date = formatEpoch(voting.date ?? null, locale);

    // Body snippet (resolved via b.id = voting.body_id), falling back to body_key.
    const bodyName = getBodyName(body);
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);
    const hasBody = bodyName || voting.body_key;

    // Tally summary "Yes N · No N · Abst. N" (omits null buckets).
    const tally = [
        voting.results_yes != null ? `${t("tally_yes")} ${voting.results_yes}` : null,
        voting.results_no != null ? `${t("tally_no")} ${voting.results_no}` : null,
        voting.results_abstention != null
            ? `${t("tally_abstention")} ${voting.results_abstention}`
            : null,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    <InternalLink to={href}>
                        {primary}
                    </InternalLink>
                    {typeLabel ? (
                        <Badge variant="secondary" className="font-normal">
                            {typeLabel}
                        </Badge>
                    ) : null}
                    {decision ? (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                            {decision}
                        </Badge>
                    ) : null}
                </div>

                {hasBody || date || tally ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {hasBody ? (
                            <MetaItem icon="landmark">
                                {bodyName ? (
                                    <>
                                        <span>{bodyName}</span>
                                        {cantonSuffix ? <span> ({cantonSuffix})</span> : null}
                                    </>
                                ) : (
                                    voting.body_key
                                )}
                            </MetaItem>
                        ) : null}
                        {date ? <MetaItem icon="calendar-days">{date}</MetaItem> : null}
                        {tally ? <MetaItem icon="vote">{tally}</MetaItem> : null}
                    </div>
                ) : null}

                {voting.affair_title && affairHref ? (
                    <div className="text-xs">
                        <MetaItem icon="file-text">
                            <InternalLink to={affairHref}>{voting.affair_title}</InternalLink>
                        </MetaItem>
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default VotingsList;
