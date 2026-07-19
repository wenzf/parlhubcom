// /app/lib/seo/jsonld/breadcrumbs.ts
//
// BreadcrumbList → ListItem graph node for a page's head JSON-LD. Replaces the
// visible-DOM microdata that used to live in `blocks/breadcrumbs/index.tsx`; the
// crumb trail itself is resolved once by the shared `resolveBreadcrumbs`, so the
// head node and the on-screen breadcrumbs never diverge.

import type { SiteUIMatch } from "@/types/site";
import { resolveBreadcrumbs } from "~/lib/seo/breadcrumbs";
// Leaf import (not the metas barrel) so jsonld → metas stays acyclic: core.ts
// pulls in no jsonld module.
import { absoluteUrl } from "~/lib/seo/metas/core";

/**
 * Build the page's `BreadcrumbList` node (0 or 1) for the `@graph`. `item` is the
 * absolute URL of each crumb; crumbs whose label hasn't resolved (loader data
 * absent) are dropped and the remaining ones are re-numbered so `position` stays
 * a gapless 1..n. Returns `[]` when the page has no breadcrumb config or no
 * resolvable crumbs — `jsonLdTag` then emits nothing.
 */
export function breadcrumbListJsonLd(
    matches: unknown[] | undefined,
    params: Record<string, string | undefined> | undefined,
): object[] {
    if (!matches?.length) return [];

    const crumbs = resolveBreadcrumbs(matches as SiteUIMatch[], params ?? {}).filter(
        (c) => typeof c.label === "string" && c.label.trim() !== "",
    );
    if (!crumbs.length) return [];

    return [
        {
            "@type": "BreadcrumbList",
            itemListElement: crumbs.map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: c.label,
                item: absoluteUrl(c.path),
            })),
        },
    ];
}
