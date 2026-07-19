// routes/pages/project/sustainability/sustainability.tsx
//
// /project/sustainability — the static sustainability page (NS_SUSTAINABILITY).
// Same construction as /project/about: page copy is a loc fragment
// (/public/locales/<lang>/loc_sustainability.json), SEO copy comes from the
// `sustainabilityMeta` builder.
//
// This page is also the disclosure document /carbon.txt points its org.disclosures
// entry at, so its URL is load-bearing: the Green Web Foundation validator fetches
// it and a valid carbon.txt needs at least one reachable disclosure. Moving or
// renaming it means updating carbon_txt.ts in the same change.

import type { Route } from "./+types/sustainability";
import { langByParam } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import { PAGE_CONFIG } from "~/configs/site.config";
import { sustainabilityMeta } from "~/lib/seo/metas";
import { LinkValue } from "~/components/opd_views/opd_micros";

export const handle = PAGE_CONFIG.NS_SUSTAINABILITY.handle;

export function meta({ params, location, matches }: Route.MetaArgs) {
    return sustainabilityMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const locs = await getStaticData(["loc_sustainability"], lang_code);
    return Response.json({ locs });
}

type LocLink = { label: string; href: string };

type Section = {
    heading: string;
    body: string[];
    links?: LocLink[];
};

type SustainabilityContent = {
    title: string;
    lead: string;
    hosting: Section;
    site: Section;
    limits: Section;
    carbontxt: Section;
};

/** The prose sections, in render order. Keys mirror loc_sustainability.json. */
const SECTIONS = ["hosting", "site", "limits", "carbontxt"] as const;

export default function SustainabilityPage({ loaderData }: Route.ComponentProps) {
    const { locs } = loaderData as { locs: { sustainability: SustainabilityContent } };
    const c = locs.sustainability;

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
                                {s.links.map((l) => (
                                    <LinkValue key={l.href} href={l.href}>
                                        {l.label}
                                    </LinkValue>
                                ))}
                            </div>
                        ) : null}
                    </section>
                );
            })}
        </article>
    );
}
