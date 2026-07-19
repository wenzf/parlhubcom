// routes/pages/about/about.tsx
//
// /about — the static project / branding page (NS_ABOUT). Not a data section:
// the page body copy is loaded as a loc fragment from
// /public/locales/<lang>/loc_about.json (same mechanism as every other loc),
// and the SEO title/description come from the `aboutMeta` builder.

import type { Route } from "./+types/about";
import { useParams } from "react-router";
import { langByParam, localizedPath } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import { PAGE_CONFIG } from "~/configs/site.config";
import { aboutMeta } from "~/lib/seo/metas";
import { INTERNAL_LINK_CLASS, InternalLink, LinkValue } from "~/components/opd_views/opd_micros";

export const handle = PAGE_CONFIG.NS_ABOUT.handle;

export function meta({ params, location, matches }: Route.MetaArgs) {
    return aboutMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const locs = await getStaticData(["loc_about"], lang_code);
    return Response.json({ locs });
}

type Section = { heading: string; body: string[] };

type AboutContent = {
    title: string;
    lead: string;
    data: Section & { source_label: string; source_href: string };
    /** No accessibility copy here on purpose: the conformance claim lives only on
     *  /project/accessibility, reachable from the header menu and /project. */
    goal: Section;
    maintainer: Section & {
        website_label: string;
        website_href: string;
        email_label: string;
        email_href: string;
        code_label: string;
        code_href: string;
        imprint_label: string;
    };
    not: Section;
};

export default function AboutPage({ loaderData }: Route.ComponentProps) {
    const { locs } = loaderData as { locs: { about: AboutContent } };
    const { lang } = useParams();
    const c = locs.about;
    return (
        <article className="mx-auto flex w-full max-w-prose flex-col gap-10 p-4 pt-2">
            <header className="flex flex-col gap-4">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {c.title}
                </h1>
                <p className="text-lg text-muted-foreground">{c.lead}</p>
            </header>

            <Prose heading={c.data.heading} body={c.data.body}>
                <LinkValue href={c.data.source_href}>{c.data.source_label}</LinkValue>
            </Prose>

            <Prose heading={c.goal.heading} body={c.goal.body} />

            <Prose heading={c.maintainer.heading} body={c.maintainer.body}>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <LinkValue href={c.maintainer.website_href}>
                        {c.maintainer.website_label}
                    </LinkValue>
                    {/* mailto — same link treatment, but no new tab / external glyph. */}
                    <a href={c.maintainer.email_href} className={INTERNAL_LINK_CLASS}>
                        {c.maintainer.email_label}
                    </a>
                    <LinkValue href={c.maintainer.code_href}>
                        {c.maintainer.code_label}
                    </LinkValue>
                    <InternalLink to={localizedPath(lang, "NS_IMPRINT")}>
                        {c.maintainer.imprint_label}
                    </InternalLink>
                </div>
            </Prose>

            <Prose heading={c.not.heading} body={c.not.body} />
        </article>
    );
}

function Prose({
    heading,
    body,
    children,
}: {
    heading: string;
    body: string[];
    children?: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-lg font-medium tracking-tight text-foreground">
                {heading}
            </h2>
            {body.map((p, i) => (
                <p key={i} className="text-base leading-relaxed text-foreground">
                    {p}
                </p>
            ))}
            {children ? <div className="mt-1">{children}</div> : null}
        </section>
    );
}
