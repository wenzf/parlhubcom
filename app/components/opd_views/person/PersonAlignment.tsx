// PersonAlignment.tsx
//
// Voting-alignment feed for a member of parliament — the /people/:id/alignment
// dimension route. Ranks EVERY other member by how often they voted the SAME WAY
// as the subject, measured only over the ballots the two SHARED
// (`agreement = agreed / shared`; see person_alignment_by_id.sql). Two variants:
//   • "page"    — paginated, with search / min-shared filter / sort + CC-BY
//                 credit. Rendered BELOW <PersonBase />.
//   • "snippet" — the top rows plus a "view all" link back to the full feed.
//
// Each row is one co-voting NEIGHBOUR: their name (→ /people/:id), party/group,
// the agreement percentage (colour-coded: high = allies, low = opponents) with a
// bar, and the "agreed N of M shared" reliability tail. Thin wrapper over the
// shared <FeedShell> — the neighbours list IS the paginated `list`.
//
// All visible labels come from the `loc` map; the second arg to t() fills the
// `{token}` placeholders of a template (grammar stays here, JSON holds flat
// strings) — <FeedShell> takes its English fallbacks as separate `*Fallback` props.

import * as React from "react";
import { useParams } from "react-router";
import type { PersonClient, IdentityClient, BodyClient } from "@/types/opd_db";
import type {
    PaginatedList,
    AlignmentNeighbour,
} from "@/types/opd_paginated_client";
import { alignmentDescriptor } from "~/lib/dimensions/descriptors";
import { peopleHref } from "~/lib/urls/hrefs";

import { makeT, type TFunc, feedPath, InternalLink, MetaItem } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface PersonAlignmentProps {
    /** The subject person; `persons.id` drives the feed link. */
    persons: PersonClient;
    /** The page slice + filtered total of co-voting neighbours: `dat.neighbours`. */
    neighbours?: PaginatedList<AlignmentNeighbour> | undefined;
    /** Accepted for parity with the other person feeds; not rendered here. */
    identities?: IdentityClient[] | undefined;
    bodies?: BodyClient[] | undefined;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

/** Diverging agreement tone: allies (emerald) → mixed (amber) → opponents (rose).
 *  `text` colours the percentage, `bar` fills the meter. */
function agreementTone(a: number): { text: string; bar: string } {
    if (a >= 0.66)
        return { text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500" };
    if (a >= 0.5)
        return { text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500" };
    return { text: "text-rose-700 dark:text-rose-400", bar: "bg-rose-500" };
}

export function PersonAlignment({
    persons,
    neighbours,
    identities: _identities = [],
    bodies: _bodies = [],
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 10,
    offset = 0,
    pageParam = "offset",
    className,
}: PersonAlignmentProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const { lang } = useParams();
    const personId = persons.id;

    return (
        <FeedShell
            descriptor={alignmentDescriptor}
            feedHref={feedPath(personId, "alignment")}
            icon="scatter-chart"
            titleKey="section_alignment"
            titleFallback="Voting alignment"
            emptyKey="no_alignment"
            emptyFallback="No co-voting data yet."
            noResultsFallback="No members match your search."
            viewAllKey="view_all_alignment"
            viewAllFallback="View full alignment"
            list={neighbours ?? { total_count: 0, items: [] }}
            renderRow={(n) => (
                <AlignmentRow
                    key={n.id}
                    neighbour={n}
                    t={t}
                    href={peopleHref(lang, n.person_id)}
                />
            )}
            methodologyAnchor="co-voting"
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            className={className}
        />
    );
}

/* --------------------------------- a row ---------------------------------- */

function AlignmentRow({
    neighbour,
    t,
    href,
}: {
    neighbour: AlignmentNeighbour;
    t: TFunc;
    href: string;
}) {
    const name = neighbour.fullname ?? t("member_unknown");
    const party = neighbour.party ?? null;
    const group = neighbour.parliamentary_group ?? null;
    const pct = Math.round((neighbour.agreement ?? 0) * 100);
    const tone = agreementTone(neighbour.agreement ?? 0);

    return (
        <li className="grid grid-cols-[3.5rem_1fr] gap-x-4 py-3">
            {/* agreement — aligned, colour-coded, scannable down the column */}
            <div className="pt-0.5 text-right">
                <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>
                    {pct}%
                </span>
            </div>

            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    <InternalLink to={href}>{name}</InternalLink>
                    {party ? (
                        <span className="font-normal text-muted-foreground">{party}</span>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {group ? <MetaItem icon="users">{group}</MetaItem> : null}
                    <span>
                        {t("alignment_agreed_of_shared", {
                            agreed: neighbour.agreed,
                            shared: neighbour.shared,
                        })}
                    </span>
                </div>

                {/* agreement meter */}
                <div
                    className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${pct}%`}
                >
                    <div className={`h-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                </div>
            </div>
        </li>
    );
}

export default PersonAlignment;
