// /app/lib/seo/metas/speech.ts
//
// Meta for /speeches — a single speech / intervention (leaf entity). The title
// is the speaker's name (what people search), falling back to the speech type.
// SEO copy lives in the `metas` block of loc_data_dashboard (keys `speech.*`).

import { joinParts, yearFrom } from "./core";
import { type EntityFacts, makeOverviewMeta, makeIndexMeta } from "./factory";
import type { SpeechClient } from "@/types/opd_db";
import { speechNode } from "~/lib/seo/jsonld/speech";

type SpeechBaseData = {
    speech?: SpeechClient | null;
    persons?: { items?: Array<{ fullname?: string | null }> };
};

const resolveSpeechFacts = (data: SpeechBaseData | null | undefined): EntityFacts | null => {
    const s = data?.speech;
    const speaker = data?.persons?.items?.[0]?.fullname ?? null;
    const label = speaker ?? s?.type_external ?? null;
    if (!label) return null;
    return { label, ctx: joinParts([s?.person_role, yearFrom(s?.date_start)]) };
};

export const speechMeta = makeOverviewMeta<SpeechBaseData>({
    resolveFacts: resolveSpeechFacts,
    copyPrefix: "speech",
    type: "article",
    node: speechNode,
});

export const speechesIndexMeta = makeIndexMeta<{ speeches?: { total_count?: number } }>({
    copyPrefix: "speech.index",
    countKey: "speeches",
    catalogueDataset: { segment: "speeches", datasetKey: "speeches" },
});
