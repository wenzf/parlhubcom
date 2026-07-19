// EntityNotFound.tsx
//
// The in-dashboard "record not found" panel for the by-id detail pages
// (/people/:id, /docs/:id, …). Rendered INSIDE the data-dashboard chrome —
// either directly by a detail route / result layout when the by-id lookup
// came back empty, or by a result layout's ErrorBoundary catching the
// loader's thrown 404 — so the sidebar and breadcrumbs stay usable, unlike
// the root <NotFound /> page (blocks/not-found.tsx) which owns unmatched
// URLs outside the loc chrome.
//
// Copy comes from `pages.person.labels` (loc_data_dashboard) via the usual
// `t()`; the EN_FALLBACK map only covers the edge where the layout loc has
// not arrived (e.g. an error boundary rendering before hydration data).

import { isRouteErrorResponse, useParams, useRouteLoaderData } from "react-router";
import { localizedPath, makeT } from "~/lib/lang";
import type { PageNamespaces } from "@/types/site";
import { InternalLink } from "~/components/opd_views/opd_micros";

export type NotFoundEntity =
    | "person"
    | "body"
    | "affair"
    | "group"
    | "voting"
    | "meeting"
    | "interest"
    | "organization"
    | "text"
    | "doc"
    | "speech";

/** Which catalogue index the back link points at, per entity. */
const BACK_NS: Record<NotFoundEntity, PageNamespaces> = {
    person: "NS_PEOPLE_INDEX",
    body: "NS_BODIES_INDEX",
    affair: "NS_AFFAIRS_INDEX",
    group: "NS_GROUPS_INDEX",
    voting: "NS_VOTINGS_INDEX",
    meeting: "NS_MEETINGS_INDEX",
    interest: "NS_INTERESTS_INDEX",
    organization: "NS_ORGANIZATIONS_INDEX",
    text: "NS_TEXTS_INDEX",
    doc: "NS_DOCS_INDEX",
    speech: "NS_SPEECHES_INDEX",
};

const EN_FALLBACK: Record<string, string> = {
    not_found_person: "Person not found",
    not_found_body: "Parliament not found",
    not_found_affair: "Affair not found",
    not_found_group: "Committee or group not found",
    not_found_voting: "Voting not found",
    not_found_meeting: "Meeting not found",
    not_found_interest: "Interest not found",
    not_found_organization: "Organization not found",
    not_found_text: "Text not found",
    not_found_doc: "Document not found",
    not_found_speech: "Speech not found",
    not_found_hint:
        "There is no entry with the ID {id}. It may have been removed, or the link may be outdated.",
    not_found_back: "Back to the overview",
};

/** Route `ErrorBoundary` for the result layouts whose loaders `throw` a 404 on
 *  an unknown :id (affairs, groups, meetings, interests): renders the panel in
 *  place — the dashboard chrome above the erroring route stays up — and
 *  rethrows anything that isn't a 404 so it bubbles to the root boundary. */
export function makeEntityNotFoundBoundary(entity: NotFoundEntity) {
    return function EntityNotFoundBoundary({ error }: { error: unknown }) {
        const layoutRouteLoaderData = useRouteLoaderData(
            "routes/layouts/data_dashboard_layout",
        ) as
            | { locs?: { pages?: { person?: { labels?: Record<string, string> } } } }
            | undefined;
        if (isRouteErrorResponse(error) && error.status === 404) {
            return (
                <EntityNotFound
                    entity={entity}
                    loc={layoutRouteLoaderData?.locs?.pages?.person?.labels}
                />
            );
        }
        throw error;
    };
}

export default function EntityNotFound({
    entity,
    loc,
}: {
    entity: NotFoundEntity;
    loc?: Record<string, string> | undefined;
}) {
    const params = useParams();
    const t = makeT({ ...EN_FALLBACK, ...loc });
    const hint = t("not_found_hint").replace("{id}", params.id ?? "");

    return (
        <div className="inset_page_transition">
            <section
                aria-labelledby="entity-not-found-title"
                className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card p-6 text-center"
            >
                <h1
                    id="entity-not-found-title"
                    className="text-2xl font-semibold tracking-tight text-balance"
                >
                    {t(`not_found_${entity}`)}
                </h1>
                <p className="max-w-prose text-base text-muted-foreground text-balance">
                    {hint}
                </p>
                <InternalLink to={localizedPath(params.lang, BACK_NS[entity])}>
                    {t("not_found_back")}
                </InternalLink>
            </section>
        </div>
    );
}
