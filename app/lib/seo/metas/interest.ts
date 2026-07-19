// /app/lib/seo/metas/interest.ts
//
// Meta for /interests — a single declared interest / lobby tie (leaf entity).
// SEO copy lives in the `metas` block of loc_data_dashboard (keys `interest.*`).

import { joinParts } from "./core";
import { type EntityFacts, makeOverviewMeta, makeIndexMeta } from "./factory";
import type { InterestClient } from "@/types/opd_db";
import { interestNode } from "~/lib/seo/jsonld/interest";
import { itemListJsonLd } from "~/lib/seo/jsonld/list";

type InterestBaseData = {
    interest?: InterestClient | null;
    persons?: { items?: Array<{ id?: number | null; fullname?: string | null }> };
};

const resolveInterestFacts = (data: InterestBaseData | null | undefined): EntityFacts | null => {
    const i = data?.interest;
    const label = i?.name ?? i?.name_short ?? i?.name_abbreviation ?? null;
    if (!label) return null;
    const holder = data?.persons?.items?.[0]?.fullname ?? null;
    return { label, ctx: joinParts([i?.role_name, holder]) };
};

export const interestMeta = makeOverviewMeta<InterestBaseData>({
    resolveFacts: resolveInterestFacts,
    copyPrefix: "interest",
    node: interestNode,
});

export const interestsIndexMeta = makeIndexMeta<{
    interests?: { total_count?: number; items?: InterestClient[] };
}>({
    copyPrefix: "interest.index",
    countKey: "interests",
    catalogueDataset: { segment: "interests", datasetKey: "interests" },
    node: (data, lang, path) =>
        itemListJsonLd(data?.interests?.items, (i) => interestNode({ interest: i }, lang, path)),
});
