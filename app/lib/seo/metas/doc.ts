// /app/lib/seo/metas/doc.ts
//
// Meta for /docs — a single document (leaf entity). SEO copy lives in the `metas`
// block of loc_data_dashboard (keys `doc.*`); this file only resolves facts.

import { joinParts, yearFrom } from "./core";
import { type EntityFacts, makeOverviewMeta, makeIndexMeta } from "./factory";
import type { DocClient } from "@/types/opd_db";
import { docNode } from "~/lib/seo/jsonld/doc";

type DocBaseData = { doc?: DocClient | null };

const resolveDocFacts = (data: DocBaseData | null | undefined): EntityFacts | null => {
    const d = data?.doc;
    const label = d?.name ?? d?.category ?? null;
    if (!label) return null;
    return { label, ctx: joinParts([d?.format, d?.category, yearFrom(d?.date)]) };
};

export const docMeta = makeOverviewMeta<DocBaseData>({
    resolveFacts: resolveDocFacts,
    copyPrefix: "doc",
    type: "article",
    node: docNode,
});

export const docsIndexMeta = makeIndexMeta<{ docs?: { total_count?: number } }>({
    copyPrefix: "doc.index",
    countKey: "docs",
    catalogueDataset: { segment: "docs", datasetKey: "docs" },
});
