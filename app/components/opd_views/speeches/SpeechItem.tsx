// SpeechItem.tsx             → ~/components/opd_views/speeches/SpeechItem.tsx
//
// The single presentational unit for one speech, shared by BOTH surfaces:
//   • the /speeches catalogue       → <SpeechItem variant="row" …>  (a <li>;
//     heading = speaker, links to the speech's own /speeches/:id page via `selfHref`)
//   • the /speeches/:id detail page  → <SpeechItem variant="page" …> (a standalone
//     <article>; heading is the page title, no self-link)
//
// Renders: the speaker headline, language + type badges, a body · date · media
// meta line, and the transcript as sanitized rich HTML (.opd-richtext). Search
// matches are wrapped in <mark class="opd-hl"> when `highlightRe` is supplied.
//
// The highlight helpers mirror the texts ones (kept local so speeches stays
// self-contained).

import * as React from "react";
import type { SpeechClient, BodyClient, PersonClient } from "@/types/opd_db";
import { formatEpoch } from "~/lib/domain/person";
import { sanitize } from "~/lib/security/sanitize";

import { Badge } from "@/components/ui/badge";
import { InternalLink, MetaItem, bodyName as getBodyName, codeSuffix } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";

/* ------------------------------ highlighting ------------------------------ */

export function asGlobal(re: RegExp): RegExp {
    const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
    return new RegExp(re.source, flags);
}

export function highlightNodes(
    text: string,
    re: RegExp | null,
): React.ReactNode {
    if (!re || !text) return text;
    const r = asGlobal(re);
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
        if (m.index > last) out.push(text.slice(last, m.index));
        out.push(
            <mark className="opd-hl" key={`${m.index}-${out.length}`}>
                {m[0]}
            </mark>,
        );
        last = m.index + m[0].length;
        if (m[0].length === 0) r.lastIndex++;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

export function highlightHtml(html: string, re: RegExp | null): string {
    if (!re || !html) return html;
    return html.replace(/<[^>]+>|[^<]+/g, (seg) =>
        seg.charAt(0) === "<"
            ? seg
            : seg.replace(asGlobal(re), (mm) => `<mark class="opd-hl">${mm}</mark>`),
    );
}

/* --------------------------------- item ----------------------------------- */

export interface SpeechItemProps {
    speech: SpeechClient;
    t: (key: string) => string;
    locale: string;
    /** The speaker (p.id = speech.person_id), for the headline. */
    speaker?: PersonClient | undefined;
    /** The chamber (b.id = speech.body_id), for the meta line. */
    body?: BodyClient | undefined;
    highlightRe?: RegExp | null;
    /** When set, the heading links here — the speech's own /speeches/:id page. */
    selfHref?: string | null;
    variant?: "row" | "page";
    position?: number;
}

export function SpeechItem({
    speech,
    t,
    locale,
    speaker,
    body,
    highlightRe = null,
    selfHref = null,
    variant = "row",
    position,
}: SpeechItemProps) {
    const isPage = variant === "page";
    const re = highlightRe ?? null;

    const speakerName = speaker?.fullname ?? null;
    const heading =
        speakerName ?? speech.type_external ?? t("speech_untitled");
    const headingNodes = React.useMemo(
        () => highlightNodes(heading, re),
        [heading, re],
    );

    const transcript = speech.text_content ?? null;
    const cleanHtml = React.useMemo(
        () => (transcript ? highlightHtml(sanitize(transcript), re) : ""),
        [transcript, re],
    );

    const typeLabel = speech.type_external ?? null;
    const role = speech.person_role ?? null;
    const party = speaker?.party ?? null;
    const date = formatEpoch(speech.date_start ?? null, locale);

    const bodyName = getBodyName(body);
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);
    const hasBody = bodyName || speech.body_key;

    // On the detail page the video renders as a link box (SpeechFull); the compact
    // inline link is only for catalogue rows.
    const showVideoLink = !!speech.video_url && !isPage;

    const badges = (
        <>
            {speech.speech_lang ? (
                <Badge
                    variant="outline"
                    className="font-normal uppercase text-muted-foreground"
                >
                    {speech.speech_lang}
                </Badge>
            ) : null}
            {typeLabel ? (
                <Badge variant="secondary" className="font-normal">
                    {typeLabel}
                </Badge>
            ) : null}
        </>
    );

    const headingText = speakerName ? (
        <>
            <span>{headingNodes}</span>
            {party ? (
                <span className="font-normal text-muted-foreground"> · {party}</span>
            ) : null}
        </>
    ) : (
        <span>{headingNodes}</span>
    );

    const headingBlock = isPage ? (
        <div className="space-y-1.5">
            <h1 className="text-lg font-semibold leading-snug">{headingText}</h1>
            <div className="flex flex-wrap items-center gap-2">{badges}</div>
        </div>
    ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
            {selfHref ? (
                <InternalLink to={selfHref}>
                    {headingText}
                </InternalLink>
            ) : (
                headingText
            )}
            {badges}
        </div>
    );

    const media = (
        <>
            {showVideoLink ? (
                <a
                    href={speech.video_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <Icon name="video" className="size-3.5" />
                    {t("speech_video")}
                </a>
            ) : null}
            {speech.audio_url ? (
                <a
                    href={speech.audio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <Icon name="volume-2" className="size-3.5" />
                    {t("speech_audio")}
                </a>
            ) : null}
        </>
    );

    const content = (
        <>
            {headingBlock}

            {hasBody || date || role ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {hasBody ? (
                        <MetaItem icon="landmark">
                            {bodyName ? (
                                <>
                                    <span>{bodyName}</span>
                                    {cantonSuffix ? <span> ({cantonSuffix})</span> : null}
                                </>
                            ) : (
                                speech.body_key
                            )}
                        </MetaItem>
                    ) : null}
                    {date ? <MetaItem icon="calendar-days">{date}</MetaItem> : null}
                    {role ? <MetaItem icon="mic">{role}</MetaItem> : null}
                    {speech.audio_url || showVideoLink ? (
                        <span className="inline-flex items-center gap-3">{media}</span>
                    ) : null}
                </div>
            ) : null}

            {cleanHtml ? (
                <div
                    className="opd-richtext"
                    lang={speech.speech_lang ?? undefined}
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{ __html: cleanHtml }}
                />
            ) : null}
        </>
    );

    if (isPage) {
        return <article className="min-w-0 space-y-2">{content}</article>;
    }

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">{content}</div>
        </li>
    );
}

export default SpeechItem;