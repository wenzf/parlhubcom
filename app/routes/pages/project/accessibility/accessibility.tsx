// routes/pages/project/accessibility/accessibility.tsx
//
// /project/accessibility — the accessibility statement (NS_ACCESSIBILITY). Same
// construction as /project/about and /project/sustainability: page copy is a loc
// fragment (/public/locales/<lang>/loc_accessibility.json), SEO copy comes from the
// `accessibilityMeta` builder.
//
// The section order follows the EU model statement (Implementing Decision (EU)
// 2018/1523) — conformance status, measures, known limitations, feedback channel,
// then preparation method + dates. parlhub is a private non-profit and is NOT bound
// by that directive (nor by BehiG/eCH-0059); the model is followed because it is the
// shape readers expect, and the page says plainly that it is voluntary.
//
// The two dates live here rather than in the loc files: they are data, not
// translatable prose, and duplicating them across five languages would guarantee
// they drift apart. Bump PREPARED/REVIEWED when the statement's substance changes.

import type { Route } from "./+types/accessibility";
import { langByParam } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import { PAGE_CONFIG, SITE_TIME_ZONE } from "~/configs/site.config";
import { accessibilityMeta } from "~/lib/seo/metas";
import { LinkValue } from "~/components/opd_views/opd_micros";

export const handle = PAGE_CONFIG.NS_ACCESSIBILITY.handle;

/** ISO dates for the statement's own provenance. Bump on substantive edits. */
const PREPARED = "2026-07-15";
const REVIEWED = "2026-07-15";

export function meta({ params, location, matches }: Route.MetaArgs) {
  return accessibilityMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
  const { lang_code } = langByParam(params.lang);
  const locs = await getStaticData(["loc_accessibility"], lang_code);
  return Response.json({ locs, lang_code });
}

type LocLink = { label: string; href: string };

type Section = {
  heading: string;
  body: string[];
  links?: LocLink[];
};

type AccessibilityContent = {
  title: string;
  lead: string;
  conformance: Section;
  measures: Section;
  limitations: Section;
  feedback: Section;
  statement: {
    heading: string;
    prepared_label: string;
    reviewed_label: string;
    method: string;
  };
};

/** The prose sections, in the EU model's order. Keys mirror loc_accessibility.json. */
const SECTIONS = ["conformance", "measures", "limitations", "feedback"] as const;

export default function AccessibilityPage({ loaderData }: Route.ComponentProps) {
  const { locs, lang_code } = loaderData as {
    locs: { accessibility: AccessibilityContent };
    lang_code: string;
  };
  const c = locs.accessibility;

  // Locale-formatted date; the <time> keeps the ISO value machine-readable.
  // The zone is pinned to Europe/Zurich (the site's own zone): without it the
  // UTC-midnight instant renders as the *previous* day in browsers west of UTC,
  // while the UTC server renders the ISO day -> hydration text mismatch (#418).
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(lang_code, {
      dateStyle: "long",
      timeZone: SITE_TIME_ZONE,
    }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <article className="mx-auto flex w-full max-w-prose flex-col gap-10 p-4 pt-2">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{c.title}</h1>
        <p className="text-lg text-muted-foreground">{c.lead}</p>
      </header>

      {SECTIONS.map((key) => {
        const s = c[key];
        return (
          <section key={key} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium tracking-tight text-foreground">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="text-base leading-relaxed text-foreground">
                {p}
              </p>
            ))}
            {s.links?.length ? (
              <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
                {s.links.map((l) =>
                  l.href.startsWith("mailto:") ? (
                    <a
                      key={l.href}
                      href={l.href}
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 rounded-sm hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <LinkValue key={l.href} href={l.href}>
                      {l.label}
                    </LinkValue>
                  ),
                )}
              </div>
            ) : null}
          </section>
        );
      })}

      {/* Provenance — the model statement's "prepared on / last reviewed" block. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium tracking-tight text-foreground">
          {c.statement.heading}
        </h2>
        <p className="text-base leading-relaxed text-foreground">{c.statement.method}</p>
        <dl className="flex flex-col gap-1 text-base text-muted-foreground sm:flex-row sm:gap-6">
          <div className="flex gap-2">
            <dt>{c.statement.prepared_label}</dt>
            <dd>
              <time dateTime={PREPARED} className="text-foreground">
                {fmt(PREPARED)}
              </time>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt>{c.statement.reviewed_label}</dt>
            <dd>
              <time dateTime={REVIEWED} className="text-foreground">
                {fmt(REVIEWED)}
              </time>
            </dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
