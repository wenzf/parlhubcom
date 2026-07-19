// PersonSpeeches.tsx
//
// Speech record for a member of parliament — the interventions ("Voten" /
// "Reden") the person delivered, the business they spoke to, and the sitting
// they spoke in. Two variants:
//   • "page"    — the /people/:id/speeches dimension route: paginated, with a
//                 CC BY 4.0 data credit. Rendered BELOW <PersonBase />.
//   • "snippet" — embedded on the overview route: shows the rows the loader
//                 passed (no pager) plus a link to the full feed.
// Like <PersonVotes />, it owns only its own panel and never re-emits identity
// properties, so nothing is declared twice on the page.
//
// Domain: a `SpeechClient` row is one speaking turn by this person.
//   • person_role          — the capacity the person spoke in (rapporteur,
//                            committee spokesperson, …). Localized.
//   • date_start / date_end — when the speech was delivered (epoch-millis).
//   • affair_id            — the parliamentary business the speech is ABOUT;
//                            enriched from the response-scoped `affairs` (title,
//                            number, type, state, official record). This is the
//                            headline, linked internally to /affairs/:id.
//   • meeting_id           — the sitting it happened in; enriched from
//                            `meetings` (internal /meetings/:id link).
//   • agenda_id            — the agenda item (Traktandum) under discussion;
//                            enriched from `agendas` (item number + title, with
//                            the source's own item_url when present).
//   • type_external        — the source's speech category. Localized → left chip.
//   • url / audio_url / video_url — the official transcript and AV recordings.
//   • text_content         — the speech transcript (localized).
//
// Title enrichment: the speeches query is response-scoped — alongside the speech
// rows it returns the distinct `affairs`, `meetings` and `agendas` behind THIS
// page (affairs.id = affair_id, meetings.id = meeting_id, agendas.id =
// agenda_id). Pass them as `affairs` / `meetings` / `agendas`.
//
// Transcript: per the project's structured-data note, we deliberately DO NOT dump
// the full `text_content` into the DOM — long transcript bodies don't belong in
// every list row. We render a short, visible EXCERPT (capped + line-clamped) and
// link the full text via the official `url`.
//
// This panel carries no structured data of its own — the person page's graph
// (ProfilePage + Person + bulk Datasets) is emitted as head JSON-LD by the route
// meta() (metas/person.ts). The per-speech rows stay purely presentational.
//
// Conventions:
//   • Reverse-chronological by speech date (newest first), id desc as the stable
//     tiebreak — matches the query's ORDER BY date_start DESC NULLS LAST.
//   • Rows can span bodies, so every row shows its own body label.
//   • Pagination ("page") is driven by a URL search param so it is SSR-friendly
//     and linkable; total_count is the unpaginated count, items is the slice.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useSearchParams, useParams } from "react-router";
import type {
    PersonClient,
    IdentityClient,
    BodyClient,
    AffairClient,
    MeetingClient,
    AgendaClient,
    SpeechClient,
} from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import {
    buildBodyLookup,
    bodyLabel,
    formatEpoch,
} from "~/lib/domain/person";

import { makeT, MetaItem, feedPath, InternalLink, isoOf, Chip, ExternalAction } from "../opd_micros";
import { meetingHref, speechHref } from "~/lib/urls/hrefs";
import { sanitize } from "~/lib/security/sanitize";
import { Icon } from "../../icons/opd_icons";
import { parseRaw } from "~/lib/dimensions/filters";
import {
    speechesDescriptor,
    withBodyOptions,
    withCodeOptions,
    buildTextHighlightRegex,
} from "~/lib/dimensions/descriptors";
import { FeedShell } from "../_shared/feeds/FeedShell";
// Reuse the speeches highlighter so matches render identically to /speeches.
import { highlightHtml } from "../speeches/SpeechItem";

export interface PersonSpeechesProps {
    /** The person record. `persons.id` is the canonical (primary) id and drives
     *  the feed link. Every speech below was delivered by this person. */
    persons: PersonClient;
    /** The page slice + unpaginated count: `dat.speeches`. */
    speeches: PaginatedList<SpeechClient>;
    /** Sibling identities grouped under the person (accepted for parity; not
     *  rendered here). */
    identities?: IdentityClient[];
    /** Bodies referenced by the rows, for per-row body labels. */
    bodies?: BodyClient[];
    /** Response-scoped lookups for row enrichment: the distinct affairs /
     *  meetings / agenda items behind the speeches ON THIS PAGE. */
    affairs?: AffairClient[];
    meetings?: MeetingClient[];
    agendas?: AgendaClient[];
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    /**
     * "page"    — full dimension route: pagination + data credit (default).
     * "snippet" — embedded on the overview: no pager, just the rows the loader
     *             passed plus a link to the full /people/:id/speeches feed.
     */
    variant?: "page" | "snippet";
    /** Page size ($7) and page start ($8), echoed from the loader. ("page" only.) */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. ("page" only.) */
    pageParam?: string;
    className?: string;
}

