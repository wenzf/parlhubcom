// /app/lib/seo/metas/text.ts
//
// Meta for /texts — a single enacted/parliamentary text (leaf entity). SEO copy
// lives in the `metas` block of loc_data_dashboard (keys `text.*`).

import { joinParts, yearFrom } from "./core";
import { type EntityFacts, makeOverviewMeta, makeIndexMeta } from "./factory";
import type { TextClient } from "@/types/opd_db";
import { textNode } from "~/lib/seo/jsonld/text";

type TextBaseData = { text?: TextClient | null };

const resolveTextFacts = (data: TextBaseData | null | undefined): EntityFacts | null => {
    const t = data?.text;
    const label = t?.type ?? t?.affair_title ?? null;
    if (!label) return null;
    return { label, ctx: joinParts([t?.text_format, yearFrom(t?.text_date), t?.affair_title]) };
};

export const textMeta = makeOverviewMeta<TextBaseData>({
    resolveFacts: resolveTextFacts,
    copyPrefix: "text",
    type: "article",
    node: textNode,
});

export const textsIndexMeta = makeIndexMeta<{ texts?: { total_count?: number } }>({
    copyPrefix: "text.index",
    countKey: "texts",
    catalogueDataset: { segment: "texts", datasetKey: "texts" },
});
