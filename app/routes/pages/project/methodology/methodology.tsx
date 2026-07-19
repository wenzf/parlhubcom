// routes/pages/project/methodology/methodology.tsx
//
// /project/methodology: the Methodology page (NS_PROJECT_METHODOLOGY). A
// standalone page under project_layout (no data sidebar): it documents exactly
// how each computed metric on parlhub is derived and links every one to the
// source code on GitHub. Metrics are grouped (Parliaments / People / Votings /
// the site itself); each entry is a self-anchoring title, a dense prose
// explanation, the exact formula (language-neutral, kept in this file), the
// source files on GitHub, and the routes where the metric appears.
//
// The prose + labels are a loc fragment (/public/locales/<lang>/loc_methodology.json);
// the formulas, code paths and route patterns are universal and live here. SEO
// copy comes from methodologyMeta. The per-chart back-links that point here use
// MethodologyLink (app/components/opd_views/_shared/MethodologyLink.tsx).

import type { Route } from "./+types/methodology";
import { langByParam } from "~/lib/lang";
import { getStaticData } from "~/server/static/get_static_data.server";
import { PAGE_CONFIG, REPO_URL } from "~/configs/site.config";
import { methodologyMeta } from "~/lib/seo/metas";
import { Icon } from "~/components/icons/opd_icons";
import { METHODOLOGY_GROUPS } from "./methodology_groups";

export const handle = PAGE_CONFIG.NS_PROJECT_METHODOLOGY.handle;

export function meta({ params, location, matches }: Route.MetaArgs) {
    return methodologyMeta({ lang: params.lang, path: location.pathname, matches, params });
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const locs = await getStaticData(["loc_methodology"], lang_code);
    return Response.json({ locs });
}

// Files are linked at the default branch so a link keeps working as the code
// moves; the on-page anchors are what stay stable. The metric config (groups,
// anchors, formulas, source paths) lives in site.config (METHODOLOGY_GROUPS).
const ghBlob = (path: string) => `${REPO_URL}/blob/master/${path}`;

type MethodCopy = { title: string; body: string };
type GroupCopy = { heading: string; sub: string };
type MethodologyContent = {
    title: string;
    lead: string;
    labels: { formula: string; sources: string; used_on: string };
    repo_link: string;
    groups: Record<string, GroupCopy>;
    methods: Record<string, MethodCopy>;
};

export default function MethodologyPage({ loaderData }: Route.ComponentProps) {
    const { locs } = loaderData as unknown as { locs: { methodology: MethodologyContent } };
    const c = locs.methodology;

    return (
        // A plain <div>, not <main>: project_layout wraps every /project leaf in the
        // section's single <main> landmark, so one here would duplicate it.
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 p-4 pt-2 pb-16">
            <header className="flex flex-col gap-4">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{c.title}</h1>
                <p className="text-lg text-muted-foreground">{c.lead}</p>
            </header>

            {METHODOLOGY_GROUPS.map((g) => {
                const gc = c.groups[g.key];
                return (
                    <section key={g.key} className="flex flex-col gap-8">
                        <div className="flex items-baseline gap-3 border-b border-border pb-2">
                            <h2 className="text-lg font-medium tracking-tight text-foreground">{gc?.heading}</h2>
                            <span className="ml-auto text-xs text-muted-foreground">{gc?.sub}</span>
                        </div>

                        {g.methods.map((m) => {
                            const mc = c.methods[m.key];
                            if (!mc) return null;
                            return (
                                <article
                                    key={m.key}
                                    id={m.anchor}
                                    className="flex scroll-mt-24 flex-col gap-4"
                                >
                                    {/* Self-anchoring title: the whole heading is a link to its
                                        own #anchor, so it can be deep-linked from a chart. */}
                                    <h3 className="text-xl tracking-tight text-foreground">
                                        <a
                                            href={`#${m.anchor}`}
                                            className="group inline-flex items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        >
                                            <Icon name={m.icon} className="size-5 shrink-0 text-muted-foreground" />
                                            <span className="underline decoration-transparent underline-offset-4 group-hover:decoration-current">
                                                {mc.title}
                                            </span>
                                            <span
                                                aria-hidden="true"
                                                className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                                            >
                                                #
                                            </span>
                                        </a>
                                    </h3>

                                    <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
                                        {mc.body}
                                    </p>

                                    {/* Formula: universal notation; symbols are defined in the prose. */}
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                            {c.labels.formula}
                                        </span>
                                        <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-4 text-xs leading-relaxed text-foreground">
                                            <code>{m.formula.join("\n")}</code>
                                        </pre>
                                    </div>

                                    <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                                        {/* Source code on GitHub. Long mono paths would
                                            otherwise overflow and overlap the sibling block on
                                            narrow screens, so each list scrolls horizontally
                                            inside its own column (min-w-0 lets it shrink). */}
                                        <div className="flex min-w-0 flex-col gap-1.5">
                                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                                {c.labels.sources}
                                            </span>
                                            <ul className="flex flex-col gap-1 overflow-x-auto">
                                                {m.sources.map((path) => (
                                                    <li key={path}>
                                                        <a
                                                            href={ghBlob(path)}
                                                            target="_blank"
                                                            rel="noreferrer noopener"
                                                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm font-mono text-xs text-primary underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                                        >
                                                            <Icon name="github" className="size-3.5 shrink-0" />
                                                            {path}
                                                            <Icon
                                                                name="external-link"
                                                                className="size-3 shrink-0 text-muted-foreground"
                                                            />
                                                        </a>
                                                    </li>
                                                ))}
                                                {/* External data sources / upstream libraries (e.g. the
                                                    stopword lists), linked verbatim rather than into the repo. */}
                                                {m.references?.map((ref) => (
                                                    <li key={ref.url}>
                                                        <a
                                                            href={ref.url}
                                                            target="_blank"
                                                            rel="noreferrer noopener"
                                                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm font-mono text-xs text-primary underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                                        >
                                                            <Icon name="database" className="size-3.5 shrink-0" />
                                                            {ref.label}
                                                            <Icon
                                                                name="external-link"
                                                                className="size-3 shrink-0 text-muted-foreground"
                                                            />
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Where the metric appears (route patterns, not links). */}
                                        <div className="flex min-w-0 flex-col gap-1.5">
                                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                                                {c.labels.used_on}
                                            </span>
                                            <ul className="flex flex-col gap-1 overflow-x-auto">
                                                {m.routes.map((r) => (
                                                    <li
                                                        key={r}
                                                        className="whitespace-nowrap font-mono text-xs text-muted-foreground"
                                                    >
                                                        {r}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                );
            })}

            <footer className="flex flex-col items-start gap-2 border-t border-border pt-6">
                <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm text-primary underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    <Icon name="github" className="size-4 shrink-0" />
                    {c.repo_link}
                    <Icon name="external-link" className="size-3.5 shrink-0 text-muted-foreground" />
                </a>
            </footer>
        </div>
    );
}
