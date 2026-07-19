// AffairTexts.tsx  → ~/components/opd_views/affairs/AffairTexts.tsx
//
// Thin scope wrapper over the shared <TextsFeed>. The parent-affair row link is
// suppressed here (every text is the current affair).

import type { PaginatedList } from "@/types/opd_paginated_client";
import type { TextClient } from "@/types/opd_db";
import { affairTextsDescriptor } from "~/lib/dimensions/descriptors";
import { TextsFeed } from "../_shared/feeds/TextsFeed";

export interface AffairTextsProps {
    texts: PaginatedList<TextClient>;
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

export function AffairTexts({ affairId: _affairId, ...props }: AffairTextsProps) {
    return (
        <TextsFeed
            {...props}
            descriptor={affairTextsDescriptor}
            feedNs="NS_AFFAIRS_TEXTS"
            mcpNamespace="affair"
            mcpSubject="this affair's"
            showAffairLink={false}
        />
    );
}

export default AffairTexts;