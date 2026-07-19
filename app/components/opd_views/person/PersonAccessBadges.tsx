// PersonAccessBadges.tsx
//
// Access-badge (lobby) list for a member of parliament. Two variants:
//   • "page"    — the /people/:id/lobby dimension route: paginated, with a
//                 CC BY 4.0 data credit, AND search / filter / sort controls
//                 (server-side, over the whole set). Rendered BELOW <PersonBase />.
//   • "snippet" — embedded on the overview route: shows the rows the loader
//                 passed (no pager, no controls) plus a link to the full feed.
// Like <PersonVotes />, it owns only its own panel and never re-emits identity
// properties, so nothing is declared twice on the page.
//
// Search / filter / sort (page variant):
//   The controls (<DimensionControls />) and the agent tools (<DimensionMcpTools />)
//   are both driven by the shared `accessBadgesDescriptor` and the URL. The loader
//   applies the same criteria in SQL (person_access_badges_by_id.sql), so
//   `access_badges` here is already the filtered, sorted page slice and
//   `total_count` is the filtered total — the component just renders the server's
//   order (no client re-sort) and drives the pager from total_count.
//
//   The `type` facet filters on the stable `type_harmonized` code; its options are
//   injected at runtime from the loaded badges (withTypeOptions), because the full
//   code vocabulary is not known a priori — only "lobbyist" is documented. The
//   per-row chip and the facet option labels share one resolver, badgeTypeLabel():
//   surface "lobbyist" as a localized chip, otherwise show the localized `type`.
//
// Domain: in the Swiss Parliament each MP may grant two people access to the
// Parliament Building. Those guests are frequently lobbyists or sector
// representatives, which is why this dataset is the "lobby" dimension. On a
// person page the MP is always the GRANTOR (the query filters on person_id), and
// each row is a badge given to a guest:
//   • beneficiary_person_fullname — the guest who receives building access.
//   • beneficiary_group           — the organisation the guest is tied to.
//   • type / type_harmonized      — the guest's declared function/relationship
//                                   (type is localized; type_harmonized is the
//                                   normalized category, e.g. 'lobbyist').
//   • valid_from / valid_to       — the badge's validity window (epoch millis).
//
// schema.org: a badge grant has no clean schema.org type (unlike VoteAction),
// so this panel stays presentational rather than mis-model it. The wrapping
// Person scope (<PersonBase />) remains the page's mainEntity.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import type {
    PersonClient,
    IdentityClient,
    BodyClient,
    AccessBadgeClient,
} from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import {
    buildBodyLookup,
    bodyLabel,
} from "~/lib/domain/person";
import {
    accessBadgesDescriptor,
    withBodyOptions,
    withTypeOptions,
} from "~/lib/dimensions/descriptors";

import { makeT, MetaItem, feedPath, formatPeriod, Chip } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface PersonAccessBadgesProps {
    /** The person record. `persons.id` is the canonical (primary) id and drives
     *  the feed link. The page's person is the grantor of every badge below. */
    persons: PersonClient;
    /** The page slice + unpaginated count: `dat.access_badges`. */
    access_badges: PaginatedList<AccessBadgeClient>;
    /** Sibling identities grouped under the person (accepted for parity with the
     *  other dimension components; not rendered here). */
    identities?: IdentityClient[];
    /** Bodies referenced by the rows, for per-row body labels + the body facet. */
    bodies?: BodyClient[];
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    /**
     * "page"    — full dimension route: pagination + data credit + controls (default).
     * "snippet" — embedded on the overview: no pager, no controls, just the rows the
     *             loader passed plus a link to the full /people/:id/lobby feed.
     */
    variant?: "page" | "snippet";
    /** Page size ($7) and page start ($8), echoed from the loader. ("page" only.) */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. ("page" only.) */
    pageParam?: string;
    className?: string;

}

/* ------------------------------ type label -------------------------------- */

// Badge-type label resolver. The harmonized column is sparse: "lobbyist" is the
// one documented stable code, so we surface it as a localized chip; every other
// row is shown via its localized free-text `type` (falling back to the raw
// harmonized code, then a generic label). Shared by the row chip AND the `type`
// facet's option labels so the two never disagree.
function badgeTypeLabel(
    badge: { type_harmonized?: string | null; type?: string | null },
    t: (key: string) => string,
): string {
    if (badge.type_harmonized === "lobbyist") return t("badge_type_lobbyist");
    return badge.type ?? badge.type_harmonized ?? t("badge_type_fallback");
}

