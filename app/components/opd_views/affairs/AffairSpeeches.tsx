// AffairSpeeches.tsx
//
// The speeches given on ONE affair — the /affairs/:id/speeches feed. Inverse of
// <PersonSpeeches />: the affair is fixed, the SPEAKERS vary, so each row is
// headlined by the speaker (resolved from the `persons` lookup, linked to their
// person page), with body · date · type chip · transcript excerpt · media links.
//
// Variants:
//   "page"    — full feed route: controls + pager + data credit (default).
//   "snippet" — embedded on the affair overview: rows + a "view all" link.
//
// Facet options are runtime-injected: body from `bodies`, type from the page's
// type_external_id codes. All visible labels come from the `loc` map; the second
// arg to t() is the English fallback.

import * as React from "react";
import { useParams } from "react-router";
import type { SpeechClient, BodyClient, PersonClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { buildBodyLookup, bodyLabel, formatEpoch } from "~/lib/domain/person";
import {
    affairSpeechesDescriptor,
    withBodyOptions,
    withCodeOptions,
} from "~/lib/dimensions/descriptors";
import { localizedPath } from "~/lib/lang";
import { speechHref } from "~/lib/urls/hrefs";

import { InternalLink, makeT, MetaItem, Chip, isoOf, ExternalAction } from "../opd_micros";
import { sanitize } from "~/lib/security/sanitize";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface AffairSpeechesProps {
    /** The filtered page slice + filtered total: `dat.speeches`. */
    speeches: PaginatedList<SpeechClient>;
    /** Response bodies lookup (`dat.bodies.items`) — body facet + per-row label. */
    bodies?: BodyClient[];
    /** Response speakers lookup (`dat.persons.items`) — resolves each row's speaker. */
    persons?: PersonClient[];
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

export function AffairSpeeches({
    speeches,
    bodies = [],
    persons = [],
    loc = {},
    locale = "de-CH",
    variant = "page",
    affairId: _affairId,
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: AffairSpeechesProps) {
    const params = useParams();
    const t = React.useMemo(() => makeT(loc), [loc]);

    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);
    const personById = React.useMemo(() => {
        const m = new Map<number, PersonClient>();
        for (const p of persons) m.set(p.id, p);
        return m;
    }, [persons]);

    // Inject body options from `bodies`, type options from the page's speech codes.
    const descriptor = React.useMemo(
        () =>
            withBodyOptions(
                withCodeOptions(
                    affairSpeechesDescriptor,
                    "type",
                    (speeches.items ?? []) as unknown as Record<string, unknown>[],
                    "type_external_id",
                    (r) => (r.type_external as string) ?? String(r.type_external_id ?? ""),
                ),
                bodies,
            ),
        [bodies, speeches.items],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            feedNs="NS_AFFAIRS_SPEECHES"
            icon="mic"
            titleKey="section_speeches"
            titleFallback="Speeches"
            emptyKey="no_speeches"
            emptyFallback="No recorded speeches."
            noResultsFallback="No speeches match your search."
            viewAllKey="view_all_speeches"
            viewAllFallback="View all speeches"
            mcpNamespace="affair"
            mcpSubject="this affair's"
            list={speeches}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            className={className}
            renderRow={(s) => (
                <SpeechRow
                    key={s.id}
                    speech={s}
                    t={t}
                    locale={locale}
                    speaker={s.person_id != null ? personById.get(s.person_id) : undefined}
                    speakerHref={
                        s.person_id != null
                            ? localizedPath(params.lang, "NS_PEOPLE_OVERVIEW", {
                                id: String(s.person_id),
                            })
                            : null
                    }
                    bodyLabelText={bodyLabel(s.body_key, bodyLookup)}
                />
            )}
        />
    );
}

/* --------------------------------- a row ---------------------------------- */

function SpeechRow({
    speech,
    t,
    locale,
    speaker,
    speakerHref,
    bodyLabelText,
}: {
    speech: SpeechClient;
    t: (key: string) => string;
    locale: string;
    speaker?: PersonClient | undefined;
    speakerHref?: string | null;
    bodyLabelText: string | null;
}) {
    const params = useParams();
    const date = formatEpoch(speech.date_start, locale);
    const role = speech.person_role ?? null;
    const chipLabel = speech.type_external ?? t("speech_type_fallback");

    const joined = [speaker?.firstname, speaker?.lastname].filter(Boolean).join(" ");
    const speakerName = speaker?.fullname ?? (joined || null);
    const party = speaker?.party_harmonized ?? speaker?.party ?? null;

    const transcriptHtml = React.useMemo(
        () => (speech.text_content ? sanitize(speech.text_content) : ""),
        [speech.text_content],
    );

    const url = speech.url ?? null;
    const audioUrl = speech.audio_url ?? null;
    const videoUrl = speech.video_url ?? null;

    return (
        <li className="grid grid-cols-[7rem_1fr] gap-x-4 py-3">
            {/* speech type — aligned down the column */}
            <div className="pt-0.5">
                <Chip>{chipLabel}</Chip>
            </div>

            <div className="min-w-0 space-y-1">
                {/* headline: who spoke */}
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium leading-snug">
                    {speakerName ? (
                        speakerHref ? (
                            <InternalLink to={speakerHref}>
                                <span>{speakerName}</span>
                            </InternalLink>
                        ) : (
                            <span>{speakerName}</span>
                        )
                    ) : (
                        <span className="text-muted-foreground">{t("speech_untitled")}</span>
                    )}
                    {party ? (
                        <span className="font-normal text-muted-foreground">({party})</span>
                    ) : null}
                </div>

                {/* meta: role · body · date */}
                {date || role || bodyLabelText ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {role ? <MetaItem icon="mic">{role}</MetaItem> : null}
                        {bodyLabelText ? <MetaItem icon="landmark">{bodyLabelText}</MetaItem> : null}
                        {date ? (
                            <time dateTime={isoOf(speech.date_start)}>
                                {date}
                            </time>
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

export default AffairSpeeches;