/* -------------------------------- component ------------------------------- */

export function PersonSpeeches({
    persons,
    speeches,
    identities: _identities = [],
    bodies = [],
    affairs = [],
    meetings = [],
    agendas = [],
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 5,
    offset = 0,
    pageParam = "offset",
    className,
}: PersonSpeechesProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);
    const [searchParams] = useSearchParams();

    // id -> record lookups so each speech can resolve its parent business, the
    // meeting it was delivered in, and the agenda item under discussion.
    const affairById = React.useMemo(
        () => new Map(affairs.map((a) => [a.id, a])),
        [affairs],
    );
    const meetingById = React.useMemo(
        () => new Map(meetings.map((m) => [m.id, m])),
        [meetings],
    );
    const agendaById = React.useMemo(
        () => new Map(agendas.map((g) => [g.id, g])),
        [agendas],
    );

    const isPage = variant === "page";
    const personId = persons.id;

    // Descriptor with both runtime-injected selects filled: body from the response
    // `bodies`, type from the speeches' type_external_id codes (label = localized
    // type_external).
    const descriptor = React.useMemo(
        () =>
            withBodyOptions(
                withCodeOptions(
                    speechesDescriptor,
                    "type",
                    (speeches.items ?? []) as unknown as Record<string, unknown>[],
                    "type_external_id",
                    (r) => (r.type_external as string) ?? String(r.type_external_id ?? ""),
                ),
                bodies,
            ),
        [bodies, speeches.items],
    );

    // Parse the active criteria once; the match highlighter is compiled from the
    // SAME (term, case, word) criteria the SQL matched on, so highlights never
    // disagree with the results. Only on the page variant (snippet has no search).
    const current = React.useMemo(
        () => parseRaw(descriptor, searchParams),
        [descriptor, searchParams],
    );
    const highlightRe = React.useMemo(
        () => (isPage ? buildTextHighlightRegex(current) : null),
        [isPage, current],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            feedHref={feedPath(personId, "speeches")}
            icon="mic"
            titleKey="section_speeches"
            titleFallback="Speeches"
            emptyKey="no_speeches"
            emptyFallback="No recorded speeches."
            noResultsFallback="No speeches match your search."
            viewAllKey="view_all_speeches"
            viewAllFallback="View all speeches"
            list={speeches}
            ordered
            renderRow={(s) => (
                <SpeechRow
                    key={s.id}
                    speech={s}
                    t={t}
                    locale={locale}
                    highlightRe={highlightRe}
                    bodyLabelText={bodyLabel(s.body_key, bodyLookup)}
                    affair={s.affair_id != null ? affairById.get(s.affair_id) ?? null : null}
                    meeting={s.meeting_id != null ? meetingById.get(s.meeting_id) ?? null : null}
                    agenda={s.agenda_id != null ? agendaById.get(s.agenda_id) ?? null : null}
                />
            )}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            className={className}
        />
    );
}

/* --------------------------------- a row ---------------------------------- */

