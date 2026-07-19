// /app/lib/seo/metas/voting.ts
//
// Meta for /votings — a single voting event (leaf: overview + catalog, no subs).
// SEO copy lives in the `metas` block of loc_data_dashboard (keys `voting.*`);
// this file only resolves facts and picks the og:type.

import { joinParts, yearFrom } from "./core";
import { type EntityFacts, makeOverviewMeta, makeIndexMeta } from "./factory";
import type { VotingClient } from "@/types/opd_db";

type VotingBaseData = { voting?: VotingClient | null };

const resolveVotingFacts = (data: VotingBaseData | null | undefined): EntityFacts | null => {
    const v = data?.voting;
    const label = v?.title ?? v?.affair_title ?? null;
    if (!label) return null;
    return { label, ctx: joinParts([v?.type, yearFrom(v?.date)]) };
};

export const votingMeta = makeOverviewMeta<VotingBaseData>({
    resolveFacts: resolveVotingFacts,
    copyPrefix: "voting",
    type: "article",
});

export const votingsIndexMeta = makeIndexMeta<{ votings?: { total_count?: number } }>({
    copyPrefix: "voting.index",
    countKey: "votings",
    catalogueDataset: { segment: "votings", datasetKey: "votings" },
});
