// /app/lib/seo/breadcrumbs.ts
//
// Pure breadcrumb resolver — the single source of the page's crumb trail, shared
// by the visible-DOM hook (`use-breadcrumbs-by-handle`) and the head JSON-LD
// builder (`jsonld/breadcrumbs`). It reads the deepest matched route's `handle`
// breadcrumb config, resolves each label from the matched loader data
// (`extractDataFromConfig`) and each path via `localizedPath` — no React, no
// hooks, so it runs identically in a component render and in a route `meta()`.

import type { SiteUIMatch } from "@/types/site";
import { extractDataFromConfig } from "~/lib/std/config_data";
import { localizedPath } from "~/lib/lang";

export type Breadcrumb = {
    /** 1-based position in the trail. */
    pos: number;
    /** Display label (may be empty when the source data isn't loaded yet). */
    label: string;
    /** Localized pathname, e.g. `/de/people/1`. */
    path: string;
    /** True for the current (leaf) crumb. */
    is_last: boolean;
};

/**
 * Resolve the crumb trail for the current match tree. Uses the deepest matched
 * route carrying a `handle.breadcrumbs` config; returns `[]` when none does.
 * `matches`/`params` come from `useMatches()`/`useParams()` in a component, or
 * from `Route.MetaArgs` (`matches`/`params`) in a `meta()` — both share the
 * `{ handle, loaderData, params }` shape this reads.
 */
export function resolveBreadcrumbs(
    matches: SiteUIMatch[],
    params: Record<string, string | undefined> = {},
): Breadcrumb[] {
    const match = [...matches].reverse().find((h) => h.handle);
    const breadcrumbsConfig = match?.handle?.breadcrumbs;
    const le = breadcrumbsConfig?.length;

    if (!le) return [];

    const out: Breadcrumb[] = [];
    for (let i = 0; i < le; i += 1) {
        const oneCrumb = breadcrumbsConfig[i];
        out.push({
            pos: i + 1,
            label: extractDataFromConfig(matches, oneCrumb.label) as string,
            path: localizedPath(params.lang, oneCrumb?.path, params),
            is_last: i + 1 === le,
        });
    }

    return out;
}
