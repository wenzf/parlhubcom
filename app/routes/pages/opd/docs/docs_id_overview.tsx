// routes/pages/docs/docs_id_overview.tsx
//
// Route module for /docs/:id — the single-document detail / overview
// (NS_DOCS_OVERVIEW). BY-ID family: runByIdLocalized + doc_by_id.sql returns the
// one localized doc plus the 4 linked-entity lookups (body, affair, meeting,
// agenda). Leaf entity — renders DocFull, no result layout. Analogue of
// speeches_id_overview.tsx.
//
// `handle.is_primary_data_match` is true so the layout/breadcrumbs read
// `data.doc`. The breadcrumb leaf + sidebar subtitle resolve to `data.doc.name`
// (see site.config.ts).
//
// NOTE FOR REPO WIRING (reconcile against your real speeches_id_overview.tsx):
//   • `./+types/docs_id_overview` Route types path + the `?raw` SQL alias.

import { langByParam, localizedPath } from "~/lib/lang";
import { contentLangs } from "~/server/content_langs.server";
import { affairHref, bodyHref, meetingHref } from "~/lib/urls/hrefs";
import type { Route } from "./+types/docs_id_overview";
import { PAGE_CONFIG } from "~/configs/site.config";

import { runByIdLocalized } from "~/server/db/core";
import docSql from "~/server/db/sql/docs/doc_by_id.sql?raw";
import type { DocByIdResult } from "@/types/opd_client";
import { useLoaderData, useParams, useRouteLoaderData } from "react-router";

import DocFull from "~/components/opd_views/docs/DocFull";
import EntityNotFound from "~/components/opd_views/_shared/EntityNotFound";
import { docMeta } from "~/lib/seo/metas";

export const handle = PAGE_CONFIG.NS_DOCS_OVERVIEW.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
  const ld = loaderData as unknown as { data?: any }
  return docMeta(ld?.data, { lang: params.lang, path: location.pathname, matches, params })
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const start = performance.now();
  const { lang_code } = langByParam(params.lang);
  const langs = contentLangs(context, params.lang);
  const id = Number(params.id);

  const data = await runByIdLocalized<NonNullable<DocByIdResult>>(docSql, {
    id,
    langs,
  });

  return Response.json(
    { data, perf: performance.now() - start },
    // Unknown doc id → still render (EntityNotFound below), but as a 404.
    { status: data ? 200 : 404 },
  );
}

export default function DocOverview() {
  const layoutRouteLoaderData = useRouteLoaderData(
    "routes/layouts/data_dashboard_layout",
  ) as
    | { locs?: { pages?: { person?: { labels?: Record<string, string> } } }; locale?: string }
    | undefined;
  const loaderData = useLoaderData() as { data?: NonNullable<DocByIdResult> } | undefined;
  const params = useParams();

  const loc = layoutRouteLoaderData?.locs?.pages?.person?.labels;
  const locale =
    layoutRouteLoaderData?.locale ?? (params.lang ? `${params.lang}-CH` : "de-CH");

  const doc = loaderData?.data?.doc;
  const body = loaderData?.data?.bodies?.items?.[0];
  const affair = loaderData?.data?.affairs?.items?.[0];
  const meeting = loaderData?.data?.meetings?.items?.[0];
  const agenda = loaderData?.data?.agendas?.items?.[0];

  if (!doc) return <EntityNotFound entity="doc" loc={loc} />;

  // Internal links only when the linked record was actually found in the lookup.
  const bodyLink =
    body != null && doc.body_id != null
      ? bodyHref(params.lang, doc.body_id)
      : null;
  const affairLink =
    affair != null && doc.affair_id != null
      ? affairHref(params.lang, doc.affair_id)
      : null;
  const meetingLink =
    meeting != null && doc.meeting_id != null
      ? meetingHref(params.lang, doc.meeting_id)
      : null;
  const backHref = localizedPath(params.lang, "NS_DOCS_INDEX");

  return (
    <div className="space-y-6 inset_page_transition">
      {/* doc_details anchor — matches the sidebar overview hash "" */}
      <div className="scroll-mt-24 space-y-6">
        <DocFull
          doc={doc}
          body={body}
          affair={affair}
          meeting={meeting}
          agenda={agenda}
          bodyHref={bodyLink}
          affairHref={affairLink}
          meetingHref={meetingLink}
          backHref={backHref}
          loc={loc}
          locale={locale}
        />
      </div>
    </div>
  );
}