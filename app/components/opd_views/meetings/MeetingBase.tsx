// MeetingBase.tsx            → ~/components/opd_views/meetings/MeetingBase.tsx
//
// Compact identity header for a meeting, rendered at the top of the
// /meetings/:id overview, above <MeetingFull />. Presentational only — the
// page's schema.org Event structured data is emitted as head JSON-LD by the
// route meta() (metas/meeting.ts → jsonld/meeting.ts).
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import type { MeetingClient, GroupClient, BodyClient } from "@/types/opd_db";
import { formatEpoch } from "~/lib/domain/person";

import { Badge } from "@/components/ui/badge";
import { makeT, MetaItem, EntityHeader, formatPeriod, bodyName as getBodyName } from "../opd_micros";

export interface MeetingBaseProps {
    meeting: MeetingClient;
    /** The meeting's group (g.id = meeting.group_id), for the group line. */
    group?: GroupClient | undefined;
    /** The meeting's institution (b.id = meeting.body_id), for the body line. */
    body?: BodyClient | undefined;
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

export function MeetingBase({
    meeting,
    group,
    body,
    loc = {},
    locale = "de-CH",
    className,
}: MeetingBaseProps) {
    const t = makeT(loc);

    const primary =
        meeting.name ?? meeting.abbreviation ?? t("meeting_untitled");
    const typeLabel = meeting.type_external ?? null;
    const state = meeting.state ?? null;

    const groupName = group?.name ?? group?.abbreviation ?? null;
    const groupAbbr = group?.abbreviation ?? null;
    const groupLabel =
        groupName && groupAbbr && groupAbbr !== groupName
            ? `${groupName} (${groupAbbr})`
            : (groupName ?? null);

    const bodyName = getBodyName(body, meeting.body_key);
    const period =
        formatPeriod(meeting.begin_date, meeting.end_date, locale, t, "meeting") ??
        formatEpoch(meeting.begin_date ?? null, locale);
    const location = meeting.location ?? null;

    return (
        <EntityHeader
            gap="gap-3"
            className={className}
            title={primary}
            trailing={
                <>
                    {typeLabel ? <Badge variant="secondary">{typeLabel}</Badge> : null}
                    {state ? (
                        <Badge variant="outline" className="text-muted-foreground">
                            {state}
                        </Badge>
                    ) : null}
                </>
            }
            meta={
                (groupLabel || bodyName || period || location) ? (
                    <>
                        {groupLabel ? <MetaItem icon="users-2">{groupLabel}</MetaItem> : null}
                        {bodyName ? <MetaItem icon="landmark">{bodyName}</MetaItem> : null}
                        {period ? <MetaItem icon="calendar-days">{period}</MetaItem> : null}
                        {location ? <MetaItem icon="map-pin">{location}</MetaItem> : null}
                    </>
                ) : null
            }
        />
    );
}

export default MeetingBase;
