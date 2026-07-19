// /app/lib/seo/jsonld/organization.ts
//
// Organization graph node for an /organizations/:key page — head JSON-LD
// replacing the microdata <OrgBase /> and the organizations layout emitted. The
// entity is keyed by a string `key` (not a numeric id). Wired into
// `organizationMeta` (metas/organization.ts).

import type { MetaLang } from "~/lib/seo/metas/core";
import { orgNodeId, orgPageUrl } from "./ids";

type OrgNodeData =
    | { organization?: { key?: string | null; name?: string | null } | null }
    | null
    | undefined;

/**
 * Organization node for an organization page (`@id` =
 * `…/organizations/:key#identity`). Returns `[]` when the record has no key.
 */
export function organizationNode(
    data: OrgNodeData,
    _lang: MetaLang,
    _path: string | undefined,
): object[] {
    const o = data?.organization;
    if (!o?.key) return [];
    return [
        {
            "@type": "Organization",
            "@id": orgNodeId(o.key),
            name: o.name ?? o.key,
            url: orgPageUrl(o.key),
        },
    ];
}
