// /app/lib/seo/jsonld/doc.ts
//
// DigitalDocument graph node for a /docs/:id page — head JSON-LD replacing the
// microdata <DocFull />. Wired into `docMeta` (metas/doc.ts). The file itself is
// linked via `sameAs`; the parent affair is cross-referenced by `@id`.

import type { MetaLang } from "~/lib/seo/metas/core";
import type { DocClient } from "@/types/opd_db";
import { docNodeId, docPageUrl, affairNodeId } from "./ids";

type DocNodeData = { doc?: DocClient | null } | null | undefined;

/**
 * DigitalDocument node for a doc page (`@id` = `…/docs/:id#identity`).
 * Returns `[]` when the record has no usable name.
 */
export function docNode(
    data: DocNodeData,
    lang: MetaLang,
    _path: string | undefined,
): object[] {
    const d = data?.doc;
    if (!d || d.id == null) return [];
    const name = d.name ?? d.category ?? null;
    if (!name) return [];

    const node: Record<string, unknown> = {
        "@type": "DigitalDocument",
        "@id": docNodeId(d.id),
        name,
        url: docPageUrl(d.id),
        inLanguage: d.language ?? lang,
    };

    const fileUrl = d.url ?? d.url_oparl ?? null;
    if (fileUrl) node.sameAs = [fileUrl];
    if (d.format) node.encodingFormat = d.format.toUpperCase();

    const date = d.date?.slice(0, 10);
    if (date) node.datePublished = date;

    if (d.affair_id != null) node.about = { "@id": affairNodeId(d.affair_id) };

    return [node];
}
