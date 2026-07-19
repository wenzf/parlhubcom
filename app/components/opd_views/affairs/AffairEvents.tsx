// AffairEvents.tsx
//
// The lifecycle events of ONE affair — the /affairs/:id/events feed. Each row is
// a dated stage: title (+ harmonized stage), actor, and an optional details
// excerpt + external "details" link. A compact timeline.
//
// Variants:
//   "page"    — full feed route: controls + pager + data credit (default).
//   "snippet" — embedded on the affair overview: rows + a "view all" link.
//
// The actor_type facet options are runtime-injected from the page slice. All
// visible labels come from the `loc` map; the second arg to t() is the English
// fallback.

import * as React from "react";
import type { EventClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { formatDate } from "~/lib/domain/person";
import {
    affairEventsDescriptor,
    withCodeOptions,
} from "~/lib/dimensions/descriptors";

import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, hostLabel } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { Icon } from "../../icons/opd_icons";
import { excerpt } from "~/lib/std/strings";

/** How much of the details text to surface inline. */
const EXCERPT_MAX = 240;

export interface AffairEventsProps {
    /** The filtered page slice + filtered total: `dat.events`. */
    events: PaginatedList<EventClient>;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    /** The affair id — drives the "view all" feed link in the snippet variant. */
    affairId?: number;
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function AffairEvents({
    events,
    loc = {},
    locale = "de-CH",
    variant = "page",
    affairId: _affairId,
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: AffairEventsProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);

    // Inject actor_type options (code = label = actor_type) from the page slice.
    const descriptor = React.useMemo(
        () =>
            withCodeOptions(
                affairEventsDescriptor,
                "actor_type",
                (events.items ?? []) as unknown as Record<string, unknown>[],
                "actor_type",
                (r) => String(r.actor_type ?? ""),
            ),
        [events.items],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            feedNs="NS_AFFAIRS_EVENTS"
            icon="calendar-range"
            titleKey="section_events"
            titleFallback="Timeline"
            emptyKey="no_events"
            emptyFallback="No recorded events."
            noResultsFallback="No events match your search."
            viewAllKey="view_all_events"
            viewAllFallback="View full timeline"
            mcpNamespace="affair"
            mcpSubject="this affair's"
            list={events}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            className={className}
            renderRow={(e) => <EventRow key={e.id} event={e} t={t} locale={locale} />}
        />
    );
}

/* --------------------------------- a row ---------------------------------- */

function EventRow({
    event,
    t,
    locale,
}: {
    event: EventClient;
    t: (key: string) => string;
    locale: string;
}) {
    const title = event.title ?? event.title_harmonized ?? t("event_untitled");
    const stage =
        event.title_harmonized && event.title_harmonized !== event.title
            ? event.title_harmonized
            : null;
    const date = formatDate(event.date, locale);
    const actor = event.actor ?? null;
    const details = excerpt(event.details_text, EXCERPT_MAX);
    const url = event.details_url ?? null;
    const domain = hostLabel(url);

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    <span>{title}</span>
                    {stage ? (
                        <Badge variant="secondary" className="font-normal">
                            {stage}
                        </Badge>
                    ) : null}
                </div>

                {date || actor ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {date ? (
                            <time dateTime={event.date ?? undefined}>
                                {date}
                            </time>
                        ) : null}
                        {actor ? <MetaItem icon="users">{actor}</MetaItem> : null}
                    </div>
                ) : null}

                {details ? (
                    <p className="line-clamp-3 text-sm leading-snug text-muted-foreground">
                        {details}
                    </p>
                ) : null}

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
            </div>
        </li>
    );
}

export default AffairEvents;
