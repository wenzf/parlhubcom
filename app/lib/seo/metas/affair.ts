// /app/lib/seo/metas/affair.ts
//
// Meta for /affairs — parliamentary business (proposals, bills, deliberations).
// Overview + catalog generated; 6 sub-routes via the dimension factory. Every
// sub-route loader returns `data.affair` alongside its list. SEO copy lives in
// the `metas` block of loc_data_dashboard (keys `affair.*`); this file resolves
// facts + wires the export/JSON-LD feeds.

import { joinParts } from "./core";
import {
    type EntityFacts,
    makeDimensionMeta,
    makeOverviewMeta,
    makeIndexMeta,
} from "./factory";
import type { AffairClient } from "@/types/opd_db";
import { affairNode } from "~/lib/seo/jsonld/affair";
import { itemListJsonLd } from "~/lib/seo/jsonld/list";
import { makeDatasets } from "~/lib/seo/jsonld/dataset";
import { affairNodeId } from "~/lib/seo/jsonld/ids";
import { URL_PATH_SEGMENTS } from "~/configs/site.config";
import type { ExportFeedSpec } from "~/components/opd_views/_shared/export_helpers";

type AffairBaseData = { affair?: AffairClient | null };

/** The affair export feeds — single source for <DataExport> and Dataset JSON-LD. */
export const AFFAIR_FEEDS: ExportFeedSpec[] = [
    { key: "votings", labelKey: "export_ds_votings" },
    { key: "contributors", labelKey: "export_ds_contributors" },
    { key: "speeches", labelKey: "export_ds_speeches" },
    { key: "docs", labelKey: "export_ds_docs" },
    { key: "events", labelKey: "export_ds_events" },
    { key: "texts", labelKey: "export_ds_texts" },
];

const resolveAffairFacts = (data: AffairBaseData | null | undefined): EntityFacts | null => {
    const a = data?.affair;
    const label = a?.title ?? a?.title_long ?? null;
    if (!label) return null;
    return {
        label,
        ctx: joinParts([
            a?.number,
            a?.type_name ?? a?.type_harmonized,
            a?.state_name ?? a?.state_name_harmonized,
        ]),
    };
};

/** Dataset JSON-LD for the affair's bulk exports (head, one per feed with rows). */
const affairDatasets = makeDatasets<AffairBaseData>({
    feeds: AFFAIR_FEEDS,
    segment: URL_PATH_SEGMENTS.AFFAIRS,
    idOf: (d) => d.affair?.id,
    scopeOf: (d) => resolveAffairFacts(d)?.label,
    aboutId: affairNodeId,
});

/* Overview ----------------------------------------------------------------- */

export const affairMeta = makeOverviewMeta<AffairBaseData>({
    resolveFacts: resolveAffairFacts,
    copyPrefix: "affair",
    type: "article",
    node: affairNode,
    datasets: affairDatasets,
});

/* Sub-routes --------------------------------------------------------------- */

export type AffairDimension =
    | "votings"
    | "contributors"
    | "speeches"
    | "docs"
    | "events"
    | "texts";

const AFFAIR_COUNT_KEY: Record<AffairDimension, string | null> = {
    votings: "votings",
    contributors: "contributors",
    speeches: "speeches",
    docs: "docs",
    events: "events",
    texts: "texts",
};

export const affairDimensionMeta = makeDimensionMeta<AffairDimension, AffairBaseData>({
    resolveFacts: resolveAffairFacts,
    copyPrefix: "affair.dim",
    countKey: AFFAIR_COUNT_KEY,
    type: "article",
    node: affairNode,
    datasets: affairDatasets,
});

/* Catalog ------------------------------------------------------------------ */

export const affairsIndexMeta = makeIndexMeta<{
    affairs?: { total_count?: number; items?: AffairClient[] };
}>({
    copyPrefix: "affair.index",
    countKey: "affairs",
    catalogueDataset: { segment: URL_PATH_SEGMENTS.AFFAIRS, datasetKey: "affairs" },
    node: (data, lang, path) =>
        itemListJsonLd(data?.affairs?.items, (a) => affairNode({ affair: a }, lang, path)),
});
