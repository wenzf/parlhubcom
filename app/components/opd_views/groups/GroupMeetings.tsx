// GroupMeetings.tsx
//
// The meetings of ONE group — the /groups/:id/meetings feed. Each row is a
// meeting (a sitting/session): name, type, state, date span, location, and the
// meeting's body (resolved via the response-scoped `bodies` lookup, b.id =
// meeting.body_id). Mirrors <AffairContributors /> / <GroupContributions />.
//
// Variants:
//   "page"    — full feed route: controls + pager + data credit (default).
//   "snippet" — embedded on the group overview: rows + a "view all" link.
//
// Driven by `groupMeetingsDescriptor` + the URL. All visible labels come from the
// `loc` map; the second arg to t() is the English fallback.

import * as React from "react";
import { NavLink, useParams } from "react-router";
import type { MeetingClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { groupMeetingsDescriptor } from "~/lib/dimensions/descriptors";
import { createLangPathByParam } from "~/lib/lang";

import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, formatPeriod, bodyName as getBodyName } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { Icon } from "../../icons/opd_icons";

export interface GroupMeetingsProps {
    /** The filtered page slice + filtered total: `dat.meetings`. */
    meetings: PaginatedList<MeetingClient>;
    /** Response-scoped body lookup (`dat.bodies.items`), keyed by id. */
    bodies?: BodyClient[] | undefined;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    /** The group id — drives the "view all" feed link in the snippet variant. */
    groupId?: number;
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function GroupMeetings({
    meetings,
    bodies,
    loc = {},
    locale = "de-CH",
    variant = "page",
    groupId: _groupId,
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: GroupMeetingsProps) {
    const params = useParams();
    const t = React.useMemo(() => makeT(loc), [loc]);

    const bodyById = React.useMemo(() => {
        const m = new Map<number, BodyClient>();
        for (const b of bodies ?? []) m.set(b.id, b);
        return m;
    }, [bodies]);

    return (
        <FeedShell
            descriptor={groupMeetingsDescriptor}
            feedNs="NS_GROUPS_MEETINGS"
            icon="calendar-days"
            titleKey="section_meetings"
            titleFallback="Meetings"
            emptyKey="no_meetings"
            emptyFallback="No recorded meetings."
            noResultsFallback="No meetings match your search."
            viewAllKey="view_all_meetings"
            viewAllFallback="View all meetings"
            mcpNamespace="group"
            mcpSubject="this group's"
            list={meetings}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            className={className}
            renderRow={(m) => (
                <MeetingRow
                    key={m.id}
                    meeting={m}
                    t={t}
                    locale={locale}
                    lang={params.lang}
                    body={m.body_id != null ? bodyById.get(m.body_id) : undefined}
                />
            )}
        />
    );
}

/* --------------------------------- a row ---------------------------------- */

function MeetingRow({
    meeting,
    t,
    locale,
    lang,
    body,
}: {
    meeting: MeetingClient;
    t: (key: string) => string;
    locale: string;
    lang?: string | undefined;
    body?: BodyClient | undefined;
}) {
    const name =
        meeting.name ??
        meeting.type_external ??
        meeting.type ??
        t("meeting_untitled");
    const typeLabel = meeting.type_external ?? null;
    const period = formatPeriod(
        meeting.begin_date ?? null,
        meeting.end_date ?? null,
        locale,
    );
    const bodyName = getBodyName(body, body?.body_key);
    // Internal link to /meetings/:id (no dedicated namespace yet → lang-prefixed path).
    const meetingHref = createLangPathByParam(lang, `/meetings/${meeting.id}`);

    return (
        <li className="py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                <NavLink
                    viewTransition
                    to={meetingHref}
                    preventScrollReset
                    className="text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <span>{name}</span>
                </NavLink>
                {meeting.number ? (
                    <span className="font-normal text-muted-foreground">
                        ({meeting.number})
                    </span>
                ) : null}
                {typeLabel ? (
                    <Badge variant="secondary" className="font-normal">
                        {typeLabel}
                    </Badge>
                ) : null}
                {meeting.state ? (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                        {meeting.state}
                    </Badge>
                ) : null}
            </div>

            {(bodyName || period || meeting.location || meeting.url_external) && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {bodyName ? <MetaItem icon="landmark">{bodyName}</MetaItem> : null}
                    {period ? <MetaItem icon="calendar-range">{period}</MetaItem> : null}
                    {meeting.location ? (
                        <MetaItem icon="landmark">{meeting.location}</MetaItem>
                    ) : null}
                    {meeting.url_external ? (
                        <a
                            href={meeting.url_external}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            <Icon name="external-link" className="size-3" />
                            {t("external_link")}
                        </a>
                    ) : null}
                </div>
            )}
        </li>
    );
}

export default GroupMeetings;
