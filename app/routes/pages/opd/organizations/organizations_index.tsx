// routes/pages/organizations/organizations_index.tsx
//
// /organizations — the top-level organizations catalogue (NS_ORGANIZATIONS_INDEX).
// LIST family: server-side search / sort over the register-of-interests entries
// grouped by normalized organization name (organizations_list.sql +
// runListPaginatedFiltered). Analogue of docs_index.tsx.

import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/organizations_index";

import organizations_list_sql from "~/server/db/sql/organizations/organizations_list.sql?raw";
import { runListPaginatedFiltered } from "~/server/db/core";
import { hasActiveCriteria, parseRaw, resolveLimit, resolveOrderBy } from "~/lib/dimensions/filters";
import { organizationsDescriptor } from "~/lib/dimensions/descriptors";

import OrganizationsList from "~/components/opd_views/organizations/OrganizationsList";
import { PAGE_CONFIG } from "~/configs/site.config";
import { organizationsIndexMeta } from "~/lib/seo/metas";

import { parseOffsetParam } from "~/lib/urls/params";

import { useDashboardLoc } from "~/hooks/use-dashboard-loc";
export const handle = PAGE_CONFIG.NS_ORGANIZATIONS_INDEX.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    const criteria = parseRaw(organizationsDescriptor, new URLSearchParams(location.search))
    return organizationsIndexMeta(ld?.data, {
        lang: params.lang,
        path: location.pathname, matches, params,
        query: criteria.q,
        filtered: hasActiveCriteria(organizationsDescriptor, criteria),
    })
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const criteria = parseRaw(organizationsDescriptor, url.searchParams);
    const limit = resolveLimit(organizationsDescriptor, criteria);
    const offset = parseOffsetParam(url.searchParams.get("offset"), limit) ?? 0;

    const data = await runListPaginatedFiltered<any>(organizations_list_sql, {
        langs: contentLangs(context, params.lang),
        limit,
        offset,
        filters: organizationsDescriptor.toSqlParams(criteria),
        orderBy: resolveOrderBy(organizationsDescriptor, criteria),
    });

    return Response.json({ data: { ...data, limit, offset } });
}

export default function OrganizationsIndexPage({ loaderData }: Route.ComponentProps) {
    const { data } = loaderData as { data: any };


    const { loc, locale } = useDashboardLoc();

    return (
        <OrganizationsList
            organizations={data?.organizations}
            loc={loc}
            locale={locale}
            limit={data?.limit}
            offset={data?.offset}
            pageParam={organizationsDescriptor.pageParam}
            exportConfig={{
                segment: "organizations",
                datasetKey: "organizations",
                filenameBase: "organizations",
                subject: "all organizations",
            }}
        />
    );
}
