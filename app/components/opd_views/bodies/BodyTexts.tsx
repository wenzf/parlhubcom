// BodyTexts.tsx  → ~/components/opd_views/bodies/BodyTexts.tsx
//
// Thin scope wrapper over the shared <TextsFeed> (body-scoped). Each row links
// to its parent affair.

import type { PaginatedList } from "@/types/opd_paginated_client";
import type { TextClient } from "@/types/opd_db";
import { bodyTextsDescriptor } from "~/lib/dimensions/descriptors";
import { TextsFeed } from "../_shared/feeds/TextsFeed";

export interface BodyTextsProps {
    texts: PaginatedList<TextClient>;
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

export function BodyTexts({ bodyId: _bodyId, ...props }: BodyTextsProps) {
    return (
        <TextsFeed
            {...props}
            descriptor={bodyTextsDescriptor}
            feedNs="NS_BODIES_TEXTS"
            mcpNamespace="body"
            mcpSubject="this body's"
            showAffairLink={true}
        />
    );
}

export default BodyTexts;