// routes/pages/project/data_guide/data_guide.tsx
//
// /project/data-guide — the "what you can explore" field guide (NS_PROJECT_DATA_GUIDE).
// A standalone page under project_layout (no data sidebar): eleven teaser cards
// grouped into four clusters (Actors / Proceedings / Records / Lobbying, mirroring
// the header's Explore grouping). Each card is an eyebrow (the data category),
// one bold question, and 1–3 curated links — every click lands on something
// worth seeing: a chart page (vocabulary word map, alignment scatter, lobby
// network, voting hemicycle) where one exists, otherwise a descriptive link into
// the section search. Concrete example targets are resolved live from the DB by
// getGuideExamples so they survive rebuilds.
//
// Page copy is a loc fragment (/public/locales/<lang>/loc_guide.json); SEO copy
// comes from dataGuideMeta.

import type { Route } from "./+types/data_guide";
import { NavLink, useParams } from "react-router";
import { langByParam, localizedPath } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import { getGuideExamples, type GuideExamples } from "~/server/guide_data.server";
import { PAGE_CONFIG } from "~/configs/site.config";
import { dataGuideMeta } from "~/lib/seo/metas";
import { InternalLink } from "~/components/opd_views/opd_micros";
import { Icon, type IconName } from "~/components/icons/opd_icons";
import type { PageNamespaces } from "@/types/site";

export const handle = PAGE_CONFIG.NS_PROJECT_DATA_GUIDE.handle;

export function meta({ params, location, matches }: Route.MetaArgs) {
    return dataGuideMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const [locs, examples] = await Promise.all([
        getStaticData(["loc_guide"], lang_code),
        getGuideExamples(lang_code),
    ]);
    return Response.json({ locs, examples });
}

type TypeCopy = {
    eyebrow: string;
    title: string;
    /** Link labels by link key; "{{name}}" is replaced with the example's label. */
    links: Record<string, string>;
    /** Per-language search terms for query links (see CardLink.qk). */
    queries?: Record<string, string>;
};
type GroupCopy = { heading: string; sub: string };
type GuideContent = {
    title: string;
    lead: string;
    map_link: string;
    groups: Record<string, GroupCopy>;
    types: Record<string, TypeCopy>;
};

// One link on a card. `example` plugs that resolved example's id into the route's
// :id; `qk` appends ?q=<loc queries[qk]> (a localized search term).
type CardLink = {
    k: string;
    ns: PageNamespaces;
    example?: keyof GuideExamples;
    qk?: string;
};
type TypeDef = { key: string; icon: IconName; links: CardLink[] };

// The four clusters, mirroring NAV_SECTION_GROUPS (header Explore). Link order =
// eyecatcher first (chart/diagram pages), section search last. Categories with no
// chart page and no standout record link only to their search.
const GROUPS: { key: string; types: TypeDef[] }[] = [
    {
        key: "actors",
        types: [
            {
                key: "people",
                icon: "user",
                links: [
                    { k: "vocabulary", ns: "NS_PEOPLE_VOCABULARY", example: "people_vocabulary" },
                    { k: "alignment", ns: "NS_PEOPLE_ALIGNMENT", example: "people_alignment" },
                    { k: "search", ns: "NS_PEOPLE_INDEX" },
                ],
            },
            {
                key: "bodies",
                icon: "landmark",
                links: [
                    { k: "loyalty", ns: "NS_BODIES_LOYALTY", example: "bodies" },
                    { k: "lobby", ns: "NS_BODIES_LOBBY", example: "bodies" },
                    { k: "people", ns: "NS_BODIES_PEOPLE", example: "bodies" },
                    { k: "search", ns: "NS_BODIES_INDEX" },
                ],
            },
            {
                key: "groups",
                icon: "users-2",
                links: [{ k: "search", ns: "NS_GROUPS_INDEX" }],
            },
        ],
    },
    {
        key: "proceedings",
        types: [
            {
                key: "affairs",
                icon: "file-text",
                links: [
                    { k: "example", ns: "NS_AFFAIRS_OVERVIEW", example: "affairs" },
                    { k: "search", ns: "NS_AFFAIRS_INDEX" },
                ],
            },
            {
                key: "votings",
                icon: "vote",
                links: [
                    { k: "example", ns: "NS_VOTINGS_OVERVIEW", example: "votings" },
                    { k: "search", ns: "NS_VOTINGS_INDEX" },
                ],
            },
            {
                key: "meetings",
                icon: "calendar-days",
                links: [{ k: "search", ns: "NS_MEETINGS_INDEX" }],
            },
        ],
    },
    {
        key: "records",
        types: [
            {
                key: "speeches",
                icon: "mic",
                links: [
                    { k: "wolf", ns: "NS_SPEECHES_INDEX", qk: "wolf" },
                    { k: "search", ns: "NS_SPEECHES_INDEX" },
                ],
            },
            {
                key: "texts",
                icon: "newspaper",
                links: [
                    { k: "bitcoin", ns: "NS_TEXTS_INDEX", qk: "bitcoin" },
                    { k: "search", ns: "NS_TEXTS_INDEX" },
                ],
            },
            {
                key: "docs",
                icon: "paperclip",
                links: [{ k: "search", ns: "NS_DOCS_INDEX" }],
            },
        ],
    },
    {
        key: "lobbying",
        types: [
            {
                key: "interests",
                icon: "briefcase",
                links: [
                    // The standout record here is a PERSON: a famous member with many
                    // declared mandates → their interests page.
                    { k: "example", ns: "NS_PEOPLE_INTERESTS", example: "people_interests" },
                    { k: "search", ns: "NS_INTERESTS_INDEX" },
                ],
            },
            {
                key: "organizations",
                icon: "share-2",
                links: [
                    { k: "example", ns: "NS_ORGANIZATIONS_OVERVIEW", example: "organizations" },
                    { k: "search", ns: "NS_ORGANIZATIONS_INDEX" },
                ],
            },
        ],
    },
];

