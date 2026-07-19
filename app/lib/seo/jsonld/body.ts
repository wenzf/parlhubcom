// /app/lib/seo/jsonld/body.ts
//
// GovernmentOrganization graph node for a body page (public path `/parliaments/:id`)
// — head JSON-LD replacing the microdata <BodyBase />/<BodyFull /> and the bodies
// layout emitted. Wired into `bodyMeta`/`bodyDimensionMeta` (metas/body.ts).

import type { MetaLang } from "~/lib/seo/metas/core";
import type { BodyClient } from "@/types/opd_db";
import { wikidataUrl } from "~/lib/domain/person";
import { bodyNodeId, bodyPageUrl } from "./ids";

type BodyNodeData = { body?: BodyClient | null } | null | undefined;

/** ISO country name for a body's `country_key` (schema.org `addressCountry`). */
function countryName(key: string | null | undefined): string | null {
    if (key === "CHE") return "Switzerland";
    if (key === "LIE") return "Liechtenstein";
    return key ?? null;
}

/**
 * GovernmentOrganization node for a body page (`@id` = `…/parliaments/:id#identity`).
 * Returns `[]` when the record has no label.
 */
export function bodyNode(
    data: BodyNodeData,
    _lang: MetaLang,
    _path: string | undefined,
): object[] {
    const b = data?.body;
    if (!b || b.id == null) return [];
    const name = b.legislative_name ?? b.name ?? b.body_key ?? null;
    if (!name) return [];

    const node: Record<string, unknown> = {
        "@type": "GovernmentOrganization",
        "@id": bodyNodeId(b.id),
        name,
        url: bodyPageUrl(b.id),
    };
    const image = b.flag_image_url ?? b.flag_image_oparl_url ?? undefined;
    if (image) node.image = image;

    const country = countryName(b.country_key);
    if (country || b.canton_key) {
        node.address = {
            "@type": "PostalAddress",
            ...(country ? { addressCountry: country } : {}),
            ...(b.canton_key ? { addressRegion: b.canton_key } : {}),
        };
    }

    const sameAs = [
        wikidataUrl(b.wikidata_id),
        b.consultations_url ?? null,
        b.elections_and_votings_url ?? null,
    ].filter((s): s is string => !!s);
    if (sameAs.length) node.sameAs = sameAs;

    return [node];
}
