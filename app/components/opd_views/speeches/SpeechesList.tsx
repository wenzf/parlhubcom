// SpeechesList.tsx           → ~/components/opd_views/speeches/SpeechesList.tsx
//
// The speeches DIRECTORY (top-level /speeches): a paginated, server-filtered list
// of speeches with full-text search / filter / sort. Driven by
// `speechesCatalogDescriptor` + the URL. LIST family: the loader uses
// runListPaginatedFiltered and `speeches` here is the filtered, sorted page slice.
//
// Search matches the tag-stripped transcript + speaker name + parent affair title
// (server-side), honouring the case / whole-word options. Facets: institution
// (`body`, sourced), `type` (page slice), `lang` (de|fr|it — the displayed
// transcript language), has-video, date range, + the two search-option toggles.
// Matches are highlighted in each row.
//
// Each row is a <SpeechItem> whose heading (the speaker) links to the speech's
// own /speeches/:id page; the same <SpeechItem> renders the single speech there.

import * as React from "react";
import { useParams, useSearchParams } from "react-router";
import type { SpeechClient, BodyClient, PersonClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { parseRaw } from "~/lib/dimensions/filters";
import {
    speechesCatalogDescriptor,
    withCodeOptions,
    buildTextHighlightRegex,
} from "~/lib/dimensions/descriptors";
import { localizedPath } from "~/lib/lang";

import { makeT, keyById } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { SpeechItem } from "./SpeechItem";

export interface SpeechesListProps {
    speeches: PaginatedList<SpeechClient>;
    /** Response-scoped speaker lookup (p.id = speech.person_id), keyed by id. */
    persons?: PersonClient[] | undefined;
    /** Response-scoped body lookup (b.id = speech.body_id), keyed by id. */
    bodies?: BodyClient[] | undefined;
    loc?: Record<string, string> | undefined;
    locale?: string;
    limit?: number;
    offset?: number;
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

export function SpeechesList({
    speeches,
    persons,
    bodies,
    loc = {},
    locale = "de-CH",
    limit = 10,
    offset = 0,
    pageParam = "offset",
    exportConfig,
    className,
}: SpeechesListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const [searchParams] = useSearchParams();
    const { lang } = useParams();

    const personById = React.useMemo(() => keyById(persons), [persons]);
    const bodyById = React.useMemo(() => keyById(bodies), [bodies]);

    // Inject `type` options (code = type_external_id, label = localized type_external)
    // from the page slice. The `body` facet is sourced client-side (`sourced` below).
    const descriptor = React.useMemo(
        () =>
            withCodeOptions(
                speechesCatalogDescriptor,
                "type",
                (speeches.items ?? []) as unknown as Record<string, unknown>[],
                "type_external_id",
                (r) => String(r.type_external ?? r.type_external_id ?? ""),
            ),
        [speeches.items],
    );

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
            icon="mic"
            titleKey="speeches_title"
            titleFallback="Speeches"
            emptyKey="no_speeches"
            emptyFallback="No recorded speeches."
            noResultsFallback="No speeches match your search."
            mcpNamespace="catalog"
            mcpSubject="all"
            sourced
            list={speeches}
            renderRow={(sp, position) => (
                <SpeechItem
                    key={sp.id}
                    variant="row"
                    speech={sp}
                    t={t}
                    locale={locale}
                    speaker={
                        sp.person_id != null ? personById.get(sp.person_id) : undefined
                    }
                    body={sp.body_id != null ? bodyById.get(sp.body_id) : undefined}
                    highlightRe={highlightRe}
                    selfHref={localizedPath(lang, "NS_SPEECHES_OVERVIEW", {
                        id: String(sp.id),
                    })}
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

export default SpeechesList;
