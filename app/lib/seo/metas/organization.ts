// /app/lib/seo/metas/organization.ts
//
// Meta for /organizations — an employer/association aggregated from lobby ties
// (leaf entity, irregular loader: raw row with `data.organization`, string key).
// The overview folds the stat counts into the description, so it's hand-written
// rather than using makeOverviewMeta. SEO copy lives in the `metas` block of
// loc_data_dashboard (keys `organization.*`); this file resolves facts + counts.

import type { MetaDescriptor } from "react-router";
import {
    type EntityMetaCtx,
    SITE_NAME,
    metaLang,
    buildMeta,
    countStr,
} from "./core";
import { makeIndexMeta } from "./factory";
import { metaLoc, substitute, mt } from "./loc";
import { jsonLdTag } from "~/lib/seo/jsonld/graph";
import { breadcrumbListJsonLd } from "~/lib/seo/jsonld/breadcrumbs";
import { organizationNode } from "~/lib/seo/jsonld/organization";

interface OrgRecord {
    name?: string | null;
    n_members?: number | null;
    n_mandates?: number | null;
    n_bodies?: number | null;
    n_paid?: number | null;
}

type OrgBaseData = { organization?: OrgRecord | null };

/** `/organizations/:id` — an organization's lobby footprint. Description folds the
 *  stat counts into `organization.overview` (tokens {name}/{members}/{mandates}/
 *  {bodies}/{site}). */
export function organizationMeta(
    data: OrgBaseData | null | undefined,
    { lang, path, matches, params }: EntityMetaCtx = {},
): MetaDescriptor[] {
    const L = metaLang(lang);
    const loc = metaLoc(matches);
    const o = data?.organization;
    const name = o?.name ?? SITE_NAME;
    return [
        ...buildMeta({
            title: name,
            description: substitute(mt(loc, "organization.overview"), {
                name,
                members: countStr(o?.n_members, L) || "0",
                mandates: countStr(o?.n_mandates, L) || "0",
                bodies: countStr(o?.n_bodies, L) || "0",
                site: SITE_NAME,
            }),
            path,
            lang: L,
        }),
        // One deduped @graph per page: breadcrumbs + the Organization node.
        ...jsonLdTag([
            ...breadcrumbListJsonLd(matches, params),
            ...organizationNode(data, L, path),
        ]),
    ];
}

export const organizationsIndexMeta = makeIndexMeta<{ organizations?: { total_count?: number } }>({
    copyPrefix: "organization.index",
    countKey: "organizations",
    catalogueDataset: { segment: "organizations", datasetKey: "organizations" },
});
