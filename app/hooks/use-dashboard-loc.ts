import { useParams, useRouteLoaderData } from "react-router";

/** The slice of the data-dashboard layout's loader data that its pages read.
 *  Structural rather than imported so this hook does not depend on the layout
 *  module (and so the route-id string below stays the only coupling). */
interface DashboardLayoutData {
    locs?: { pages?: { person?: { labels?: Record<string, string> } } };
    locale?: string;
}

/**
 * The UI labels + BCP-47 locale for any page under `data_dashboard_layout`.
 *
 * Every data page needs the same two values off the same layout loader, so this
 * is the single place that names the layout's route id and the shape of its
 * data — previously both stood retyped inline in ~40 route components, where a
 * layout rename would have silently degraded to `{}` and "de-CH" rather than
 * failing the build.
 *
 * `locale` falls back to the UI language when the layout has not supplied one
 * (`fr` → "fr-CH"), and only to "de-CH" when there is no language either — the
 * majority behaviour; a handful of pages had drifted to a bare "de-CH", which
 * would have formatted numbers and dates in German on a French page.
 */
export function useDashboardLoc(): { loc: Record<string, string>; locale: string } {
    const { lang } = useParams();
    const data = useRouteLoaderData("routes/layouts/data_dashboard_layout") as
        | DashboardLayoutData
        | undefined;

    return {
        loc: data?.locs?.pages?.person?.labels ?? {},
        locale: data?.locale ?? (lang ? `${lang}-CH` : "de-CH"),
    };
}
