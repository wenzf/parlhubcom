// _shared/rows/DocRow.tsx
//
// One document row, shared by every "docs" feed (/affairs/:id/docs,
// /bodies/:id/docs, …). Presentational + href-driven: the caller resolves
// `docHref` (the document's own detail page) so this row carries no routing /
// namespace knowledge. The FILE itself is the external link at the row's bottom.
// (Structured data for the document lives in the /docs/:id page's head JSON-LD.)
//
// Extracted from the byte-identical DocRow copies in AffairDocs / BodyDocs.

import type { DocClient } from "@/types/opd_db";
import { formatDate } from "~/lib/domain/person";

import { Badge } from "@/components/ui/badge";
import { InternalLink, MetaItem, hostLabel, type TFunc } from "../../../opd_views/opd_micros";
import { Icon } from "../../../icons/opd_icons";

/** Human-readable byte size (e.g. 1536 → "1.5 KB"). null for empty input. */
export function formatSize(n: number | null | undefined): string | null {
    if (n == null || !Number.isFinite(n) || n <= 0) return null;
    const units = ["B", "KB", "MB", "GB"];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${i === 0 ? v : v.toFixed(1)} ${units[i]}`;
}

export interface DocRowProps {
    doc: DocClient;
    t: TFunc;
    locale: string;
    /** Internal link to the document's own page (lang-prefixed by the caller). */
    docHref: string;
}

export function DocRow({ doc, t, locale, docHref }: DocRowProps) {
    const url = doc.url ?? doc.url_oparl ?? null;
    const name = doc.name ?? doc.category ?? t("section_docs");
    const domain = hostLabel(url);
    const format = doc.format ? doc.format.toUpperCase() : null;
    const size = formatSize(doc.size);
    const category = doc.category ?? null;
    const date = formatDate(doc.date, locale);
    const language = doc.language ?? null;

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    <InternalLink to={docHref}>
                        <span>{name}</span>
                    </InternalLink>
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

                {url ? (
                    <div className="text-xs">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            <Icon name="external-link" className="size-3 shrink-0" />
                            <span>
                                {t("external_link")}
                                {domain ? ` (${domain})` : ""}
                            </span>
                        </a>
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default DocRow;