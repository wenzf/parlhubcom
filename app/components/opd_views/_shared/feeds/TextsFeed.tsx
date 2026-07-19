// _shared/feeds/TextsFeed.tsx
//
// The "texts attached to ONE scope entity" feed, shared by /affairs/:id/texts
// and /bodies/:id/texts (and the shape reused by the /texts catalogue rows).
// Collapses the near-identical AffairTexts / BodyTexts: they differed only in
// the base descriptor, feed namespace, MCP scoping and whether the per-row
// parent-affair link is shown. Renders the shared <TextRow> inside the shared
// <FeedShell>; the format facet options are runtime-injected from the page slice.
//
// `showAffairLink`: on a body's texts feed each row links to its parent affair;
// on the affair's OWN texts feed the link is suppressed (every text is the
// current affair) — pass false there.

import * as React from "react";
import { useParams } from "react-router";
import type { TextClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import type { DimensionDescriptor } from "~/lib/dimensions/filters";
import type { PageNamespaces } from "@/types/site";
import { withCodeOptions } from "~/lib/dimensions/descriptors";
import { localizedPath } from "~/lib/lang";

import { makeT } from "../../../opd_views/opd_micros";
import { FeedShell } from "./FeedShell";
import { TextRow } from "../rows/TextRow";

export interface TextsFeedProps {
    texts: PaginatedList<TextClient>;
    /** Base descriptor (affairTextsDescriptor | bodyTextsDescriptor). */
    descriptor: DimensionDescriptor;
    /** Full feed route namespace (NS_AFFAIRS_TEXTS | NS_BODIES_TEXTS). */
    feedNs: PageNamespaces;
    mcpNamespace: string;
    mcpSubject: string;
    /** Show the per-row parent-affair link (false on the affair's own feed). */
    showAffairLink?: boolean;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function TextsFeed({
    texts,
    descriptor: baseDescriptor,
    feedNs,
    mcpNamespace,
    mcpSubject,
    showAffairLink = false,
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: TextsFeedProps) {
    const params = useParams();
    const t = React.useMemo(() => makeT(loc), [loc]);

    // Inject format options (code = label = text_format) from the page slice.
    const descriptor = React.useMemo(
        () =>
            withCodeOptions(
                baseDescriptor,
                "format",
                (texts.items ?? []) as unknown as Record<string, unknown>[],
                "text_format",
                (r) => String(r.text_format ?? ""),
            ),
        [baseDescriptor, texts.items],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            feedNs={feedNs}
            icon="newspaper"
            titleKey="section_texts"
            titleFallback="Texts"
            emptyKey="no_texts"
            emptyFallback="No texts."
            noResultsFallback="No texts match your search."
            viewAllKey="view_all_texts"
            viewAllFallback="View all texts"
            mcpNamespace={mcpNamespace}
            mcpSubject={mcpSubject}
            list={texts}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            className={className}
            renderRow={(tx) => (
                <TextRow
                    key={tx.id}
                    text={tx}
                    t={t}
                    locale={locale}
                    affairHref={
                        showAffairLink && tx.affair_id != null
                            ? localizedPath(params.lang, "NS_AFFAIRS_OVERVIEW", {
                                id: String(tx.affair_id),
                            })
                            : null
                    }
                />
            )}
        />
    );
}

export default TextsFeed;