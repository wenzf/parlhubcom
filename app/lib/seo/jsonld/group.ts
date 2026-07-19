// /app/lib/seo/jsonld/group.ts
//
// Organization graph node for a /groups/:id page — head JSON-LD replacing the
// microdata <GroupBase />/<GroupFull /> and the groups layout emitted. Wired
// into `groupMeta`/`groupDimensionMeta` (metas/group.ts).

import type { MetaLang } from "~/lib/seo/metas/core";
import type { GroupClient } from "@/types/opd_db";
import { isoOf } from "~/components/opd_views/opd_micros";
import { groupNodeId, groupPageUrl, bodyNodeId } from "./ids";

type GroupNodeData = { group?: GroupClient | null } | null | undefined;

/**
 * Organization node for a group page (`@id` = `…/groups/:id#identity`).
 * Returns `[]` when the record has no name.
 */
export function groupNode(
    data: GroupNodeData,
    _lang: MetaLang,
    _path: string | undefined,
): object[] {
    const g = data?.group;
    if (!g || g.id == null) return [];
    const name = g.name ?? g.abbreviation ?? null;
    if (!name) return [];

    const node: Record<string, unknown> = {
        "@type": "Organization",
        "@id": groupNodeId(g.id),
        name,
        url: groupPageUrl(g.id),
    };
    if (g.abbreviation && g.abbreviation !== name) node.alternateName = g.abbreviation;
    const founding = isoOf(g.begin_date);
    if (founding) node.foundingDate = founding;
    const dissolution = isoOf(g.end_date);
    if (dissolution) node.dissolutionDate = dissolution;
    if (g.body_id != null) node.parentOrganization = { "@id": bodyNodeId(g.body_id) };
    if (g.url_external) node.sameAs = [g.url_external];

    return [node];
}
