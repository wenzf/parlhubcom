// routes/pages/faq/faq.tsx
//
// /faq — the static FAQ page (NS_FAQ). Same construction as /about: page copy
// is a loc fragment (/public/locales/<lang>/loc_faq.json), SEO copy comes from
// the `faqMeta` builder — which also emits FAQPage JSON-LD from the same loc
// content. Each question heading carries a stable, language-independent id
// (item.id) and links to itself, so a specific answer can be shared / indexed
// as /faq#<id>.

import type { Route } from "./+types/faq";
import { langByParam } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import { PAGE_CONFIG } from "~/configs/site.config";
import { faqMeta, type FaqLocContent } from "~/lib/seo/metas";
import { LinkValue } from "~/components/opd_views/opd_micros";

export const handle = PAGE_CONFIG.NS_FAQ.handle;

export function meta({ loaderData, params, location, matches }: Route.MetaArgs) {
    const ld = loaderData as unknown as { locs?: { faq?: FaqLocContent } };
    return faqMeta(ld?.locs?.faq, { lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const locs = await getStaticData(["loc_faq"], lang_code);
    return Response.json({ locs });
}

type FaqItem = {
    id: string;
    q: string;
    body: string[];
    code?: string[];
    body_after?: string[];
    links?: { label: string; href: string }[];
};

type FaqContent = {
    title: string;
    lead: string;
    items: FaqItem[];
};

export default function FaqPage({ loaderData }: Route.ComponentProps) {
    const { locs } = loaderData as { locs: { faq: FaqContent } };
    const c = locs.faq;
    return (
        <article className="mx-auto flex w-full max-w-prose flex-col gap-10 p-4 pt-2">
            <header className="flex flex-col gap-4">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {c.title}
                </h1>
                <p className="text-lg text-muted-foreground">{c.lead}</p>
            </header>

            {c.items.map((item) => (
                <section key={item.id} id={item.id} className="flex flex-col gap-3 scroll-mt-4">
                    {/* The heading links to its own anchor so a question's URL can be
              copied from the address bar / link context menu. Quiet treatment:
              foreground text, underline on hover, standard focus ring. */}
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                        <a
                            href={`#${item.id}`}
                            className="rounded-sm underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            {item.q}
                        </a>
                    </h2>
                    {item.body.map((p, i) => (
                        <p key={i} className="text-base leading-relaxed text-foreground">
                            {p}
                        </p>
                    ))}
                    {item.code?.length ? (
                        <pre className="overflow-x-auto rounded-md bg-muted px-4 py-3 text-sm text-foreground">
                            <code>{item.code.join("\n")}</code>
                        </pre>
                    ) : null}
                    {item.body_after?.map((p, i) => (
                        <p key={i} className="text-base leading-relaxed text-foreground">
                            {p}
                        </p>
                    ))}
                    {item.links?.length ? (
                        <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
                            {item.links.map((l) =>
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
            ))}
        </article>
    );
}
