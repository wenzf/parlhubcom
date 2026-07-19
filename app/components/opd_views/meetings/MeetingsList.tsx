// MeetingsList.tsx           → ~/components/opd_views/meetings/MeetingsList.tsx
//
// The meetings DIRECTORY (top-level /meetings): a paginated, server-filtered
// list of meetings (sessions / sittings) with search / filter / sort. Driven by
// `meetingsCatalogDescriptor` + the URL. LIST family (top-level): the loader
// uses runListPaginatedFiltered and `meetings` here is already the filtered,
// sorted page slice (total_count is the filtered total).
//
// Facet options: group (`groups`, SOURCED from the OpenParlData groups endpoint,
// the requested filter) + body (`bodies`, by the `body` convention — sourced,
// grouped by position). Date range is static. The meeting `type`/`state` are
// free-text (no stable code) → NOT facets.
//
// Each row links to /meetings/:id, to its group /groups/:group_id (via the
// response-scoped `groups` lookup), and shows its body (via `bodies`). Mirrors
// VotingsList.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type { MeetingClient, GroupClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { meetingsCatalogDescriptor } from "~/lib/dimensions/descriptors";
import { localizedPath } from "~/lib/lang";
import { formatEpoch } from "~/lib/domain/person";

import { Badge } from "@/components/ui/badge";

import {
    makeT,
    MetaItem,
    InternalLink,
    formatPeriod,
    bodyName as getBodyName,
    keyById,
} from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface MeetingsListProps {
    /** The filtered page slice + filtered total: `data.meetings`. */
    meetings: PaginatedList<MeetingClient>;
    /** Response-scoped group lookup (`data.groups.items`), keyed by id. */
    groups?: GroupClient[] | undefined;
    /** Response-scoped body lookup (`data.bodies.items`), keyed by id. */
    bodies?: BodyClient[] | undefined;
    loc?: Record<string, string> | undefined;
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

export function MeetingsList({
    meetings,
    groups,
    bodies,
    loc = {},
    locale = "de-CH",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    exportConfig,
    className,
}: MeetingsListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const { lang } = useParams();

    const groupById = React.useMemo(() => keyById(groups), [groups]);
    const bodyById = React.useMemo(() => keyById(bodies), [bodies]);

    return (
        <FeedShell
            descriptor={meetingsCatalogDescriptor}
            icon="calendar-days"
            titleKey="meetings_title"
            titleFallback="Meetings"
            emptyKey="no_meetings"
            emptyFallback="No meetings found."
            noResultsFallback="No meetings match your search."
            mcpNamespace="catalog"
            mcpSubject="all"
            sourced
            list={meetings}
            renderRow={(m) => (
                <MeetingRow
                    key={m.id}
                    meeting={m}
                    t={t}
                    locale={locale}
                    href={localizedPath(lang, "NS_MEETINGS_OVERVIEW", {
                        id: String(m.id),
                    })}
                    group={m.group_id != null ? groupById.get(m.group_id) : undefined}
                    groupHref={
                        m.group_id != null
                            ? localizedPath(lang, "NS_GROUPS_OVERVIEW", {
                                id: String(m.group_id),
                            })
                            : null
                    }
                    body={m.body_id != null ? bodyById.get(m.body_id) : undefined}
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

function MeetingRow({
    meeting,
    t,
    locale,
    href,
    group,
    groupHref,
    body,
}: {
    meeting: MeetingClient;
    t: (key: string) => string;
    locale: string;
    href: string;
    group?: GroupClient | undefined;
    groupHref?: string | null;
    body?: BodyClient | undefined;
}) {
    const name = meeting.name ?? meeting.abbreviation ?? t("meeting_untitled");
    const upcoming = meeting.begin_date != null && meeting.begin_date > Date.now();
    const typeLabel = meeting.type_external ?? null;
    const state = meeting.state ?? null;
    const location = meeting.location ?? null;
    const period =
        formatPeriod(meeting.begin_date, meeting.end_date, locale, t, "meeting") ??
        formatEpoch(meeting.begin_date ?? null, locale);

    const groupName = group?.name ?? group?.abbreviation ?? null;
    const bodyName = getBodyName(body, meeting.body_key);

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    <InternalLink to={href}>
                        {name}
                    </InternalLink>
                    {upcoming ? (
                        <Badge variant="outline" className="font-normal">
                            {t("meeting_upcoming")}
                        </Badge>
                    ) : null}
                    {typeLabel ? (
                        <Badge variant="secondary" className="font-normal">
                            {typeLabel}
                        </Badge>
                    ) : null}
                    {state ? (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                            {state}
                        </Badge>
                    ) : null}
                </div>

                {groupName || bodyName || period || location ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {groupName ? (
                            <MetaItem icon="users-2">
                                {groupHref ? (
                                    <InternalLink to={groupHref}>{groupName}</InternalLink>
                                ) : (
                                    groupName
                                )}
                            </MetaItem>
                        ) : null}
                        {bodyName ? <MetaItem icon="landmark">{bodyName}</MetaItem> : null}
                        {period ? <MetaItem icon="calendar-days">{period}</MetaItem> : null}
                        {location ? <MetaItem icon="map-pin">{location}</MetaItem> : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default MeetingsList;
