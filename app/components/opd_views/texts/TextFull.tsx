// TextFull.tsx                  → ~/components/opd_views/texts/TextFull.tsx
//
// The /texts/:id detail surface: ONE text rendered in full, reusing <TextItem>
// (variant="page") so the body / badges / rich-text rendering stay identical to
// the catalogue row. Adds the page chrome the row doesn't have: a "back to all
// texts" link, the LINKED AFFAIR item (title + type, → /affairs/:id), an explicit
// institution link (→ /bodies/:id), and the CC-BY data credit.
//
// The inline affair line inside <TextItem> is suppressed here (affairHref=null)
// so the affair shows once, as the richer item below.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback.

import * as React from "react";
import { NavLink } from "react-router";
import type { TextClient, BodyClient, AffairClient } from "@/types/opd_db";

import { Badge } from "@/components/ui/badge";

import { makeT, AttributionFooter, MetaItem, InternalLink, DetailCard, bodyName as getBodyName } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";
import { TextItem } from "./TextItem";

export interface TextFullProps {
    text: TextClient;
    body?: BodyClient | undefined;
    /** The parent affair record (texts.affair_id), for the linked-affair item. */
    affair?: AffairClient | undefined;
    /** /affairs/:id link (parent affair), or null when the text has none. */
    affairHref?: string | null;
    /** /bodies/:id link (the institution), or null. */
    bodyHref?: string | null;
    /** /texts catalogue link (back). */
    backHref?: string | null;
    loc?: Record<string, string> | undefined;
    locale?: string;
    className?: string;
}

export function TextFull({
    text,
    body,
    affair,
    affairHref = null,
    bodyHref = null,
    backHref = null,
    loc = {},
    locale = "de-CH",
    className,
}: TextFullProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const bodyName = getBodyName(body);

    // The linked affair: shown ONLY when the affair record was actually found in
    // the lookup (data.affairs). If the text references an affair_id but no affair
    // row resolved, no link is rendered.
    const affairTitle =
        affair?.title ?? text.affair_title ?? t("affair_untitled");
    const affairType = affair?.type_name ?? null;
    const affairNumber = affair?.number ?? null;
    const showAffair = affair != null && Boolean(affairHref);

    return (
        <DetailCard
            backHref={backHref}
            backLabel={t("view_all_texts")}
            className={className}
        >
            {/* The shared single-text renderer (heading · badges · meta · rich-text
            body). affairHref is null here — the affair is shown as its own item. */}
            <TextItem
                variant="page"
                text={text}
                t={t}
                locale={locale}
                body={body}
                affairHref={null}
            />

            {/* Linked affair item → /affairs/:id */}
            {showAffair && affairHref ? (
                <div className="border-t pt-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                        {t("voting_affair")}
                    </div>
                    <NavLink
                        to={affairHref}
                        end
                        viewTransition
                        className="group flex items-start gap-2 rounded-md border p-3 transition-colors hover:bg-muted/50"
                    >
                        <Icon
                            name="file-text"
                            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        />
                        <div className="min-w-0 space-y-1">
                            <div className="text-sm font-medium leading-snug text-primary underline-offset-4 group-hover:underline">
                                {affairTitle}
                            </div>
                            {affairType || affairNumber ? (
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    {affairType ? (
                                        <Badge variant="secondary" className="font-normal">
                                            {affairType}
                                        </Badge>
                                    ) : null}
                                    {affairNumber ? <span>{affairNumber}</span> : null}
                                </div>
                            ) : null}
                        </div>
                        <Icon
                            name="arrow-right"
                            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        />
                    </NavLink>
                </div>
            ) : null}

            {/* Institution link (the row only shows the label). */}
            {bodyName && bodyHref ? (
                <div className="border-t pt-3 text-sm">
                    <MetaItem icon="landmark">
                        <InternalLink to={bodyHref}>{bodyName}</InternalLink>
                    </MetaItem>
                </div>
            ) : null}

            <AttributionFooter t={t} className="border-t pt-3 text-xs text-muted-foreground" />
        </DetailCard>
    );
}

export default TextFull;