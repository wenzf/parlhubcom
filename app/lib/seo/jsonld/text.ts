// /app/lib/seo/jsonld/text.ts
//
// CreativeWork graph node for a /texts/:id page — head JSON-LD replacing the
// microdata <TextItem variant="page" />. Wired into `textMeta` (metas/text.ts).
// The parent affair is cross-referenced by `@id`.

import type { MetaLang } from "~/lib/seo/metas/core";
import type { TextClient } from "@/types/opd_db";
import { textNodeId, textPageUrl, affairNodeId } from "./ids";

type TextNodeData = { text?: TextClient | null } | null | undefined;

/** Strip tags + decode the few common entities so rich-text HTML becomes a
 *  plain schema.org `text` value. */
function plainText(html: string | null | undefined): string | undefined {
    if (!html) return undefined;
    const s = html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    return s || undefined;
}

/**
 * CreativeWork node for a text page (`@id` = `…/texts/:id#identity`).
 * Returns `[]` when the record has no usable heading.
 */
export function textNode(
    data: TextNodeData,
    lang: MetaLang,
    _path: string | undefined,
): object[] {
    const t = data?.text;
    if (!t || t.id == null) return [];
    const name = t.type ?? t.type_en ?? t.affair_title ?? null;
    if (!name) return [];

    const node: Record<string, unknown> = {
        "@type": "CreativeWork",
        "@id": textNodeId(t.id),
        name,
        url: textPageUrl(t.id),
        inLanguage: t.text_lang ?? lang,
    };

    const text = plainText(t.text);
    if (text) node.text = text;

    const date = t.text_date?.slice(0, 10);
    if (date) node.datePublished = date;

    if (t.affair_id != null) {
        node.about = {
            "@id": affairNodeId(t.affair_id),
            ...(t.affair_title ? { "@type": "Legislation", name: t.affair_title } : {}),
        };
    }

    return [node];
}
