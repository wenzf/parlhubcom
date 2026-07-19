// routes/pages/experiments/experiments_index.tsx
//
// /experiments — the experiments section index (NS_EXPERIMENTS_INDEX). Standalone
// page under experiments_layout (brand wordmark, no data sidebar): a short landing
// that links to the experimental showcases — currently just Wordfish. Link
// labels/descriptions come from loc_main.nav (loaded by the lang layout, so no own
// loader); SEO copy comes from experimentsMeta.

import type { Route } from "./+types/experiments_index";
import { NavLink, useParams, useRouteLoaderData } from "react-router";
import { localizedPath, makeT } from "~/lib/lang";
import { PAGE_CONFIG } from "~/configs/site.config";
import type { PageNamespaces } from "@/types/site";
import { experimentsMeta } from "~/lib/seo/metas";

export const handle = PAGE_CONFIG.NS_EXPERIMENTS_INDEX.handle;

export function meta({ params, location, matches }: Route.MetaArgs) {
    return experimentsMeta({ lang: params.lang, path: location.pathname, matches, params });
}

// Each card: the loc_main.nav keys for its label + one-line description, plus the
// page namespace it links to. More experiments land here over time.
const LINKS: { ns: PageNamespaces; labelKey: string; descKey: string }[] = [
    { ns: "NS_EXPERIMENTS_WORDFISH", labelKey: "wordfish", descKey: "wordfish_desc" },
];

export default function ExperimentsIndexPage() {
    const { lang } = useParams();
    const langLayoutData = useRouteLoaderData("routes/layouts/lang_layout") as
        | { locs?: { nav?: Record<string, string> } }
        | undefined;
    const tNav = makeT(langLayoutData?.locs?.nav);

    return (
        <article className="mx-auto flex w-full max-w-prose flex-col gap-8 p-4 pt-2">
            <header className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {tNav("experiments")}
                </h1>
                <p className="text-base text-muted-foreground">{tNav("experiments_desc")}</p>
            </header>

            <nav aria-label={tNav("experiments")} className="flex flex-col gap-3">
                {LINKS.map(({ ns, labelKey, descKey }) => (
                    <NavLink
                        key={ns}
                        to={localizedPath(lang, ns)}
                        viewTransition
                        className="group flex min-h-11 flex-col justify-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-4 outline-none transition-colors hover:border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <span className="text-lg font-medium tracking-tight text-foreground underline decoration-transparent underline-offset-4 group-hover:decoration-current">
                            {tNav(labelKey)}
                        </span>
                        <span className="text-base text-muted-foreground">{tNav(descKey)}</span>
                    </NavLink>
                ))}
            </nav>
        </article>
    );
}
