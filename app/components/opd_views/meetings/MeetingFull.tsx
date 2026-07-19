// MeetingFull.tsx            → ~/components/opd_views/meetings/MeetingFull.tsx
//
// Full data panel for a meeting — rendered ONLY on the /meetings/:id overview
// (in meetings_result_layout), below <MeetingBase />. Analogue of <VotingFull />.
//
// Sections: Details (type · state · number · location · period) · Group (the
// parliamentary group it belongs to — link + type + abbreviation) · References
// & source (institution, external url). A meeting is a leaf entity (no sub-feeds),
// so this is the whole detail surface.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import type { MeetingClient, GroupClient, BodyClient } from "@/types/opd_db";

import {
    makeT,
    Field,
    Section,
    InternalLink,
    hostLabel,
    formatPeriod,
    ExternalLinkField,
    bodyName as getBodyName,
} from "../opd_micros";
import { formatEpoch } from "~/lib/domain/person";

export interface MeetingFullProps {
    meeting: MeetingClient;
    /** The meeting's group (g.id = meeting.group_id). */
    group?: GroupClient | undefined;
    /** The meeting's institution (b.id = meeting.body_id). */
    body?: BodyClient | undefined;
    /** Pre-built internal href to the group (/groups/:group_id), or null. */
    groupHref?: string | null;
    /** Pre-built internal href to the institution (/bodies/:body_id), or null. */
    bodyHref?: string | null;
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

export function MeetingFull({
    meeting,
    group,
    body,
    groupHref = null,
    bodyHref = null,
    loc = {},
    locale = "de-CH",
    className,
}: MeetingFullProps) {
    const t = makeT(loc);

    const period =
        formatPeriod(meeting.begin_date, meeting.end_date, locale, t, "meeting") ??
        formatEpoch(meeting.begin_date ?? null, locale);

    const groupName = group?.name ?? group?.abbreviation ?? null;
    const bodyName = getBodyName(body, meeting.body_key);

    const externalUrl = meeting.url_external ?? null;
    const externalHost = hostLabel(externalUrl);

    return (
        <div className={["space-y-4", className].filter(Boolean).join(" ")}>
            {/* -------------------------------- Details ------------------------------- */}
            <Section title={t("meeting_details")} icon="calendar-days">
                <Field label={t("meeting_type")} value={meeting.type_external ?? meeting.type} />
                <Field label={t("meeting_state")} value={meeting.state} />
                <Field label={t("meeting_number")} value={meeting.number} />
                <Field label={t("meeting_location")} value={meeting.location} />
                <Field label={t("meeting_period")} value={period} />
                <Field label={t("description")} value={meeting.description} />
            </Section>

            {/* -------------------------------- Group --------------------------------- */}
            {group ? (
                <Section title={t("meeting_group")} icon="users-2">
                    <Field label={t("meeting_group")}>
                        {groupName && groupHref ? (
                            <InternalLink to={groupHref}>{groupName}</InternalLink>
                        ) : groupName ? (
                            groupName
                        ) : null}
                    </Field>
                    <Field label={t("group_type")} value={group.type_harmonized} />
                    <Field label={t("group_abbreviation")} value={group.abbreviation} />
                </Section>
            ) : null}

            {/* ----------------------- References & source ------------------------- */}
            <Section title={t("section_references")} icon="file-text">
                <Field label={t("meeting_body")}>
                    {bodyName && bodyHref ? (
                        <InternalLink to={bodyHref}>{bodyName}</InternalLink>
                    ) : bodyName ? (
                        bodyName
                    ) : null}
                </Field>
                <ExternalLinkField
                    label={t("external_link")}
                    href={externalUrl}
                    linkText={t("official_profile")}
                    host={externalHost}
                />
            </Section>
        </div>
    );
}

export default MeetingFull;