function SpeechRow({
    speech,
    t,
    locale,
    highlightRe,
    bodyLabelText,
    affair,
    meeting,
    agenda,
}: {
    speech: SpeechClient;
    t: (key: string) => string;
    locale: string;
    highlightRe: RegExp | null;
    bodyLabelText: string | null;
    affair: AffairClient | null;
    meeting: MeetingClient | null;
    agenda: AgendaClient | null;
}) {
    const params = useParams();
    const date = formatEpoch(speech.date_start, locale);
    const role = speech.person_role ?? null;
    const chipLabel =
        speech.type_external ?? t("speech_type_fallback");

    // Subject of the speech: the affair it was about (linked internally), else
    // the agenda item, else a generic label. Mirrors the votes headline.
    const affairTitle = affair?.title ?? affair?.title_long ?? null;
    const agendaTitle = agenda?.item_title ?? null;

    let subjectTitle: string;
    let subjectHref: string | null = null;
    let subjectNumber: string | null = null;
    let agendaUsedAsSubject = false;

    if (affair) {
        subjectTitle = affairTitle ?? t("speech_untitled");
        subjectHref = `/affairs/${affair.id}`;
        subjectNumber = affair.number ?? null;
    } else if (agendaTitle) {
        subjectTitle = agendaTitle;
        subjectNumber = agenda?.item_number_display ?? null;
        agendaUsedAsSubject = true;
    } else {
        subjectTitle = t("speech_untitled");
    }

    const meetingTitle =
        meeting?.name ?? meeting?.type_external ?? speech.meeting_type ?? null;
    const meetingDate = formatEpoch(meeting?.begin_date, locale);

    // Agenda shown as context only when it isn't already the headline subject.
    const showAgendaContext = !!agenda && !agendaUsedAsSubject;
    const agendaNumber = agenda?.item_number_display ?? null;
    const agendaLabel = agenda?.item_title ?? agenda?.item_category ?? null;
    const agendaUrl = agenda?.item_url ?? null;

    const transcriptHtml = React.useMemo(
        () =>
            speech.text_content
                ? highlightHtml(sanitize(speech.text_content), highlightRe)
                : "",
        [speech.text_content, highlightRe],
    );

    const url = speech.url ?? null;
    const audioUrl = speech.audio_url ?? null;
    const videoUrl = speech.video_url ?? null;

    const hasContext = !!(meeting || showAgendaContext);

    return (
        <li className="grid grid-cols-1 gap-y-1.5 py-3 sm:grid-cols-[7rem_1fr] sm:gap-x-4 sm:gap-y-0">
            {/* speech type — aligned, scannable down the column (neutral) */}
            <div className="justify-self-start sm:justify-self-stretch sm:pt-0.5">
                <Chip>
                    {chipLabel}
                </Chip>
            </div>

            {/* the speech: subject + context + excerpt + media */}
            <div className="min-w-0 space-y-1">
                {/* headline: what the speech was about */}
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium leading-snug">
                    {affair && subjectHref ? (
                        <InternalLink to={subjectHref}>
                            <span>{subjectTitle}</span>
                        </InternalLink>
                    ) : (
                        <span>{subjectTitle}</span>
                    )}
                    {subjectNumber ? (
                        <span className="text-xs font-normal text-muted-foreground">
                            {t("speech_number_prefix")} {subjectNumber}
                        </span>
                    ) : null}
                </div>

                {/* meta: date · role · body */}
                {date || role || bodyLabelText ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {date ? (
                            <time dateTime={isoOf(speech.date_start)}>
                                {date}
                            </time>
                        ) : null}
                        {role ? <MetaItem icon="mic">{role}</MetaItem> : null}
                        {bodyLabelText ? (
                            <MetaItem icon="landmark">{bodyLabelText}</MetaItem>
                        ) : null}
                    </div>
                ) : null}

                {/* context: meeting (internal) · agenda item */}
                {hasContext ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {meeting ? (
                            <MetaItem icon="calendar-days">
                                <span>
                                    <InternalLink to={meetingHref(params.lang, meeting.id)}>
                                        <span>{meetingTitle ?? t("meeting")}</span>
                                    </InternalLink>
                                    {meetingDate ? (
                                        <span className="text-muted-foreground/80">
                                            {" "}
                                            ·{" "}
                                            <time dateTime={isoOf(meeting?.begin_date)}>
                                                {meetingDate}
                                            </time>
                                        </span>
                                    ) : null}
                                </span>
                            </MetaItem>
                        ) : null}
                        {showAgendaContext ? (
                            <MetaItem icon="list-ordered">
                                <span>
                                    {t("speech_agenda")}
                                    {agendaNumber ? ` ${agendaNumber}` : ""}
                                    {agendaLabel ? `: ${agendaLabel}` : ""}
                                </span>
                                {agendaUrl ? (
                                    <a
                                        href={agendaUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-1 inline-flex items-center text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        aria-label={t("speech_agenda")}
                                    >
                                        <Icon name="external-link" className="size-3 shrink-0" />
                                    </a>
                                ) : null}
                            </MetaItem>
                        ) : null}
                    </div>
                ) : null}

                {/* transcript — sanitized rich text (rendered as HTML) */}
                {transcriptHtml ? (
                    <div
                        className="opd-richtext text-sm"
                        lang={speech.speech_lang ?? undefined}
                        suppressHydrationWarning
                        dangerouslySetInnerHTML={{ __html: transcriptHtml }}
                    />
                ) : null}

                {/* record & media: speech page (internal) · transcript · audio · video */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-xs">
                    <InternalLink to={speechHref(params.lang, speech.id)}>
                        {t("speech_detail")}
                    </InternalLink>
                    {url ? (
                        <ExternalAction icon="file-text" href={url}>
                            {t("speech_transcript")}
                        </ExternalAction>
                    ) : null}
                    {audioUrl ? (
                        <ExternalAction icon="volume-2" href={audioUrl}>
                            {t("speech_audio")}
                        </ExternalAction>
                    ) : null}
                    {videoUrl ? (
                        <ExternalAction icon="video" href={videoUrl}>
                            {t("speech_video")}
                        </ExternalAction>
                    ) : null}
                </div>
            </div>
        </li>
    );
}

export default PersonSpeeches;