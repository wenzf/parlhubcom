// _shared/feeds/DocsFeed.tsx
//
// The "documents attached to ONE scope entity" feed, shared by /affairs/:id/docs
// and /bodies/:id/docs (and any future scope). Collapses the near-identical
// AffairDocs / BodyDocs into one component: they differed only in the base
// descriptor, feed namespace and MCP scoping — all props here. Renders the
// shared <DocRow> inside the shared <FeedShell>; the category + format facet
// options are runtime-injected from the page slice.
//
// The category/format facet vocabularies are page-slice injected exactly as the
// originals did. The document's own detail page (`/docs/:id`) is linked via
// createLangPathByParam until an NS_DOCS_OVERVIEW namespace exists.

import * as React from "react";
import { useParams } from "react-router";
import type { DocClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import type { DimensionDescriptor } from "~/lib/dimensions/filters";
import type { PageNamespaces } from "@/types/site";
import { withCodeOptions } from "~/lib/dimensions/descriptors";
import { createLangPathByParam } from "~/lib/lang";

import { makeT } from "../../../opd_views/opd_micros";
import { FeedShell } from "./FeedShell";
import { DocRow } from "../rows/DocRow";

export interface DocsFeedProps {
    docs: PaginatedList<DocClient>;
    /** Base descriptor (affairDocsDescriptor | bodyDocsDescriptor). */
    descriptor: DimensionDescriptor;
    /** Full feed route namespace (NS_AFFAIRS_DOCS | NS_BODIES_DOCS). */
    feedNs: PageNamespaces;
    mcpNamespace: string;
    mcpSubject: string;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function DocsFeed({
    docs,
    descriptor: baseDescriptor,
    feedNs,
    mcpNamespace,
    mcpSubject,
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: DocsFeedProps) {
    const params = useParams();
    const t = React.useMemo(() => makeT(loc), [loc]);

    // Inject category options (code = category_harmonized, label = localized
    // category) and format options (code = label = format) from the page slice.
    const descriptor = React.useMemo(
        () =>
            withCodeOptions(
                withCodeOptions(
                    baseDescriptor,
                    "category",
                    (docs.items ?? []) as unknown as Record<string, unknown>[],
                    "category_harmonized",
                    (r) => (r.category as string) ?? String(r.category_harmonized ?? ""),
                ),
                "format",
                (docs.items ?? []) as unknown as Record<string, unknown>[],
                "format",
                (r) => String(r.format ?? ""),
            ),
        [baseDescriptor, docs.items],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            feedNs={feedNs}
            icon="paperclip"
            titleKey="section_docs"
            titleFallback="Documents"
            emptyKey="no_docs"
            emptyFallback="No documents."
            noResultsFallback="No documents match your search."
            viewAllKey="view_all_docs"
            viewAllFallback="View all documents"
            mcpNamespace={mcpNamespace}
            mcpSubject={mcpSubject}
            list={docs}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            className={className}
            renderRow={(d) => (
                <DocRow
                    key={d.id}
                    doc={d}
                    t={t}
                    locale={locale}
                    docHref={createLangPathByParam(params.lang, `/docs/${d.id}`)}
                />
            )}
        />
    );
}

export default DocsFeed;