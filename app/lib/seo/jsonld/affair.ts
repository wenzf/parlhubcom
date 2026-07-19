// /app/lib/seo/jsonld/affair.ts
//
// Legislation graph node for an /affairs/:id page — head JSON-LD replacing the
// microdata <AffairBase />/<AffairFull /> and the affairs layout emitted. Wired
// into `affairMeta`/`affairDimensionMeta` (metas/affair.ts).

import type { MetaLang } from "~/lib/seo/metas/core";
import type { AffairClient } from "@/types/opd_db";
import { isoOf } from "~/components/opd_views/opd_micros";
import { affairNodeId, affairPageUrl, bodyNodeId } from "./ids";

type AffairNodeData = { affair?: AffairClient | null } | null | undefined;

/**
 * Legislation node for an affair page (`@id` = `…/affairs/:id#identity`).
 * Returns `[]` when the record has no title.
 */
export function affairNode(
    data: AffairNodeData,
    lang: MetaLang,
    _path: string | undefined,
): object[] {
    const a = data?.affair;
    if (!a || a.id == null) return [];
    const name = a.title ?? a.title_long ?? null;
    if (!name) return [];

    const node: Record<string, unknown> = {
        "@type": "Legislation",
        "@id": affairNodeId(a.id),
        name,
        url: affairPageUrl(a.id),
        inLanguage: lang,
    };
    if (a.number) node.legislationIdentifier = a.number;
    const type = a.type_name ?? a.type_harmonized ?? null;
    if (type) node.legislationType = type;
    const date = isoOf(a.begin_date);
    if (date) node.legislationDate = date;
    if (a.body_id != null) node.legislationPassedBy = { "@id": bodyNodeId(a.body_id) };
    if (a.url_external) node.sameAs = [a.url_external];

    return [node];
}
