// /app/lib/seo/metas/body.ts
//
// Meta for /bodies — councils, committees and institutions. Overview + catalog
// are generated; the 8 sub-routes (members, votings, affairs, docs, texts, plus
// the loyalty / alignment / lobby analytics tabs) go through the dimension
// factory. Every sub-route loader returns `data.body` alongside its list. SEO
// copy lives in the `metas` block of loc_data_dashboard (keys `body.*`); this
// file resolves facts + wires the export/JSON-LD feeds.

import { joinParts } from "./core";
import {
    type EntityFacts,
    makeDimensionMeta,
    makeOverviewMeta,
    makeIndexMeta,
} from "./factory";
import type { BodyClient } from "@/types/opd_db";
import { bodyNode } from "~/lib/seo/jsonld/body";
import { itemListJsonLd } from "~/lib/seo/jsonld/list";
import { makeDatasets } from "~/lib/seo/jsonld/dataset";
import { bodyNodeId } from "~/lib/seo/jsonld/ids";
import { URL_PATH_SEGMENTS } from "~/configs/site.config";
import type { ExportFeedSpec } from "~/components/opd_views/_shared/export_helpers";

type BodyBaseData = { body?: BodyClient | null };

/** The body export feeds (result key + loc label key) — the single source the
 *  `bodies_result_layout` <DataExport> and the head Dataset JSON-LD both read. */
export const BODY_FEEDS: ExportFeedSpec[] = [
    { key: "votings", labelKey: "export_ds_votings" },
    { key: "affairs", labelKey: "export_ds_affairs" },
    { key: "texts", labelKey: "export_ds_texts" },
    { key: "docs", labelKey: "export_ds_docs" },
    { key: "people", labelKey: "export_ds_people" },
];

const resolveBodyFacts = (data: BodyBaseData | null | undefined): EntityFacts | null => {
    const b = data?.body;
    const label = b?.legislative_name ?? b?.name ?? b?.body_key ?? null;
    if (!label) return null;
    return {
        label,
        ctx: joinParts([b?.type_name]),
        image: b?.flag_image_url ?? b?.flag_image_oparl_url ?? undefined,
    };
};

/** Dataset JSON-LD for the body's bulk exports (head, one per feed with rows). */
const bodyDatasets = makeDatasets<BodyBaseData>({
    feeds: BODY_FEEDS,
    segment: URL_PATH_SEGMENTS.BODIES,
    idOf: (d) => d.body?.id,
    scopeOf: (d) => resolveBodyFacts(d)?.label,
    aboutId: bodyNodeId,
});

/* Overview ----------------------------------------------------------------- */

export const bodyMeta = makeOverviewMeta<BodyBaseData>({
    resolveFacts: resolveBodyFacts,
    copyPrefix: "body",
    node: bodyNode,
    datasets: bodyDatasets,
});

/* Sub-routes --------------------------------------------------------------- */

export type BodyDimension =
    | "people"
    | "votings"
    | "affairs"
    | "docs"
    | "texts"
    | "loyalty"
    | "alignment"
    | "lobby"
    | "discussion";

const BODY_COUNT_KEY: Record<BodyDimension, string | null> = {
    people: "people",
    votings: "votings",
    affairs: "affairs",
    docs: "docs",
    texts: "texts",
    // Analytics tabs — irregular loader shape, no catalog list to count.
    loyalty: null,
    alignment: null,
    lobby: null,
    discussion: null,
};

export const bodyDimensionMeta = makeDimensionMeta<BodyDimension, BodyBaseData>({
    resolveFacts: resolveBodyFacts,
    copyPrefix: "body.dim",
    countKey: BODY_COUNT_KEY,
    node: bodyNode,
    datasets: bodyDatasets,
});

/* Catalog ------------------------------------------------------------------ */

export const bodiesIndexMeta = makeIndexMeta<{
    bodies?: { total_count?: number; items?: BodyClient[] };
}>({
    copyPrefix: "body.index",
    countKey: "bodies",
    catalogueDataset: { segment: URL_PATH_SEGMENTS.BODIES, datasetKey: "bodies" },
    node: (data, lang, path) =>
        itemListJsonLd(data?.bodies?.items, (b) => bodyNode({ body: b }, lang, path)),
});
