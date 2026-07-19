// _shared/rows/TextRow.tsx
//
// One text-block row for the "texts" FEEDS (/affairs/:id/texts and
// /bodies/:id/texts), rendered inside <FeedShell> by _shared/feeds/TextsFeed.
// A localized type heading + a FORMAT badge + date + the text body as sanitized
// rich HTML, wrapped in a plain <li>.
// Presentational + href-driven: the caller resolves `affairHref` (null to
// suppress the parent-affair link — e.g. on the affair's own route where every
// text is the current affair).
//
// NB: the /texts CATALOGUE and the /texts/:id detail page do NOT use this row —
// they use texts/TextItem, a richer superset (search highlight, language badge,
// institution line). TextRow stays separate on purpose: a leaner feed row.
//
// Extracted from the byte-identical TextRow copies in AffairTexts / BodyTexts.

import * as React from "react";
import type { TextClient } from "@/types/opd_db";
import { formatDate } from "~/lib/domain/person";
import { sanitize } from "~/lib/security/sanitize";

import { Badge } from "@/components/ui/badge";
import { MetaItem, InternalLink, type TFunc } from "../../../opd_views/opd_micros";

export interface TextRowProps {
    text: TextClient;
    t: TFunc;
    locale: string;
    /** Link to the parent affair; null suppresses it (affair's own route). */
    affairHref: string | null;
}

export function TextRow({ text, t, locale, affairHref }: TextRowProps) {
    const heading = text.type ?? text.type_en ?? t("text_untitled");
    const body = text.text ?? null;
    const cleanHtml = React.useMemo(() => (body ? sanitize(body) : ""), [body]);
    const format = text.text_format ? text.text_format.toUpperCase() : null;
    const date = formatDate(text.text_date, locale);
    const affairTitle = text.affair_title ?? t("affair_untitled");

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    <span>{heading}</span>
                    {format ? (
                        <Badge variant="secondary" className="font-normal">
                            {format}
                        </Badge>
                    ) : null}
                </div>

                {date || affairHref ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {date ? <MetaItem icon="calendar-days">{date}</MetaItem> : null}
                        {affairHref ? (
                            <InternalLink to={affairHref}>{affairTitle}</InternalLink>
                        ) : null}
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
            </div>
        </li>
    );
}

export default TextRow;