export default function DataGuidePage({ loaderData }: Route.ComponentProps) {
    const { locs, examples } = loaderData as unknown as {
        locs: { guide: GuideContent };
        examples: GuideExamples;
    };
    const c = locs.guide;
    const { lang } = useParams();

    /** Resolve one card link to { href, label } — null when its example is missing. */
    const resolve = (t: TypeDef, l: CardLink): { href: string; label: string } | null => {
        const tc = c.types[t.key];
        let label = tc?.links?.[l.k];
        if (!label) return null;
        if (l.example) {
            const ex = examples[l.example];
            if (!ex) return null;
            label = label.replace("{{name}}", ex.label);
            return { href: localizedPath(lang, l.ns, { id: ex.id }), label };
        }
        const q = l.qk ? tc?.queries?.[l.qk] : undefined;
        const href = `${localizedPath(lang, l.ns)}${q ? `?q=${encodeURIComponent(q)}` : ""}`;
        return { href, label };
    };

    return (
        // A plain <div>, not <main>: project_layout wraps every /project leaf in
        // the section's single <main> landmark, so one here would duplicate it.
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-4 pt-2 pb-16">
            <header className="flex max-w-prose flex-col gap-4">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{c.title}</h1>
                <p className="text-lg text-muted-foreground">{c.lead}</p>
            </header>

            {GROUPS.map((g) => {
                const gc = c.groups[g.key];
                return (
                    <section key={g.key} className="flex flex-col gap-4">
                        <div className="flex items-baseline gap-3 border-b border-border pb-2">
                            <h2 className="text-lg font-medium tracking-tight text-foreground">{gc?.heading}</h2>
                            <span className="ml-auto text-xs text-muted-foreground">{gc?.sub}</span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {g.types.map((t) => {
                                const tc = c.types[t.key];
                                const links = t.links
                                    .map((l) => ({ k: l.k, r: resolve(t, l) }))
                                    .filter((x): x is { k: string; r: { href: string; label: string } } => x.r !== null);
                                // Examples (bulleted list) sit apart from the section's search /
                                // overview page (single arrow link at the card foot).
                                const exampleLinks = links.filter((l) => l.k !== "search");
                                const searchLink = links.find((l) => l.k === "search");
                                return (
                                    <div
                                        key={t.key}
                                        className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-5"
                                    >
                                        {/* eyebrow: icon + quiet category label */}
                                        <div className="flex items-center gap-2">
                                            <Icon name={t.icon} className="size-4 shrink-0 text-muted-foreground" />
                                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                                {tc?.eyebrow}
                                            </span>
                                        </div>
                                        {/* the hook: one question, quiet weight (base h3 = 550) */}
                                        <h3 className="text-lg tracking-tight text-foreground">
                                            {tc?.title}
                                        </h3>

                                        {/* examples: bulleted, no trailing arrow (wraps cleanly) */}
                                        {exampleLinks.length > 0 && (
                                            <ul className="flex list-disc flex-col gap-1.5 pl-4 marker:text-muted-foreground">
                                                {exampleLinks.map(({ k, r }) => (
                                                    <li key={k}>
                                                        <NavLink
                                                            to={r.href}
                                                            end
                                                            viewTransition
                                                            className="rounded-sm text-sm text-primary underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                                        >
                                                            {r.label}
                                                        </NavLink>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {/* the section's own search / overview page */}
                                        {searchLink && (
                                            <div className="mt-auto border-t border-border/60 pt-3">
                                                <InternalLink to={searchLink.r.href} className="text-sm font-normal">
                                                    {searchLink.r.label}
                                                </InternalLink>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            <footer className="flex flex-col items-start gap-2 border-t border-border pt-6">
                <InternalLink to={localizedPath(lang, "NS_PROJECT_DATA_MAP")} className="text-sm">
                    {c.map_link}
                </InternalLink>
            </footer>
        </div>
    );
}
