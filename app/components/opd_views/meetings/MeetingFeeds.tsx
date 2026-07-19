// MeetingFeeds.tsx           → ~/components/opd_views/meetings/MeetingFeeds.tsx
//
// The six sub-feeds of ONE meeting (/meetings/:id/<feed>): agendas · votings ·
// speeches · docs · events · contributors. Each is a PERSON-family feed scoped
// `WHERE <child>.meeting_id = :id`. All six share the `FeedShell` chrome (Card +
// controls + pager + snippet "view all" + CC-BY) and differ only in their row
// renderer, descriptor, title/icon, and feed namespace. Mirrors GroupVotings.
//
// Variants: "page" (full feed route: controls + pager) · "snippet" (embedded on
// the /meetings/:id overview: rows + a "view all (N)" link).

import * as React from "react";
import { useParams } from "react-router";
import type {
    AgendaClient,
    VotingClient,
    SpeechClient,
    DocClient,
    EventClient,
    ContributorClient,
    PersonClient,
    BodyClient,
    AffairClient,
} from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import {
    meetingAgendasDescriptor,
    meetingVotingsDescriptor,
    meetingSpeechesDescriptor,
    meetingDocsDescriptor,
    meetingEventsDescriptor,
    meetingContributorsDescriptor,
} from "~/lib/dimensions/descriptors";
import { affairHref, peopleHref, votingHref } from "~/lib/urls/hrefs";
import { formatEpoch } from "~/lib/domain/person";
import { sanitize } from "~/lib/security/sanitize";

import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, InternalLink, isoOf, keyById, bodyName as getBodyName } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { VotingRow } from "../_shared/rows/VotingRow";
import { DocRow } from "../_shared/rows/DocRow";
import { ContributorRow } from "../_shared/rows/ContributorRow";
import { createLangPathByParam } from "~/lib/lang";

type TFunc = (key: string) => string;

/* ================================ AGENDAS ================================= */

export interface MeetingAgendasProps {
    agendas: PaginatedList<AgendaClient>;
    affairs?: AffairClient[] | undefined;
    loc?: Record<string, string>;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}
