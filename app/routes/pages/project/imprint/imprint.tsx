// routes/pages/project/imprint/imprint.tsx
//
// /project/imprint — the legal notice / Impressum (NS_IMPRINT). Same construction
// as /project/accessibility: page body copy is a loc fragment
// (/public/locales/<lang>/loc_imprint.json), SEO copy comes from `imprintMeta`.
//
// The operator identity, contact and license pointers live here as constants, not
// in the loc files: they are data, not translatable prose, and duplicating them
// across the seven language files would only invite drift (same rationale as the
// dates in accessibility.tsx). The operator name is shown ONLY on this page. What
// the code (Apache-2.0) and data (OpenParlData.ch, CC BY 4.0) licenses are is
// stated in one line each and links out — the FAQ carries the longer data-use answer.

import type { Route } from "./+types/imprint";
import { langByParam } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import { PAGE_CONFIG } from "~/configs/site.config";
import { imprintMeta } from "~/lib/seo/metas";
import { INTERNAL_LINK_CLASS, LinkValue } from "~/components/opd_views/opd_micros";

export const handle = PAGE_CONFIG.NS_IMPRINT.handle;

/** Operator + contact + license pointers — non-translatable, single source. */
const OPERATOR = "Wenzel Frick";
const EMAIL = "hello@wefrick.com";
const WEBSITE = "https://wefrick.com";
const REPO = "https://github.com/wenzf/parlhubcom";
const CODE_LICENSE = "Apache-2.0";
const DATA_SOURCE = "OpenParlData.ch";
const DATA_SOURCE_HREF = "https://openparldata.ch";
const DATA_LICENSE = "CC BY 4.0";
const DATA_LICENSE_HREF = "https://creativecommons.org/licenses/by/4.0/";

/** Drop the scheme so a link's visible text is just the host/path. */
const bare = (url: string) => url.replace(/^https?:\/\//, "");

export function meta({ params, location, matches }: Route.MetaArgs) {
  return imprintMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
  const { lang_code } = langByParam(params.lang);
  const locs = await getStaticData(["loc_imprint"], lang_code);
  return Response.json({ locs });
}

type ImprintContent = {
  title: string;
  nature: string;
  operator_label: string;
  contact_label: string;
  code_label: string;
  data_label: string;
  disclaimer: string;
};

export default function ImprintPage({ loaderData }: Route.ComponentProps) {
  const { locs } = loaderData as { locs: { imprint: ImprintContent } };
  const c = locs.imprint;

  return (
    <article className="mx-auto flex w-full max-w-prose flex-col gap-8 p-4 pt-2">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{c.title}</h1>
        <p className="text-lg text-muted-foreground">{c.nature}</p>
      </header>

      <dl className="flex flex-col gap-6">
        <Row label={c.operator_label}>
          <span className="text-foreground">{OPERATOR}</span>
        </Row>

        <Row label={c.contact_label}>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {/* mailto — internal link treatment (no new tab / external glyph). */}
            <a href={`mailto:${EMAIL}`} className={INTERNAL_LINK_CLASS}>
              {EMAIL}
            </a>
            <LinkValue href={WEBSITE}>{bare(WEBSITE)}</LinkValue>
          </div>
        </Row>

        <Row label={c.code_label}>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span className="text-foreground">{CODE_LICENSE}</span>
            <LinkValue href={REPO}>{bare(REPO)}</LinkValue>
          </div>
        </Row>

        <Row label={c.data_label}>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <LinkValue href={DATA_SOURCE_HREF}>{DATA_SOURCE}</LinkValue>
            <LinkValue href={DATA_LICENSE_HREF}>{DATA_LICENSE}</LinkValue>
          </div>
        </Row>
      </dl>

      <p className="text-base leading-relaxed text-muted-foreground">{c.disclaimer}</p>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
      <dt className="text-base text-muted-foreground sm:w-44 sm:shrink-0">{label}</dt>
      <dd className="text-base text-foreground">{children}</dd>
    </div>
  );
}
