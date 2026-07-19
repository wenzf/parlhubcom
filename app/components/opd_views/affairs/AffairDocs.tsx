// AffairDocs.tsx  → ~/components/opd_views/affairs/AffairDocs.tsx
//
// Thin scope wrapper over the shared <DocsFeed>. The whole body/row/pager chrome
// now lives in _shared; this only binds the affair-scoped descriptor, feed
// namespace and MCP scoping. Public props unchanged, so routes + the affair
// overview import it exactly as before.

import type { PaginatedList } from "@/types/opd_paginated_client";
import type { DocClient } from "@/types/opd_db";
import { affairDocsDescriptor } from "~/lib/dimensions/descriptors";
import { DocsFeed } from "../_shared/feeds/DocsFeed";

export interface AffairDocsProps {
    docs: PaginatedList<DocClient>;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    /** Kept for API compatibility; the feed link is derived from route params. */
    affairId?: number;
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function AffairDocs({ affairId: _affairId, ...props }: AffairDocsProps) {
    return (
        <DocsFeed
            {...props}
            descriptor={affairDocsDescriptor}
            feedNs="NS_AFFAIRS_DOCS"
            mcpNamespace="affair"
            mcpSubject="this affair's"
        />
    );
}

export default AffairDocs;