// routes/pages/speeches/speeches_id_overview.tsx
//
// Route module for /speeches/:id — the single-speech detail / overview
// (NS_SPEECHES_OVERVIEW). BY-ID family: runByIdLocalized + speech_by_id.sql
// returns the one localized speech plus the 5 linked-entity lookups (person,
// body, affair, meeting, agenda). Leaf entity — renders SpeechFull, no result
// layout. Analogue of texts_id_overview.tsx.

import { langByParam, localizedPath } from "~/lib/lang";
import { contentLangs } from "~/server/content_langs.server";
import type { Route } from "./+types/speeches_id_overview";
import { PAGE_CONFIG } from "~/configs/site.config";

import { runByIdLocalized } from "~/server/db/core";
import speechSql from "~/server/db/sql/speeches/speech_by_id.sql?raw";
import type { SpeechByIdResult } from "@/types/opd_client";
import { useLoaderData, useParams, useRouteLoaderData } from "react-router";

import SpeechFull from "~/components/opd_views/speeches/SpeechFull";
import EntityNotFound from "~/components/opd_views/_shared/EntityNotFound";
import { DataExport } from "~/components/opd_views/_shared/DataExport";
import { entityFieldsTable } from "~/components/opd_views/_shared/export_helpers";
import { speechMeta } from "~/lib/seo/metas";

export const handle = PAGE_CONFIG.NS_SPEECHES_OVERVIEW.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { data?: any }
    return speechMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ params, context }: Route.LoaderArgs) {
    const start = performance.now();
    const { lang_code } = langByParam(params.lang);
    const langs = contentLangs(context, params.lang);
    const id = Number(params.id);

    const data = await runByIdLocalized<NonNullable<SpeechByIdResult>>(speechSql, {
        id,
        langs,
    });

    return Response.json(
        { data, perf: performance.now() - start },
        // Unknown speech id → still render (EntityNotFound below), but as a 404.
        { status: data ? 200 : 404 },
    );
}

export default function SpeechOverview() {
    const layoutRouteLoaderData = useRouteLoaderData(
        "routes/layouts/data_dashboard_layout",
    ) as
        | { locs?: { pages?: { person?: { labels?: Record<string, string> } } }; locale?: string }
        | undefined;
    const loaderData = useLoaderData() as { data?: NonNullable<SpeechByIdResult> } | undefined;
    const params = useParams();

    const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels;
    const locale =
        layoutRouteLoaderData?.locale ?? (params.lang ? `${params.lang}-CH` : "de-CH");

    const speech = loaderData?.data?.speech;
    const speaker = loaderData?.data?.persons?.items?.[0];
    const body = loaderData?.data?.bodies?.items?.[0];
    const affair = loaderData?.data?.affairs?.items?.[0];
    const meeting = loaderData?.data?.meetings?.items?.[0];
    const agenda = loaderData?.data?.agendas?.items?.[0];

    if (!speech) return <EntityNotFound entity="speech" loc={loc} />;

    // Internal links only when the linked record was actually found in the lookup.
    const personHref =
        speaker != null && speech.person_id != null
            ? localizedPath(params.lang, "NS_PEOPLE_OVERVIEW", {
                id: String(speech.person_id),
            })
            : null;
    const bodyHref =
        body != null && speech.body_id != null
            ? localizedPath(params.lang, "NS_BODIES_OVERVIEW", {
                id: String(speech.body_id),
            })
            : null;
    const affairHref =
        affair != null && speech.affair_id != null
            ? localizedPath(params.lang, "NS_AFFAIRS_OVERVIEW", {
                id: String(speech.affair_id),
            })
            : null;
    const backHref = localizedPath(params.lang, "NS_SPEECHES_INDEX");

    // "This page" export (JSON/CSV/XLSX of the speech's fields, incl. the
    // transcript) + the Print action; the print stylesheet strips the app chrome.
    const exportControl = (
        <DataExport
            filename={`speech-${speech.id}`}
            tables={[entityFieldsTable("speech", speech as unknown as Record<string, unknown>, loc)]}
            jsonMeta={{ dataset: "speech", totalEntries: 1 }}
            loc={loc}
            className="shrink-0 data-export-hide"
        />
    );

    return (
        <div className="space-y-6 inset_page_transition">
            {/* speech_details anchor — matches the sidebar overview hash "" */}
            <div className="scroll-mt-24 space-y-6">
                <SpeechFull
                    speech={speech}
                    speaker={speaker}
                    body={body}
                    affair={affair}
                    meeting={meeting}
                    agenda={agenda}
                    personHref={personHref}
                    bodyHref={bodyHref}
                    affairHref={affairHref}
                    backHref={backHref}
                    actions={exportControl}
                    loc={loc}
                    locale={locale}
                />
            </div>
        </div>
    );
}
