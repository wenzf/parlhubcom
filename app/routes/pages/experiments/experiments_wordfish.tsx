// routes/pages/experiments/experiments_wordfish.tsx
//
// /experiments/wordfish — the Wordfish write-up. The list of parliaments whose
// speech data is rich enough to render a chart comes first (each links to
// /parliaments/:id/discussion), followed by the methodology and references.
// Standalone page under experiments_layout. Methodology copy:
// /public/locales/<lang>/loc_experiments.json. The case list is computed from the
// DB (getWordfishCases); SEO copy in metas/experiments.ts.

import type { Route } from "./+types/experiments_wordfish";
import { useLoaderData, useParams } from "react-router";
import { langByParam, localizedPath } from "~/lib/lang";
import { PAGE_CONFIG } from "~/configs/site.config";
import { getStaticData } from "~/server/static/get_static_data.server";
import { getWordfishCases, type WordfishCase } from "~/server/experiments_data.server";
import { InternalLink, INTERNAL_LINK_CLASS } from "~/components/opd_views/opd_micros";
import { Icon } from "~/components/icons/opd_icons";
import { wordfishMeta } from "~/lib/seo/metas";

export const handle = PAGE_CONFIG.NS_EXPERIMENTS_WORDFISH.handle;

export function meta({ params, location, matches }: Route.MetaArgs) {
    return wordfishMeta({ lang: params.lang, path: location.pathname, matches, params });
}

interface WordfishContent {
    title: string;
    lede: string;
    sections: { heading: string; paragraphs: string[] }[];
    cases_heading: string;
    cases_lede: string;
    col_parliament: string;
    col_members: string;
    col_period: string;
    cases_empty: string;
    references_heading: string;
    references: { text: string; url: string }[];
}

export async function loader({ params }: Route.LoaderArgs) {
    const { lang_code } = langByParam(params.lang);
    const [locs, cases] = await Promise.all([
        getStaticData(["loc_experiments"], lang_code),
        getWordfishCases(lang_code),
    ]);
    return Response.json({ locs, cases });
}

/** "2003–2026", or a single year when the span is within one. */
function period(c: WordfishCase): string {
    const a = c.data_from?.slice(0, 4);
    const b = c.data_to?.slice(0, 4);
    if (!a && !b) return "—";
    if (!a || !b || a === b) return a ?? b ?? "—";
    return `${a}–${b}`;
}

export default function WordfishPage() {
    const { locs, cases } = useLoaderData() as unknown as {
        locs: { experiments: WordfishContent };
        cases: WordfishCase[];
    };
    const c = locs.experiments;
    const { lang } = useParams();
    const nf = new Intl.NumberFormat(lang ? `${lang}-CH` : "de-CH");

    return (
        <article className="mx-auto flex w-full max-w-prose flex-col gap-8 p-4 pt-2">
            <header className="flex flex-col gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {c.title}
                </h1>
                <p className="text-base text-muted-foreground">{c.lede}</p>
            </header>

            {/* ---- the parliaments you can actually explore (up top) ---- */}
            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium tracking-tight text-foreground">
                    {c.cases_heading}
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground">{c.cases_lede}</p>

                {cases.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{c.cases_empty}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <th className="px-2 py-2 font-medium">{c.col_parliament}</th>
                                    <th className="px-2 py-2 text-right font-medium">{c.col_members}</th>
                                    <th className="px-2 py-2 text-right font-medium">{c.col_period}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cases.map((cs) => (
                                    <tr
                                        key={cs.id}
                                        className="border-b border-border/50 last:border-0"
                                    >
                                        <td className="px-2 py-1.5">
                                            <InternalLink
                                                to={localizedPath(lang, "NS_BODIES_DISCUSSION", {
                                                    id: String(cs.id),
                                                })}
                                            >
                                                {cs.name}
                                            </InternalLink>
                                            {cs.type_name && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    {cs.type_name}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">
                                            {nf.format(cs.members)}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                            {period(cs)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ---- methodology ---- */}
            {c.sections.map((s) => (
                <section key={s.heading} className="flex flex-col gap-3">
                    <h2 className="text-lg font-medium tracking-tight text-foreground">
                        {s.heading}
                    </h2>
                    {s.paragraphs.map((p, i) => (
                        <p key={i} className="text-base leading-relaxed text-muted-foreground">
                            {p}
                        </p>
                    ))}
                </section>
            ))}

            {/* ---- references / further reading ---- */}
            <section className="flex flex-col gap-3">
                <h2 className="text-lg font-medium tracking-tight text-foreground">
                    {c.references_heading}
                </h2>
                <ul className="flex flex-col gap-2">
                    {c.references.map((r) => (
                        <li key={r.url} className="text-base leading-relaxed text-muted-foreground">
                            <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={INTERNAL_LINK_CLASS}
                            >
                                {r.text}
                            </a>
                            <Icon
                                name="external-link"
                                className="ml-1 inline size-3 align-baseline text-muted-foreground"
                            />
                        </li>
                    ))}
                </ul>
            </section>
        </article>
    );
}
