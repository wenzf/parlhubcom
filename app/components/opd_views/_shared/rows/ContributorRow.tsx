// _shared/rows/ContributorRow.tsx
//
// One contributor/participation row, shared by the affair-contributors and
// group-contributions feeds. Presentational + href-driven: the caller resolves
// `personHref` (the contributor's /people/:id page) and `affairHref` (the parent
// affair) so this row carries no routing / namespace knowledge. The optional
// `body` / `affair` lookups + `affairHref` drive an extra meta line; when none
// are passed (the affair-contributors usage) that block simply doesn't render,
// reproducing the original affair row exactly.
//
// Extracted from the superset ContributorRow in GroupContributions (the
// AffairContributors copy is the same component with the extra props omitted).

import type { ContributorClient, BodyClient, AffairClient } from "@/types/opd_db";

import { NavLink } from "react-router";
import { Badge } from "@/components/ui/badge";
import { InternalLink, MetaItem, bodyName as getBodyName, type TFunc } from "../../../opd_views/opd_micros";

export interface ContributorRowProps {
    contributor: ContributorClient;
    t: TFunc;
    /** Body lookup (b.id = row.body_id) — renders a landmark meta item. */
    body?: BodyClient | undefined;
    /** Affair lookup (a.id = row.affair_id) — supplies the affair link label. */
    affair?: AffairClient | undefined;
    /** Link to the parent affair; drives the affair meta item when present. */
    affairHref?: string | null;
    /** Link to the contributor's /people/:id page. */
    personHref?: string | null;
}

export function ContributorRow({
    contributor,
    t,
    body,
    affair,
    affairHref,
    personHref,
}: ContributorRowProps) {
    const joined = [contributor.firstname, contributor.lastname]
        .filter(Boolean)
        .join(" ");
    const name = contributor.fullname ?? (joined || contributor.lastname || null);
    const role = contributor.role_harmonized ?? contributor.role ?? null;
    const party = contributor.party_harmonized ?? contributor.party ?? null;
    const bodyName = getBodyName(body, body?.body_key);
    // The affair link is driven by affair_id (always on the row), NOT by whether
    // the affair lookup hydrated a title — so every contribution with an affair_id
    // links to /affairs/:id. The looked-up title is used as the label when present.
    const affairLabel =
        affair?.title ??
        affair?.title_long ??
        affair?.number ??
        (contributor.affair_id != null
            ? `${t("affair_untitled")} #${contributor.affair_id}`
            : null);

    return (
        <li className="py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-snug">
                {name ? (
                    personHref ? (
                        <InternalLink to={personHref}>
                            <span>{name}</span>
                        </InternalLink>
                    ) : (
                        <span className="font-medium">{name}</span>
                    )
                ) : (
                    <span className="font-medium text-muted-foreground">
                        {t("contrib_role_unknown")}
                    </span>
                )}
                {role ? (
                    <Badge variant="secondary" className="font-normal">
                        {role}
                    </Badge>
                ) : null}
                {party ? <MetaItem icon="users">{party}</MetaItem> : null}
            </div>
            {affairHref || bodyName ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {affairHref ? (
                        <MetaItem icon="file-text">
                            <NavLink
                                viewTransition
                                to={affairHref}
                                preventScrollReset
                                className="text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                {affairLabel}
                            </NavLink>
                        </MetaItem>
                    ) : null}
                    {bodyName ? <MetaItem icon="landmark">{bodyName}</MetaItem> : null}
                </div>
            ) : null}
        </li>
    );
}

export default ContributorRow;