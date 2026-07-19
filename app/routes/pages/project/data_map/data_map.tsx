// routes/pages/project/data_map.tsx
//
// /project/data-map — the Data Map (NS_PROJECT_DATA_MAP). A standalone page (no
// data sidebar): a diagram of the data model and how the entities interconnect,
// each node linking to that entity's catalogue. Page copy is a loc fragment
// (/public/locales/<lang>/loc_data_map.json); SEO copy comes from dataMapMeta.

import type { Route } from "./+types/data_map";
import { langByParam } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import { PAGE_CONFIG } from "~/configs/site.config";
import { dataMapMeta } from "~/lib/seo/metas";
import { DataMap, type DataMapContent } from "~/components/data_map/DataMap";
import { LinkValue } from "~/components/opd_views/opd_micros";

export const handle = PAGE_CONFIG.NS_PROJECT_DATA_MAP.handle;

export function meta({ params, location, matches }: Route.MetaArgs) {
    return dataMapMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const locs = await getStaticData(["loc_data_map"], lang_code);
    return Response.json({ locs });
}

export default function DataMapPage({ params, loaderData }: Route.ComponentProps) {
    const { locs } = loaderData as { locs: { data_map: DataMapContent } };
    const c = locs.data_map;
    return (
        <div className="flex w-full flex-col gap-8 p-4 pt-2">
            <header className="mx-auto flex w-full max-w-prose flex-col gap-4">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {c.title}
                </h1>
                <p className="text-lg text-muted-foreground">{c.lead}</p>
            </header>

            <DataMap lang={params.lang} content={c} />

            {/* Provenance — the data is OpenParlData.ch's, imported with minor changes. */}
            <section className="mx-auto flex w-full max-w-prose flex-col gap-3 border-t border-border pt-6">
                <h2 className="text-lg font-medium tracking-tight text-foreground">
                    {c.source.heading}
                </h2>
                <p className="text-base leading-relaxed text-foreground">{c.source.body}</p>
                <div className="mt-1 flex flex-col gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {c.source.links_label}
                    </span>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <LinkValue href={c.source.openparldata_href}>
                            {c.source.openparldata_label}
                        </LinkValue>
                        <LinkValue href={c.source.schemas_href}>{c.source.schemas_label}</LinkValue>
                        <LinkValue href={c.source.raw_href}>{c.source.raw_label}</LinkValue>
                    </div>
                </div>
            </section>
        </div>
    );
}
