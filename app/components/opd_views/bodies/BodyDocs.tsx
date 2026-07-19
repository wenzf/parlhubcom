// BodyDocs.tsx  → ~/components/opd_views/bodies/BodyDocs.tsx
//
// Thin scope wrapper over the shared <DocsFeed> (body-scoped).

import type { PaginatedList } from "@/types/opd_paginated_client";
import type { DocClient } from "@/types/opd_db";
import { bodyDocsDescriptor } from "~/lib/dimensions/descriptors";
import { DocsFeed } from "../_shared/feeds/DocsFeed";

export interface BodyDocsProps {
    docs: PaginatedList<DocClient>;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    /** Kept for API compatibility; the feed link is derived from route params. */
    bodyId?: number;
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function BodyDocs({ bodyId: _bodyId, ...props }: BodyDocsProps) {
    return (
        <DocsFeed
            {...props}
            descriptor={bodyDocsDescriptor}
            feedNs="NS_BODIES_DOCS"
            mcpNamespace="body"
            mcpSubject="this body's"
        />
    );
}

export default BodyDocs;