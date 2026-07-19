import type { SiteUIMatch } from "@/types/site";
import { useMatches, useParams } from "react-router";
import { resolveBreadcrumbs, type Breadcrumb } from "~/lib/seo/breadcrumbs";


/** Live crumb trail for the current route tree (see `resolveBreadcrumbs`). */
export const useBreadcrumbsByHandle = (): Breadcrumb[] => {
    const matches = useMatches() as SiteUIMatch[];
    const params = useParams();
    return resolveBreadcrumbs(matches, params);
}
