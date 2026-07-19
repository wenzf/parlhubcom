// /app/lib/seo/metas/group.ts
//
// Meta for /groups — parliamentary groups, parties and fractions. Overview +
// catalog generated; 4 sub-routes via the dimension factory. SEO copy lives in
// the `metas` block of loc_data_dashboard (keys `group.*`); this file resolves
// facts + wires the export/JSON-LD feeds.

import { joinParts, yearRange } from "./core";
import {
    type EntityFacts,
    makeDimensionMeta,
    makeOverviewMeta,
    makeIndexMeta,
} from "./factory";
import type { GroupClient } from "@/types/opd_db";
import { groupNode } from "~/lib/seo/jsonld/group";
import { itemListJsonLd } from "~/lib/seo/jsonld/list";
import { makeDatasets } from "~/lib/seo/jsonld/dataset";
import { groupNodeId } from "~/lib/seo/jsonld/ids";
import { URL_PATH_SEGMENTS } from "~/configs/site.config";
import type { ExportFeedSpec } from "~/components/opd_views/_shared/export_helpers";

type GroupBaseData = { group?: GroupClient | null };

/** The group export feeds — single source for <DataExport> and Dataset JSON-LD. */
export const GROUP_FEEDS: ExportFeedSpec[] = [
    { key: "contributions", labelKey: "export_ds_contributions" },
    { key: "meetings", labelKey: "export_ds_meetings" },
    { key: "memberships", labelKey: "export_ds_memberships" },
    { key: "votings", labelKey: "export_ds_votings" },
];

const resolveGroupFacts = (data: GroupBaseData | null | undefined): EntityFacts | null => {
    const g = data?.group;
    const label = g?.name ?? g?.abbreviation ?? null;
    if (!label) return null;
    return {
        label,
        ctx: joinParts([
            g?.abbreviation && g.abbreviation !== label ? g.abbreviation : null,
            g?.type_harmonized ?? g?.type_external,
            yearRange(g?.begin_date, g?.end_date),
        ]),
    };
};

/** Dataset JSON-LD for the group's bulk exports (head, one per feed with rows). */
const groupDatasets = makeDatasets<GroupBaseData>({
    feeds: GROUP_FEEDS,
    segment: URL_PATH_SEGMENTS.GROUPS,
    idOf: (d) => d.group?.id,
    scopeOf: (d) => resolveGroupFacts(d)?.label,
    aboutId: groupNodeId,
});

/* Overview ----------------------------------------------------------------- */

export const groupMeta = makeOverviewMeta<GroupBaseData>({
    resolveFacts: resolveGroupFacts,
    copyPrefix: "group",
    node: groupNode,
    datasets: groupDatasets,
});

/* Sub-routes --------------------------------------------------------------- */

export type GroupDimension = "contributions" | "meetings" | "memberships" | "votings";

const GROUP_COUNT_KEY: Record<GroupDimension, string | null> = {
    contributions: "contributions",
    meetings: "meetings",
    memberships: "memberships",
    votings: "votings",
};

export const groupDimensionMeta = makeDimensionMeta<GroupDimension, GroupBaseData>({
    resolveFacts: resolveGroupFacts,
    copyPrefix: "group.dim",
    countKey: GROUP_COUNT_KEY,
    node: groupNode,
    datasets: groupDatasets,
});

/* Catalog ------------------------------------------------------------------ */

export const groupsIndexMeta = makeIndexMeta<{
    groups?: { total_count?: number; items?: GroupClient[] };
}>({
    copyPrefix: "group.index",
    countKey: "groups",
    catalogueDataset: { segment: URL_PATH_SEGMENTS.GROUPS, datasetKey: "groups" },
    node: (data, lang, path) =>
        itemListJsonLd(data?.groups?.items, (g) => groupNode({ group: g }, lang, path)),
});
