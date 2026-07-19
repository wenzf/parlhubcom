// DocFull.tsx                → ~/components/opd_views/docs/DocFull.tsx
//
// The /docs/:id detail surface: ONE document rendered in full — its header
// (name, format, size, date, category, language) + the file as an external link,
// then the LINKED entities the user can navigate to:
//   • body    (body_id)    → /bodies/:id    (internal)
//   • affair  (affair_id)  → /affairs/:id   (internal)
//   • meeting (meeting_id) → /meetings/:id  (internal) + external meeting url
//   • agenda  (agenda_id)  → external item_url (no internal route)
// Each linked item renders only when its record was found in the lookup.
//
// Mirrors SpeechFull. The header reuses the shared formatSize() from DocRow.

import * as React from "react";
import type {
    DocClient,
    BodyClient,
    AffairClient,
    MeetingClient,
    AgendaClient,
} from "@/types/opd_db";
import { formatDate } from "~/lib/domain/person";

import { Badge } from "@/components/ui/badge";

import { makeT, AttributionFooter, MetaItem, hostLabel, LinkedItem, Labelled, DetailCard, bodyName as getBodyName } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";
import { formatSize } from "../_shared/rows/DocRow";


export interface DocFullProps {
    doc: DocClient;
    body?: BodyClient | undefined;
    affair?: AffairClient | undefined;
    meeting?: MeetingClient | undefined;
    agenda?: AgendaClient | undefined;
    /** Internal hrefs (null when the id / record is absent). */
    bodyHref?: string | null;
    affairHref?: string | null;
    meetingHref?: string | null;
    /** /docs catalogue link (back). */
    backHref?: string | null;
    loc?: Record<string, string> | undefined;
    locale?: string;
    className?: string;
}

export function DocFull({
    doc,
    body,
    affair,
    meeting,
    agenda,
    bodyHref = null,
    affairHref = null,
    meetingHref = null,
    backHref = null,
    loc = {},
    locale = "de-CH",
    className,
}: DocFullProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);

    const fileUrl = doc.url ?? doc.url_oparl ?? null;
    const name = doc.name ?? doc.category ?? t("doc_untitled");
    const format = doc.format ? doc.format.toUpperCase() : null;
    const size = formatSize(doc.size);
    const category = doc.category ?? null;
    const date = formatDate(doc.date, locale);
    const language = doc.language ?? null;
    const fileDomain = hostLabel(fileUrl);

    const bodyName = getBodyName(body);
    const meetingUrl = meeting?.url_external ?? null;
    const agendaUrl = agenda?.item_url ?? null;

    return (
        <DetailCard
            backHref={backHref}
            backLabel={t("view_all_docs")}
            className={className}
        >
                {/* Document header */}
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h1 className="text-lg font-semibold leading-snug">
                            {name}
                        </h1>
                        {format ? (
                            <Badge variant="secondary" className="font-normal">
                                {format}
                            </Badge>
                        ) : null}
                        {size ? (
                            <span className="text-xs text-muted-foreground">{size}</span>
                        ) : null}
                    </div>

                    {category || date || language ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {category ? <MetaItem icon="tag">{category}</MetaItem> : null}
                            {date ? <MetaItem icon="calendar-days">{date}</MetaItem> : null}
                            {language ? <span className="uppercase">{language}</span> : null}
                        </div>
                    ) : null}

                    {fileUrl ? (
                        <div className="text-sm">
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                <Icon name="external-link" className="size-3.5 shrink-0" />
                                <span>
                                    {t("external_link")}
                                    {fileDomain ? ` (${fileDomain})` : ""}
                                </span>
                            </a>
                        </div>
                    ) : null}
                </div>

                {/* Institution → /bodies/:id */}
                {bodyName && bodyHref ? (
                    <Labelled label={t("doc_body")}>
                        <LinkedItem icon="landmark" title={bodyName} href={bodyHref} />
                    </Labelled>
                ) : null}

                {/* Affair → /affairs/:id */}
                {affair?.title && affairHref ? (
                    <Labelled label={t("doc_affair")}>
                        <LinkedItem
                            icon="file-text"
                            title={affair.title}
                            subtitle={affair.type_name ?? undefined}
                            href={affairHref}
                        />
                    </Labelled>
                ) : null}

                {/* Meeting → /meetings/:id (internal) + external meeting url */}
                {meeting?.name && meetingHref ? (
                    <Labelled label={t("doc_meeting")}>
                        <div className="space-y-2">
                            <LinkedItem
                                icon="calendar-range"
                                title={meeting.name}
                                href={meetingHref}
                            />
                            {meetingUrl ? (
                                <a
                                    href={meetingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                    <Icon name="external-link" className="size-3 shrink-0" />
                                    <span>
                                        {t("external_link")}
                                        {hostLabel(meetingUrl) ? ` (${hostLabel(meetingUrl)})` : ""}
                                    </span>
                                </a>
                            ) : null}
                        </div>
                    </Labelled>
                ) : null}

                {/* Agenda item → external item_url (no internal route) */}
                {agenda?.item_title && agendaUrl ? (
                    <Labelled label={t("doc_agenda")}>
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

export default DocFull;