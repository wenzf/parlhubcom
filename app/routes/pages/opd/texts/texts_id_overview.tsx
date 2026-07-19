// routes/pages/texts/texts_id_overview.tsx
//
// Route module for /texts/:id — the single-text detail / overview
// (NS_TEXTS_OVERVIEW). BY-ID family: runByIdLocalized + text_by_id.sql returns
// the one localized text plus its institution lookup. A text is a LEAF entity
// (no sub-feeds), so this route renders the whole surface itself (TextFull) — no
// result layout, mirroring votings_id_overview.tsx.
//
// `handle.is_primary_data_match` is true so the layout/breadcrumbs read
// `data.text`. The breadcrumb leaf + sidebar subtitle resolve to `data.text.type`
// (see site.config.ts).
//
// NOTE FOR REPO WIRING (reconcile against your real votings_id_overview.tsx):
//   • `./+types/texts_id_overview` Route types path + the `?raw` SQL alias.

import { langByParam, localizedPath } from "~/lib/lang";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/texts_id_overview";
import { PAGE_CONFIG } from "~/configs/site.config";

import { runByIdLocalized } from "~/server/db/core";
import textSql from "~/server/db/sql/texts/text_by_id.sql?raw";
import type { TextByIdResult } from "@/types/opd_client";
import { useLoaderData, useParams, useRouteLoaderData } from "react-router";

import TextFull from "~/components/opd_views/texts/TextFull";
import EntityNotFound from "~/components/opd_views/_shared/EntityNotFound";
import { textMeta } from "~/lib/seo/metas";

export const handle = PAGE_CONFIG.NS_TEXTS_OVERVIEW.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return textMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ params, context }: Route.LoaderArgs) {
    const start = performance.now();
    const { lang_code } = langByParam(params.lang);

    // SQL localization priority: page language first, then the standard CH
    // fallbacks. loc()/loc_lang() read up to 5 slots ($2..$6); duplicates are harmless.
    const langs = contentLangs(context, params.lang);
    const id = Number(params.id);

    const data = await runByIdLocalized<NonNullable<TextByIdResult>>(textSql, {
        id,
        langs,
    });

    return Response.json(
        { data, perf: performance.now() - start },
        // Unknown text id → still render (EntityNotFound below), but as a 404.
        { status: data ? 200 : 404 },
    );
}

export default function TextOverview() {
    const layoutRouteLoaderData = useRouteLoaderData(
        "routes/layouts/data_dashboard_layout",
    ) as
        | { locs?: { pages?: { person?: { labels?: Record<string, string> } } }; locale?: string }
        | undefined;
    const loaderData = useLoaderData() as {
        data?: NonNullable<TextByIdResult>;
    } | undefined;


    const params = useParams();

    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels;
    const locale =
        layoutRouteLoaderData?.locale ?? (params.lang ? `${params.lang}-CH` : "de-CH");

    const text = loaderData?.data?.text;
    const body = loaderData?.data?.bodies?.items?.[0];
    const affair = loaderData?.data?.affairs?.items?.[0];

    if (!text) return <EntityNotFound entity="text" loc={loc} />;

    const affairHref =
        text.affair_id != null
            ? localizedPath(params.lang, "NS_AFFAIRS_OVERVIEW", {
                id: String(text.affair_id),
            })
            : null;
    const bodyHref =
        text.body_id != null
            ? localizedPath(params.lang, "NS_BODIES_OVERVIEW", {
                id: String(text.body_id),
            })
            : null;
    const backHref = localizedPath(params.lang, "NS_TEXTS_INDEX");

    return (
        <div className="space-y-6 inset_page_transition">
            {/* text_details anchor — matches the sidebar overview hash "" */}
            <div className="scroll-mt-24 space-y-6">
                <TextFull
                    text={text}
                    body={body}
                    affair={affair}
                    affairHref={affairHref}
                    bodyHref={bodyHref}
                    backHref={backHref}
                    loc={loc}
                    locale={locale}
                />
            </div>
        </div>
    );
}