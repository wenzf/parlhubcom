// /app/lib/seo/jsonld/speech.ts
//
// CreativeWork graph node for a /speeches/:id page — head JSON-LD replacing the
// microdata <SpeechItem variant="page" />. Wired into `speechMeta`
// (metas/speech.ts). The speech's author (person) and subject (affair) are
// cross-referenced by `@id` so they resolve to their own nodes site-wide.

import type { MetaLang } from "~/lib/seo/metas/core";
import type { SpeechClient } from "@/types/opd_db";
import { isoOf } from "~/components/opd_views/opd_micros";
import { speechNodeId, speechPageUrl, personNodeId, affairNodeId } from "./ids";

type SpeechNodeData =
    | {
        speech?: SpeechClient | null;
        persons?: { items?: Array<{ fullname?: string | null }> };
    }
    | null
    | undefined;

/** Strip tags + decode the few common entities so rich-text HTML becomes a
 *  plain schema.org `text` value. (Kept local — mirrors the speeches/texts
 *  highlight helpers that stay self-contained per surface.) */
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
 * CreativeWork node for a speech page (`@id` = `…/speeches/:id#identity`).
 * Returns `[]` when the record has no usable heading.
 */
export function speechNode(
    data: SpeechNodeData,
    lang: MetaLang,
    _path: string | undefined,
): object[] {
    const s = data?.speech;
    if (!s || s.id == null) return [];
    const speaker = data?.persons?.items?.[0]?.fullname ?? null;
    const name = speaker ?? s.type_external ?? null;
    if (!name) return [];

    const node: Record<string, unknown> = {
        "@type": "CreativeWork",
        "@id": speechNodeId(s.id),
        name,
        url: speechPageUrl(s.id),
        inLanguage: s.speech_lang ?? lang,
    };

    const text = plainText(s.text_content);
    if (text) node.text = text;

    const date = isoOf(s.date_start);
    if (date) node.datePublished = date;

    if (s.person_id != null) {
        node.author = {
            "@type": "Person",
            "@id": personNodeId(s.person_id),
            ...(speaker ? { name: speaker } : {}),
        };
    }
    if (s.affair_id != null) node.about = { "@id": affairNodeId(s.affair_id) };

    return [node];
}
