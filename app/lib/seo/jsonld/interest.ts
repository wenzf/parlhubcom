// /app/lib/seo/jsonld/interest.ts
//
// Organization graph node for an /interests/:id page — head JSON-LD replacing
// the microdata <InterestBase /> and the interests layout emitted. The holder
// (declaring MP) is modelled as an OrganizationRole `member` → Person, matching
// how <PersonInterests /> models each interest. Wired into `interestMeta`.

import type { MetaLang } from "~/lib/seo/metas/core";
import type { InterestClient } from "@/types/opd_db";
import { isoOf } from "~/components/opd_views/opd_micros";
import { interestNodeId, interestPageUrl, personNodeId } from "./ids";

type InterestNodeData =
    | {
        interest?: InterestClient | null;
        persons?: { items?: Array<{ id?: number | null; fullname?: string | null }> };
    }
    | null
    | undefined;

/**
 * Organization node for an interest page (`@id` = `…/interests/:id#identity`).
 * Returns `[]` when the record has no name.
 */
export function interestNode(
    data: InterestNodeData,
    _lang: MetaLang,
    _path: string | undefined,
): object[] {
    const i = data?.interest;
    if (!i || i.id == null) return [];
    const name = i.name ?? i.name_short ?? i.name_abbreviation ?? null;
    if (!name) return [];

    const node: Record<string, unknown> = {
        "@type": "Organization",
        "@id": interestNodeId(i.id),
        name,
        url: interestPageUrl(i.id),
    };

    const holder = data?.persons?.items?.[0];
    const holderName = holder?.fullname ?? null;
    if (holderName) {
        const person: Record<string, unknown> =
            holder?.id != null
                ? { "@type": "Person", "@id": personNodeId(holder.id), name: holderName }
                : { "@type": "Person", name: holderName };
        const role: Record<string, unknown> = { "@type": "OrganizationRole", member: person };
        if (i.role_name) role.roleName = i.role_name;
        const start = isoOf(i.begin_date);
        if (start) role.startDate = start;
        const end = isoOf(i.end_date);
        if (end) role.endDate = end;
        node.member = role;
    }

    return [node];
}