export function MeetingAgendas({ agendas, affairs, loc = {}, locale = "de-CH", variant = "page", limit = 20, offset = 0, pageParam = "offset", className }: MeetingAgendasProps) {
    const { lang } = useParams();
    const t = makeT(loc);
    const affairById = keyById(affairs);
    return (
        <FeedShell
            descriptor={meetingAgendasDescriptor} feedNs="NS_MEETINGS_AGENDAS" icon="list-ordered"
            titleKey="section_agendas" titleFallback="Agenda" emptyKey="no_agendas" emptyFallback="No agenda items."
            noResultsFallback="No agenda items match your search." viewAllKey="view_all_agendas" viewAllFallback="View all agenda items"
            mcpNamespace="meeting" mcpSubject="this meeting's"
            list={agendas} loc={loc} locale={locale} variant={variant} limit={limit} offset={offset} pageParam={pageParam} className={className}
            renderRow={(a) => {
                const title = a.item_title ?? t("agenda_untitled");
                const affair = a.item_affair_id != null ? affairById.get(a.item_affair_id) : undefined;
                const affairLink = a.item_affair_id != null ? affairHref(lang, a.item_affair_id) : null;
                return (
                    <li key={a.id} className="py-3">
                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium leading-snug">
                                {a.item_number_display ? <span className="text-muted-foreground">{a.item_number_display}</span> : null}
                                {a.item_url ? (
                                    <a href={a.item_url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">{title}</a>
                                ) : <span>{title}</span>}
                                {a.item_status ? <Badge variant="outline" className="font-normal text-muted-foreground">{a.item_status}</Badge> : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {a.item_category ? <MetaItem icon="tag">{a.item_category}</MetaItem> : null}
                                {a.item_date ? <MetaItem icon="calendar-days">{formatEpoch(a.item_date, locale)}</MetaItem> : null}
                                {a.item_result ? <MetaItem icon="check">{a.item_result}</MetaItem> : null}
                                {affairLink ? (
                                    <MetaItem icon="file-text"><InternalLink to={affairLink}>{affair?.title ?? a.item_affair_number ?? `#${a.item_affair_id}`}</InternalLink></MetaItem>
                                ) : null}
                            </div>
                        </div>
                    </li>
                );
            }}
        />
    );
}

/* ================================ VOTINGS ================================= */

export interface MeetingVotingsProps {
    votings: PaginatedList<VotingClient>;
    bodies?: BodyClient[] | undefined;
    loc?: Record<string, string>;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}
export function MeetingVotings({ votings, bodies, loc = {}, locale = "de-CH", variant = "page", limit = 20, offset = 0, pageParam = "offset", className }: MeetingVotingsProps) {
    const { lang } = useParams();
    const t = makeT(loc);
    const bodyById = keyById(bodies);
    return (
        <FeedShell
            descriptor={meetingVotingsDescriptor} feedNs="NS_MEETINGS_VOTINGS" icon="vote"
            titleKey="section_votings" titleFallback="Votings" emptyKey="no_votings" emptyFallback="No recorded votings."
            noResultsFallback="No votings match your search." viewAllKey="view_all_votings" viewAllFallback="View all votings"
            mcpNamespace="meeting" mcpSubject="this meeting's"
            list={votings} loc={loc} locale={locale} variant={variant} limit={limit} offset={offset} pageParam={pageParam} className={className}
            renderRow={(v) => (
                <VotingRow
                    key={v.id}
                    voting={v}
                    t={t}
                    locale={locale}
                    href={votingHref(lang, v.id)}
                    body={v.body_id != null ? bodyById.get(v.body_id) : undefined}
                    affairHref={v.affair_id != null ? affairHref(lang, v.affair_id) : null}
                />
            )}
        />
    );
}

/* ================================ SPEECHES ================================ */

export interface MeetingSpeechesProps {
    speeches: PaginatedList<SpeechClient>;
    persons?: PersonClient[] | undefined;
    bodies?: BodyClient[] | undefined;
    loc?: Record<string, string>;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}
// `lang` is the tag the transcript was resolved from (loc_lang in the speeches
// SQL) — the content language can differ from the UI language, so it must be
// declared on the block itself (WCAG 3.1.2). Undefined when unknown, which omits
// the attribute rather than emitting an empty one.
function SpeechBody({ html, lang }: { html: string; lang?: string | undefined }) {
    const clean = React.useMemo(() => (html ? sanitize(html) : ""), [html]);
    if (!clean) return null;
    return <div className="opd-richtext mt-1 text-sm" lang={lang} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: clean }} />;
}
export function MeetingSpeeches({ speeches, persons, bodies, loc = {}, locale = "de-CH", variant = "page", limit = 20, offset = 0, pageParam = "offset", className }: MeetingSpeechesProps) {
    const { lang } = useParams();
    const t = makeT(loc);
    const personById = keyById(persons);
    const bodyById = keyById(bodies);
    return (
        <FeedShell
            descriptor={meetingSpeechesDescriptor} feedNs="NS_MEETINGS_SPEECHES" icon="mic"
            titleKey="section_speeches" titleFallback="Speeches" emptyKey="no_speeches" emptyFallback="No speeches."
            noResultsFallback="No speeches match your search." viewAllKey="view_all_speeches" viewAllFallback="View all speeches"
            mcpNamespace="meeting" mcpSubject="this meeting's"
            list={speeches} loc={loc} locale={locale} variant={variant} limit={limit} offset={offset} pageParam={pageParam} className={className}
            renderRow={(s) => {
                const person = s.person_id != null ? personById.get(s.person_id) : undefined;
                const speaker = person?.fullname ?? t("speech_speaker_unknown");
                const personHref = s.person_id != null ? peopleHref(lang, s.person_id) : null;
                const body = s.body_id != null ? bodyById.get(s.body_id) : undefined;
                return (
                    <li key={s.id} className="py-3">
                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium leading-snug">
                                {personHref ? <InternalLink to={personHref}>{speaker}</InternalLink> : <span>{speaker}</span>}
                                {s.person_role ? <span className="font-normal text-muted-foreground">· {s.person_role}</span> : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {s.date_start ? <time dateTime={isoOf(s.date_start)}>{formatEpoch(s.date_start, locale)}</time> : null}
                                {body ? <MetaItem icon="landmark">{getBodyName(body)}</MetaItem> : null}
                                {s.video_url ? <MetaItem icon="video"><a href={s.video_url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">{t("video")}</a></MetaItem> : null}
                            </div>
                            {s.text_content ? <SpeechBody html={s.text_content} lang={s.speech_lang ?? undefined} /> : null}
                        </div>
                    </li>
                );
            }}
        />
    );
}

/* ================================== DOCS ================================= */

export interface MeetingDocsProps {
    docs: PaginatedList<DocClient>;
    loc?: Record<string, string>;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}
export function MeetingDocs({ docs, loc = {}, locale = "de-CH", variant = "page", limit = 20, offset = 0, pageParam = "offset", className }: MeetingDocsProps) {
    const { lang } = useParams();
    const t = makeT(loc);
    return (
        <FeedShell
            descriptor={meetingDocsDescriptor} feedNs="NS_MEETINGS_DOCS" icon="file-text"
            titleKey="section_docs" titleFallback="Documents" emptyKey="no_docs" emptyFallback="No documents."
            noResultsFallback="No documents match your search." viewAllKey="view_all_docs" viewAllFallback="View all documents"
            mcpNamespace="meeting" mcpSubject="this meeting's"
            list={docs} loc={loc} locale={locale} variant={variant} limit={limit} offset={offset} pageParam={pageParam} className={className}
            renderRow={(d) => (
                <DocRow
                    key={d.id}
                    doc={d}
                    t={t}
                    locale={locale}
                    docHref={createLangPathByParam(lang, `/docs/${d.id}`)}
                />
            )}
        />
    );
}

/* ================================= EVENTS ================================ */

export interface MeetingEventsProps {
    events: PaginatedList<EventClient>;
    loc?: Record<string, string>;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}
export function MeetingEvents({ events, loc = {}, locale = "de-CH", variant = "page", limit = 20, offset = 0, pageParam = "offset", className }: MeetingEventsProps) {
    const t = makeT(loc);
    return (
        <FeedShell
            descriptor={meetingEventsDescriptor} feedNs="NS_MEETINGS_EVENTS" icon="calendar-range"
            titleKey="section_events" titleFallback="Events" emptyKey="no_events" emptyFallback="No events."
            noResultsFallback="No events match your search." viewAllKey="view_all_events" viewAllFallback="View all events"
            mcpNamespace="meeting" mcpSubject="this meeting's"
            list={events} loc={loc} locale={locale} variant={variant} limit={limit} offset={offset} pageParam={pageParam} className={className}
            renderRow={(e) => {
                const title = e.title ?? e.title_harmonized ?? t("event_untitled");
                return (
                    <li key={e.id} className="py-3">
                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium leading-snug">
                                {e.details_url ? (
                                    <a href={e.details_url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">{title}</a>
                                ) : <span>{title}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {e.date ? <MetaItem icon="calendar-days">{e.date}</MetaItem> : null}
                                {e.actor ? <MetaItem icon="landmark">{e.actor}</MetaItem> : null}
                            </div>
                            {e.details_text ? <p className="text-sm text-muted-foreground">{e.details_text}</p> : null}
                        </div>
                    </li>
                );
            }}
        />
    );
}

/* ============================== CONTRIBUTORS ============================== */

export interface MeetingContributorsProps {
    contributors: PaginatedList<ContributorClient>;
    persons?: PersonClient[] | undefined;
    affairs?: AffairClient[] | undefined;
    loc?: Record<string, string>;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}
export function MeetingContributors({ contributors, persons, affairs, loc = {}, locale = "de-CH", variant = "page", limit = 20, offset = 0, pageParam = "offset", className }: MeetingContributorsProps) {
    const { lang } = useParams();
    const t = makeT(loc);
    const affairById = keyById(affairs);
    return (
        <FeedShell
            descriptor={meetingContributorsDescriptor} feedNs="NS_MEETINGS_CONTRIBUTORS" icon="users-2"
            titleKey="section_contributors" titleFallback="Contributors" emptyKey="no_contributors" emptyFallback="No contributors."
            noResultsFallback="No contributors match your search." viewAllKey="view_all_contributors" viewAllFallback="View all contributors"
            mcpNamespace="meeting" mcpSubject="this meeting's"
            list={contributors} loc={loc} locale={locale} variant={variant} limit={limit} offset={offset} pageParam={pageParam} className={className}
            renderRow={(c) => (
                <ContributorRow
                    key={c.id}
                    contributor={c}
                    t={t}
                    affair={c.affair_id != null ? affairById.get(c.affair_id) : undefined}
                    affairHref={c.affair_id != null ? affairHref(lang, c.affair_id) : null}
                    personHref={c.person_id != null ? peopleHref(lang, c.person_id) : null}
                />
            )}
        />
    );
}