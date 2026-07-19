// TextItem.tsx                  → ~/components/opd_views/texts/TextItem.tsx
//
// The single presentational unit for one text block (from the `texts` table),
// shared by BOTH surfaces:
//   • the /texts catalogue       → <TextItem variant="row" …>  (a <li>, heading
//     links to the text's own /texts/:id page via `selfHref`)
//   • the /texts/:id detail page → <TextItem variant="page" …> (a standalone
//     <article>, heading is the page title, no self-link)
//
// It renders: the localized `type` heading, language + format badges, the
// institution + date meta line, an optional parent-affair link, and the text
// body as sanitized rich HTML. Search matches are wrapped in <mark class="opd-hl">
// when a `highlightRe` is supplied (see dimension_descriptors.buildTextHighlightRegex).
//
// The highlight helpers are exported so other text surfaces can reuse them.

import * as React from "react";
import type { TextClient, BodyClient } from "@/types/opd_db";
import { formatDate } from "~/lib/domain/person";
import { sanitize } from "~/lib/security/sanitize";

import { Badge } from "@/components/ui/badge";
import { MetaItem, InternalLink, bodyName as getBodyName, codeSuffix } from "../opd_micros";

/* ------------------------------ highlighting ------------------------------ */

/** Clone a regex with the global flag set and lastIndex reset (so reuse across
 *  rows / segments never carries state). */
export function asGlobal(re: RegExp): RegExp {
    const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
    return new RegExp(re.source, flags);
}

/** Split a PLAIN string into React nodes, wrapping each match in <mark>. */
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
        if (m[0].length === 0) r.lastIndex++; // guard against a zero-width match
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

/** Wrap matches in an already-sanitized HTML string, touching only the text
 *  BETWEEN tags (tags are passed through untouched), so markup stays valid. The
 *  injected <mark> is static/trusted. (Matches that straddle a tag boundary, or
 *  fall inside an HTML entity, are left unhighlighted — an acceptable edge.) */
export function highlightHtml(html: string, re: RegExp | null): string {
    if (!re || !html) return html;
    return html.replace(/<[^>]+>|[^<]+/g, (seg) =>
        seg.charAt(0) === "<"
            ? seg
            : seg.replace(asGlobal(re), (mm) => `<mark class="opd-hl">${mm}</mark>`),
    );
}

/* --------------------------------- item ----------------------------------- */

export interface TextItemProps {
    text: TextClient;
    t: (key: string) => string;
    locale: string;
    /** The text's institution (b.id = texts.body_id), for the meta line. */
    body?: BodyClient | undefined;
    /** Keyword regex → <mark> the matches; null = no highlighting. */
    highlightRe?: RegExp | null;
    /** Link to the parent affair (/affairs/:id), or null when none / suppressed. */
    affairHref?: string | null;
    /** When set, the heading links here — the text's own /texts/:id page. Only the
     *  catalogue ("row") passes it; the detail page leaves it null. */
    selfHref?: string | null;
    /** "row" = compact list item (<li>, schema ListItem); "page" = the single text
     *  as a standalone <article> with a larger heading. */
    variant?: "row" | "page";
    /** 1-based index within the list (row variant only) for schema ListItem. */
    position?: number;
}

export function TextItem({
    text,
    t,
    locale,
    body,
    highlightRe = null,
    affairHref = null,
    selfHref = null,
    variant = "row",
    position,
}: TextItemProps) {
    const isPage = variant === "page";
    const re = highlightRe ?? null;

    const heading = text.type ?? text.type_en ?? t("text_untitled");
    const headingNodes = React.useMemo(
        () => highlightNodes(heading, re),
        [heading, re],
    );

    const body_html = text.text ?? null;
    // Sanitize first, then inject <mark> into the text nodes only.
    const cleanHtml = React.useMemo(
        () => (body_html ? highlightHtml(sanitize(body_html), re) : ""),
        [body_html, re],
    );

    const format = text.text_format ? text.text_format.toUpperCase() : null;
    const date = formatDate(text.text_date, locale);
    const affairTitle = text.affair_title ?? t("affair_untitled");
    const affairTitleNodes = React.useMemo(
        () => highlightNodes(affairTitle, re),
        [affairTitle, re],
    );

    // Institution snippet (resolved via b.id = texts.body_id), falling back to body_key.
    const bodyName = getBodyName(body);
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);
    const hasBody = bodyName || text.body_key;

    const badges = (
        <>
            {text.text_lang ? (
                <Badge
                    variant="outline"
                    className="font-normal uppercase text-muted-foreground"
                >
                    {text.text_lang}
                </Badge>
            ) : null}
            {format ? (
                <Badge variant="secondary" className="font-normal">
                    {format}
                </Badge>
            ) : null}
        </>
    );

    const headingBlock = isPage ? (
        <div className="space-y-1.5">
            <h1 className="text-lg font-semibold leading-snug">{headingNodes}</h1>
            <div className="flex flex-wrap items-center gap-2">{badges}</div>
        </div>
    ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
            {selfHref ? (
                <InternalLink to={selfHref}>{headingNodes}</InternalLink>
            ) : (
                <span>{headingNodes}</span>
            )}
            {badges}
        </div>
    );

    const content = (
        <>
            {headingBlock}

            {hasBody || date ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {hasBody ? (
                        <MetaItem icon="landmark">
                            {bodyName ? (
                                <>
                                    <span>{bodyName}</span>
                                    {cantonSuffix ? <span> ({cantonSuffix})</span> : null}
                                </>
                            ) : (
                                text.body_key
                            )}
                        </MetaItem>
                    ) : null}
                    {date ? <MetaItem icon="calendar-days">{date}</MetaItem> : null}
                </div>
            ) : null}

            {text.affair_title && affairHref ? (
                <div className="text-xs">
                    <MetaItem icon="file-text">
                        <InternalLink to={affairHref}>{affairTitleNodes}</InternalLink>
                    </MetaItem>
                </div>
            ) : null}

            {cleanHtml ? (
                <div
                    className="opd-richtext"
                    lang={text.text_lang ?? undefined}
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

export default TextItem;