/* -------------------------------- component ------------------------------- */

export function PersonAccessBadges({
    persons,
    access_badges,
    identities: _identities = [],
    bodies = [],
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 5,
    offset = 0,
    pageParam = "offset",
    className,
}: PersonAccessBadgesProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);

    const personId = persons.id;

    // Trust the server's order (the SQL ORDER BY is driven by the same criteria).
    const items = React.useMemo(() => access_badges.items ?? [], [access_badges.items]);

    // Descriptor with both runtime-injected selects filled: body from the response
    // `bodies`, type from the loaded badges' harmonized codes (labelled via the
    // shared resolver). Like body, the type options reflect the loaded page slice.
    const descriptor = React.useMemo(
        () =>
            withTypeOptions(
                withBodyOptions(accessBadgesDescriptor, bodies),
                items,
                (b) => badgeTypeLabel(b, t),
            ),
        [bodies, items, t],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            feedHref={feedPath(personId, "lobby")}
            icon="building-2"
            titleKey="section_access_badges"
            titleFallback="Access badges"
            emptyKey="no_access_badges"
            emptyFallback="No access badges granted."
            noResultsFallback="No access badges match your search."
            viewAllKey="view_all_access_badges"
            viewAllFallback="View all access badges"
            list={access_badges}
            renderRow={(b) => (
                <BadgeRow
                    key={b.id}
                    badge={b}
                    t={t}
                    locale={locale}
                    bodyLabelText={bodyLabel(b.body_key, bodyLookup)}
                />
            )}
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

function BadgeRow({
    badge,
    t,
    locale,
    bodyLabelText,
}: {
    badge: AccessBadgeClient;
    t: (key: string) => string;
    locale: string;
    bodyLabelText: string | null;
}) {
    // Left column: the scannable category chip. The localized free-text `type` is
    // shown beside the guest only when it adds detail beyond the chip (i.e. for the
    // "lobbyist" case, where the chip is the harmonized label, not the type).
    const category = badgeTypeLabel(badge, t);
    const declaredFunction =
        badge.type && badge.type !== category ? badge.type : null;

    const guest =
        badge.beneficiary_person_fullname ?? t("badge_guest_unknown");
    const organisation = badge.beneficiary_group ?? null;

    const validity = formatPeriod(
        badge.valid_from,
        badge.valid_to,
        locale,
        t,
        "badge",
    );

    return (
        <li className="grid grid-cols-1 gap-y-1.5 py-3 sm:grid-cols-[7rem_1fr] sm:gap-x-4 sm:gap-y-0">
            {/* category — aligned, scannable down the column */}
            <div className="justify-self-start sm:justify-self-stretch sm:pt-0.5">
                <Chip>
                    {category}
                </Chip>
            </div>

            {/* the guest + context */}
            <div className="min-w-0 space-y-1">
                {/* headline: the guest who holds the badge. Plain text by default —
            guests are not generally MPs with /people/:id pages. Swap in
            <InternalLink to={`/people/${badge.beneficiary_person_id}`}> if they
            do resolve to profiles. */}
                <div className="flex items-start gap-1.5 text-sm font-medium leading-snug">
                    <Icon name="user-round" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>{guest}</span>
                    {declaredFunction ? (
                        <span className="font-normal text-muted-foreground">
                            {" · "}
                            {declaredFunction}
                        </span>
                    ) : null}
                </div>

                {/* meta: validity range · granting body */}
                {validity || bodyLabelText ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {validity ? (
                            <MetaItem icon="calendar-range">{validity}</MetaItem>
                        ) : null}
                        {bodyLabelText ? (
                            <MetaItem icon="landmark">{bodyLabelText}</MetaItem>
                        ) : null}
                    </div>
                ) : null}

                {/* context: the guest's organisation */}
                {organisation ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <MetaItem icon="building-2">{organisation}</MetaItem>
                    </div>
                ) : null}
            </div>
        </li>
    );
}

/* -------------------------------- helpers --------------------------------- */

export default PersonAccessBadges;