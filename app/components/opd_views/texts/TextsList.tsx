// TextsList.tsx                 → ~/components/opd_views/texts/TextsList.tsx
//
// The texts DIRECTORY (top-level /texts): a paginated, server-filtered list of
// text blocks (from the `texts` table) with full-text search / filter / sort.
// Driven by `textsDescriptor` + the URL. LIST family (top-level): the loader
// uses runListPaginatedFiltered and `texts` here is already the filtered, sorted
// page slice (total_count is the filtered total).
//
// Search matches the localized text body, the localized type heading, and the
// parent affair title (server-side), honouring the case / whole-word options.
// Facet options: institution (`body`, sourced, grouped by position), `format`
// (page slice), `lang` (de|fr|it|rm — the displayed text language) + the two
// search-option toggles. Matches are highlighted in each row.
//
// Each row is a <TextItem> whose heading links to the text's own /texts/:id
// page; the same <TextItem> renders the single text on that detail page (see
// TextFull). Catalogue chrome (controls / pager / footer) lives in FeedShell.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams, useSearchParams } from "react-router";
import type { TextClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { parseRaw } from "~/lib/dimensions/filters";
import {
    textsDescriptor,
    withCodeOptions,
    buildTextHighlightRegex,
} from "~/lib/dimensions/descriptors";
import { localizedPath } from "~/lib/lang";

import { makeT, keyById } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { TextItem } from "./TextItem";

export interface TextsListProps {
    /** The filtered page slice + filtered total: `dat.texts`. */
    texts: PaginatedList<TextClient>;
    /** Response-scoped body lookup (`dat.bodies.items`): the bodies referenced by
     *  this page's texts (b.id = texts.body_id), keyed by id for labels. */
    bodies?: BodyClient[] | undefined;
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string> | undefined;
    locale?: string;
    /** Page size ($6) and page start ($7), echoed from the loader. */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. */
    pageParam?: string;
    /** Enable data export (catalogue use only) — forwarded to FeedShell. Omit for scoped reuses. */
    exportConfig?: {
        segment: string;
        datasetKey: string;
        filenameBase: string;
        subject?: string;
    };
    className?: string;
}

export function TextsList({
    texts,
    bodies,
    loc = {},
    locale = "de-CH",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    exportConfig,
    className,
}: TextsListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const [searchParams] = useSearchParams();
    const { lang } = useParams();

    // Resolve each text's body (b.id = texts.body_id) for the row snippet.
    const bodyById = React.useMemo(() => keyById(bodies), [bodies]);

    // Inject `format` options (code = label = text_format) from the page slice.
    // The `body` facet is sourced client-side (see `sourced` on FeedShell).
    const descriptor = React.useMemo(
        () =>
            withCodeOptions(
                textsDescriptor,
                "format",
                (texts.items ?? []) as unknown as Record<string, unknown>[],
                "text_format",
                (r) => String(r.text_format ?? ""),
            ),
        [texts.items],
    );

    // Active criteria → the keyword highlight regex (mirrors the SERVER search
    // semantics, incl. the case/word options).
    const current = React.useMemo(
        () => parseRaw(descriptor, searchParams),
        [descriptor, searchParams],
    );
    const highlightRe = React.useMemo(
        () => buildTextHighlightRegex(current),
        [current],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            icon="newspaper"
            titleKey="texts_title"
            titleFallback="Texts"
            emptyKey="no_texts"
            emptyFallback="No texts."
            noResultsFallback="No texts match your search."
            mcpNamespace="catalog"
            mcpSubject="all"
            sourced
            list={texts}
            renderRow={(tx, position) => (
                <TextItem
                    key={tx.id}
                    variant="row"
                    text={tx}
                    t={t}
                    locale={locale}
                    body={tx.body_id != null ? bodyById.get(tx.body_id) : undefined}
                    highlightRe={highlightRe}
                    selfHref={localizedPath(lang, "NS_TEXTS_OVERVIEW", {
                        id: String(tx.id),
                    })}
                    affairHref={
                        tx.affair_id != null
                            ? localizedPath(lang, "NS_AFFAIRS_OVERVIEW", {
                                id: String(tx.affair_id),
                            })
                            : null
                    }
                    position={position}
                />
            )}
            loc={loc}
            locale={locale}
            variant="page"
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            exportConfig={exportConfig}
            className={className}
        />
    );
}

export default TextsList;
