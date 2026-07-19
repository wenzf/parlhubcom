// routes/pages/project/project_index.tsx
//
// /project — the project section index (NS_PROJECT_INDEX). Standalone page under
// project_layout (brand wordmark, no data sidebar): a short landing that links to
// the three project pages — About, FAQ and the Data map. Link labels/descriptions
// come from loc_main.nav (already loaded by the lang layout, so no own loader);
// SEO copy comes from projectMeta.

import type { Route } from "./+types/project_index";
import { NavLink, useParams, useRouteLoaderData } from "react-router";
import { localizedPath, makeT } from "~/lib/lang";
import { PAGE_CONFIG } from "~/configs/site.config";
import type { PageNamespaces } from "@/types/site";
import { projectMeta } from "~/lib/seo/metas";

export const handle = PAGE_CONFIG.NS_PROJECT_INDEX.handle;

export function meta({ params, location, matches }: Route.MetaArgs) {
    return projectMeta({ lang: params.lang, path: location.pathname, matches, params });
}

// Each card: the loc_main.nav keys for its label + one-line description, plus the
// page namespace it links to.
const LINKS: { ns: PageNamespaces; labelKey: string; descKey: string }[] = [
    { ns: "NS_PROJECT_DATA_GUIDE", labelKey: "data_guide", descKey: "data_guide_desc" },
    { ns: "NS_PROJECT_DATA_MAP", labelKey: "data_map", descKey: "data_map_desc" },
    { ns: "NS_PROJECT_METHODOLOGY", labelKey: "methodology", descKey: "methodology_desc" },
    { ns: "NS_ABOUT", labelKey: "about", descKey: "about_desc" },
    { ns: "NS_FAQ", labelKey: "faq", descKey: "faq_desc" },
    { ns: "NS_SUSTAINABILITY", labelKey: "sustainability", descKey: "sustainability_desc" },
    { ns: "NS_ACCESSIBILITY", labelKey: "accessibility", descKey: "accessibility_desc" },
    { ns: "NS_IMPRINT", labelKey: "imprint", descKey: "imprint_desc" },
];

export default function ProjectIndexPage() {
    const { lang } = useParams();
    const langLayoutData = useRouteLoaderData("routes/layouts/lang_layout") as
        | { locs?: { nav?: Record<string, string> } }
        | undefined;
    const tNav = makeT(langLayoutData?.locs?.nav);

    return (
        <article className="mx-auto flex w-full max-w-prose flex-col gap-8 p-4 pt-2">
            <header className="flex flex-col gap-4">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {tNav("project")}
                </h1>
            </header>

            <nav aria-label={tNav("project")} className="flex flex-col gap-3">
                {LINKS.map(({ ns, labelKey, descKey }) => (
                    <NavLink
                        key={ns}
                        to={localizedPath(lang, ns)}
                        viewTransition
                        className="group flex min-h-11 flex-col justify-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-4 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
