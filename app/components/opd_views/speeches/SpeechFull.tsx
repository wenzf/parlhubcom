// SpeechFull.tsx             → ~/components/opd_views/speeches/SpeechFull.tsx
//
// The /speeches/:id detail surface: ONE speech rendered in full, reusing
// <SpeechItem> (variant="page") for the headline + transcript, then the LINKED
// entities the user can navigate to:
//   • person  (person_id)  → /people/:id     (internal)
//   • body    (body_id)    → /bodies/:id      (internal)
//   • affair  (affair_id)  → /affairs/:id     (internal)
//   • meeting (meeting_id) → external url     (no internal route)
//   • agenda  (agenda_id)  → external url     (no internal route)
// Each linked item renders only when its record was found in the lookup.

import * as React from "react";
import type {
    SpeechClient,
    PersonClient,
    BodyClient,
    AffairClient,
    MeetingClient,
    AgendaClient,
} from "@/types/opd_db";

import { makeT, AttributionFooter, InternalLink, LinkedItem, Labelled, DetailCard, bodyName as getBodyName } from "../opd_micros";
import { SpeechItem } from "./SpeechItem";

/** Readable host for an external URL (drops the leading www.), null if unparseable. */
function hostOf(url: string | null): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}


export interface SpeechFullProps {
    speech: SpeechClient;
    speaker?: PersonClient | undefined;
    body?: BodyClient | undefined;
    affair?: AffairClient | undefined;
    meeting?: MeetingClient | undefined;
    agenda?: AgendaClient | undefined;
    /** Internal hrefs (null when the id / record is absent). */
    personHref?: string | null;
    bodyHref?: string | null;
    affairHref?: string | null;
    /** /speeches catalogue link (back). */
    backHref?: string | null;
    /** Top-right controls (e.g. <DataExport /> with the print action). */
    actions?: React.ReactNode;
    loc?: Record<string, string> | undefined;
    locale?: string;
    className?: string;
}

export function SpeechFull({
    speech,
    speaker,
    body,
    affair,
    meeting,
    agenda,
    personHref = null,
    bodyHref = null,
    affairHref = null,
    backHref = null,
    actions,
    loc = {},
    locale = "de-CH",
    className,
}: SpeechFullProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);

    const bodyName = getBodyName(body);
    const meetingUrl = meeting?.url_external ?? null;
    const agendaUrl = agenda?.item_url ?? null;

    // Upstream source URLs, each shown as an external link box.
    const videoUrl = speech.video_url ?? null;
    const transcriptUrl = speech.url ?? null;

    return (
        <DetailCard
            backHref={backHref}
            backLabel={t("view_all_speeches")}
            actions={actions}
            className={className}
        >
            <SpeechItem
                variant="page"
                speech={speech}
                t={t}
                locale={locale}
                speaker={speaker}
                body={body}
            />

            {/* Video → external source url */}
            {videoUrl ? (
                <Labelled label={t("speech_video")}>
                    <LinkedItem
                        icon="video"
                        title={hostOf(videoUrl) ?? t("speech_video")}
                        href={videoUrl}
                        external
                    />
                </Labelled>
            ) : null}

            {/* Transcript → external source url */}
            {transcriptUrl ? (
                <Labelled label={t("speech_transcript")}>
                    <LinkedItem
                        icon="message-square-quote"
                        title={hostOf(transcriptUrl) ?? t("speech_transcript")}
                        href={transcriptUrl}
                        external
                    />
                </Labelled>
            ) : null}

            {/* Speaker → /people/:id */}
            {speaker?.fullname && personHref ? (
                <Labelled label={t("speech_person")}>
                    <LinkedItem
                        icon="user"
                        title={speaker.fullname}
                        subtitle={speaker.party ?? undefined}
                        href={personHref}
                    />
                </Labelled>
            ) : null}

            {/* Institution → /bodies/:id */}
            {bodyName && bodyHref ? (
                <Labelled label={t("speech_body")}>
                    <LinkedItem
                        icon="landmark"
                        title={bodyName}
                        href={bodyHref}
                    />
                </Labelled>
            ) : null}

            {/* Affair → /affairs/:id */}
            {affair?.title && affairHref ? (
                <Labelled label={t("speech_affair")}>
                    <LinkedItem
                        icon="file-text"
                        title={affair.title}
                        subtitle={affair.type_name ?? undefined}
                        href={affairHref}
                    />
                </Labelled>
            ) : null}

            {/* Meeting → external url (no internal route) */}
            {meeting?.name && meetingUrl ? (
                <Labelled label={t("speech_meeting")}>
                    <LinkedItem
                        icon="calendar-range"
                        title={meeting.name}
                        href={meetingUrl}
                        external
                    />
                </Labelled>
            ) : null}

            {/* Agenda item → external url (no internal route) */}
            {agenda?.item_title && agendaUrl ? (
                <Labelled label={t("speech_agenda")}>
                    <LinkedItem
                        icon="list-ordered"
                        title={agenda.item_title}
                        subtitle={agenda.item_number_display ?? undefined}
                        href={agendaUrl}
                        external
                    />
                </Labelled>
            ) : null}

            <AttributionFooter t={t} className="border-t pt-3 text-xs text-muted-foreground" />
        </DetailCard>
    );
}

export default SpeechFull;