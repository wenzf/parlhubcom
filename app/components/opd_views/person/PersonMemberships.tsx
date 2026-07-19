// PersonMemberships.tsx
//
// Memberships list for a political actor — the groups (commissions, factions,
// committees, delegations …) the person belongs or belonged to, and the role
// they hold in each. Two variants:
//   • "page"    — the /people/:id/memberships dimension route: paginated, with a
//                 CC BY 4.0 data credit. Rendered BELOW <PersonBase />.
//   • "snippet" — embedded on the overview route: shows the rows the loader
//                 passed (no pager) plus a link to the full feed.
// Like <PersonVotes />, it owns only its own panel and never re-emits identity
// properties, so nothing is declared twice on the page.
//
// Domain: a `memberships` row ties the person to ONE group for a period:
//   • group_id / group_name — the group joined (group_name is denormalized on
//                  the row; the response-scoped `groups` lookup carries the full
//                  record: the group's own type, abbreviation, span, official url).
//   • role_name / type_harmonized / type_external — the capacity held. role_name
//                  is the finest localized label (member, president, vice-president
//                  …); type_harmonized is the normalized key; type_external the
//                  source string. These describe the ROLE, not the group's kind.
//   • begin_date / end_date — the period held (epoch millis); active — currently held.
//
// The group connection (the special case): a person can hold SEVERAL memberships
// in the SAME group over time — e.g. "member" 2015–2019, then "president" from
// 2019. The query COLLECTS these into one block per group across the person's
// WHOLE history and paginates BY GROUP (total_count is the distinct-group count),
// so each `membership_groups` item already carries its complete role timeline and
// a group is never split across a page boundary. This panel renders the blocks as
// given: the group once as the headline (linked to /groups/:id, with its
// group-type chip), its roles nested beneath as a small reverse-chronological
// timeline (role · period · current badge). Rows with no group_id arrive as their
// own single-role blocks (there is no group to collect them under).
//
// This panel carries no structured data of its own — the person page's graph is
// emitted as head JSON-LD by the route meta() (metas/person.ts). The blocks stay
// purely presentational.
//
// Conventions:
//   • Reverse-chronological: blocks by their most recent role's begin_date
//     (newest first), roles within a block likewise — ordered by the query and
//     re-sorted defensively here. Matches ORDER BY begin_date DESC NULLS LAST.
//   • Dates are epoch-millis numbers → formatEpoch (explicit tz, no SSR drift).
//     Open-ended spans (a start but no end) format without a bare dash.
//   • Blocks can span bodies (national + cantonal), so every block shows its own
//     body label via bodyLabel(body_key, …).
//   • Pagination ("page") is driven by a URL search param so it is SSR-friendly
//     and linkable; total_count is the unpaginated GROUP count, items is the slice.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import { localizedPath } from "~/lib/lang";
import type {
    PersonClient,
    IdentityClient,
    BodyClient,
    GroupClient,
    MembershipClient,
} from "@/types/opd_db";
import type {
    PaginatedList,
    MembershipGroupClient,
} from "@/types/opd_paginated_client";
import {
    buildBodyLookup,
    bodyLabel,
    formatEpoch,
} from "~/lib/domain/person";
import {
    membershipsDescriptor,
    withBodyOptions,
    withCodeOptions,
} from "~/lib/dimensions/descriptors";

import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, feedPath, formatPeriod, InternalLink, Chip } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface PersonMembershipsProps {
    /** The person record. `persons.id` is the canonical (primary) id and drives
     *  the feed link. */
    persons: PersonClient;
    /** The page slice + unpaginated GROUP count: `dat.membership_groups`. Each item
     *  is one group with its full role timeline (the query paginates by group). */
    membershipGroups: PaginatedList<MembershipGroupClient>;
    /** Sibling identities grouped under the person (accepted for parity with the
     *  other dimension components; not rendered here). */
    identities?: IdentityClient[];
    /** Bodies referenced by the rows, for per-group body labels. */
    bodies?: BodyClient[];
    /** Response-scoped lookup for enrichment: the distinct group records behind the
     *  group blocks on this page (groups.id = the page's group_ids). Carries the
     *  group's own type, abbreviation, span and official url. */
    groups?: GroupClient[];
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    /**
     * "page"    — full dimension route: pagination + data credit (default).
     * "snippet" — embedded on the overview: no pager, just the rows the loader
     *             passed plus a link to the full /people/:id/memberships feed.
     */
    variant?: "page" | "snippet";
    /** Page size ($7) and page start ($8), echoed from the loader. ("page" only.) */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. ("page" only.) */
    pageParam?: string;
    className?: string;
}

/* ------------------------------- render model ----------------------------- */

/** A render-ready group block: the query's group block (group_id + group_name +
 *  roles) joined to its full GroupClient record (from the response-scoped
 *  `groups`), with the roles re-sorted newest-first defensively and a sort key. */
interface RenderBlock {
    /** Stable React key: the group_id, or a per-first-role fallback for group-less. */
    key: string;
    /** The resolved group record, or null when there is no group_id / no match. */
    group: GroupClient | null;
    /** The group's display name (group record → the block's denormalized name). */
    name: string | null;
    /** Internal /groups/:id route, or null when there is no group_id to link. */
    href: string | null;
    /** The group's roles, newest first. */
    roles: MembershipClient[];
    /** Most recent begin_date across the roles — the block's sort key. */
    latestBegin: number | null;
}

/* -------------------------------- component ------------------------------- */

export function PersonMemberships({
    persons,
    membershipGroups,
    identities: _identities = [],
    bodies = [],
    groups = [],
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 5,
    offset = 0,
    pageParam = "offset",
    className,
}: PersonMembershipsProps) {
    const params = useParams();
    const t = React.useMemo(() => makeT(loc), [loc]);
    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);

    const groupById = React.useMemo(
        () => new Map(groups.map((g) => [g.id, g])),
        [groups],
    );

    const personId = persons.id;

    // Flatten the page's roles (across all group blocks) for the runtime `type`
    // facet options. withCodeOptions keys off the bare `type_harmonized_code` the SQL
    // emits on each role; the label is the localized `type_harmonized`.
    const allRoles = React.useMemo(
        () => (membershipGroups.items ?? []).flatMap((g) => g.roles ?? []),
        [membershipGroups.items],
    );

    // Descriptor with both runtime-injected selects filled: type from the loaded
    // roles' harmonized codes, body from the response `bodies`.
    const descriptor = React.useMemo(
        () =>
            withBodyOptions(
                withCodeOptions(
                    membershipsDescriptor,
                    "type",
                    allRoles as unknown as Record<string, unknown>[],
                    "type_harmonized_code",
                    (r) => (r.type_harmonized as string) ?? String(r.type_harmonized_code ?? ""),
                ),
                bodies,
            ),
        [allRoles, bodies],
    );

    // The query already collapses memberships into one block per group across the
    // whole history and orders blocks + roles newest-first. Join each block to its
    // full group record (response-scoped `groups`) and re-sort roles defensively.
    const blocks = React.useMemo<RenderBlock[]>(() => {
        const beginOf = (m: MembershipClient): number | null => m.begin_date ?? null;
        const newestFirst = (a: MembershipClient, b: MembershipClient): number => {
            const da = beginOf(a);
            const db = beginOf(b);
            if (da !== db) {
                if (da == null) return 1;
                if (db == null) return -1;
                return db - da;
            }
            return (b.id ?? 0) - (a.id ?? 0);
        };

        const list: RenderBlock[] = (membershipGroups.items ?? []).map((blk, i) => {
            const group =
                blk.group_id != null ? groupById.get(blk.group_id) ?? null : null;
            const roles = [...(blk.roles ?? [])].sort(newestFirst);
            const latestBegin = roles.reduce<number | null>((acc, m) => {
                const b = beginOf(m);
                if (b == null) return acc;
                return acc == null || b > acc ? b : acc;
            }, null);
            return {
                key:
                    blk.group_id != null
                        ? `g:${blk.group_id}`
                        : `r:${roles[0]?.id ?? i}`,
                group,
                name: group?.name ?? group?.abbreviation ?? blk.group_name ?? null,
                href:
                    blk.group_id != null
                        ? localizedPath(params.lang, "NS_GROUPS_OVERVIEW", {
                            id: String(blk.group_id),
                        })
                        : null,
                roles,
                latestBegin,
            };
        });

        return list;
    }, [membershipGroups.items, groupById, params.lang]);

    // FeedShell iterates the raw `membershipGroups.items`; map each item back to its
    // precomputed render block (1:1, same order).
    const blockByItem = React.useMemo(
        () =>
            new Map(
                (membershipGroups.items ?? []).map((it, i) => [it, blocks[i]] as const),
            ),
        [membershipGroups.items, blocks],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            feedHref={feedPath(personId, "memberships")}
            icon="id-card"
            titleKey="section_memberships"
            titleFallback="Memberships"
            emptyKey="no_memberships"
            emptyFallback="No recorded memberships."
            noResultsFallback="No memberships match your search."
            viewAllKey="view_all_memberships"
            viewAllFallback="View all memberships"
            list={membershipGroups}
            renderRow={(blk) => {
                const block = blockByItem.get(blk);
                if (!block) return null;
                return (
                    <MembershipGroup
                        key={block.key}
                        block={block}
                        t={t}
                        locale={locale}
                        bodyLabelText={bodyLabel(
                            block.group?.body_key ?? block.roles[0]?.body_key,
                            bodyLookup,
                        )}
                    />
                );
            }}
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

/* ------------------------------- a group block ---------------------------- */

function MembershipGroup({
    block,
    t,
    locale,
    bodyLabelText,
}: {
    block: RenderBlock;
    t: (key: string) => string;
    locale: string;
    bodyLabelText: string | null;
}) {
    const { group, name, href, roles } = block;

    // Left chip: the GROUP's kind (commission / faction / committee …) — the most
    // scannable categorical fact at the block level. Neutral: group types carry no
    // yes/no semantics. Falls back to a generic label when the group is unresolved.
    const groupType =
        group?.type_external ?? group?.type_harmonized ?? null;
    const chipLabel = groupType ?? t("membership_type_fallback");

    const displayName = name ?? t("membership_untitled");
    const abbreviation =
        group?.abbreviation && group.abbreviation !== name
            ? group.abbreviation
            : null;
    const groupUrl = group?.url_external ?? null;
    const groupSpan = formatPeriod(
        group?.begin_date,
        group?.end_date,
        locale,
        t,
        "membership",
    );

    const hasMeta = !!(bodyLabelText || groupSpan || groupUrl);

    return (
        <li className="grid grid-cols-1 gap-y-1.5 py-3 sm:grid-cols-[7rem_1fr] sm:gap-x-4 sm:gap-y-0">
            {/* group type — aligned, scannable down the column (sm+). Block (not
          inline-flex) so the text wraps inside the fixed 7rem chip; long German type
          words break and hyphenate (per locale) instead of spilling over the badge. */}
            <div className="justify-self-start sm:justify-self-stretch sm:pt-0.5">
                <Chip>
                    {chipLabel}
                </Chip>
            </div>

            {/* the group + the roles held in it */}
            <div className="min-w-0 space-y-1.5">
                {/* headline: the group (internal link when we have an id) */}
                <div className="flex flex-wrap items-start gap-x-1.5 gap-y-0.5 text-sm font-medium leading-snug">
                    <Icon name="users" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    {href ? (
                        <InternalLink to={href}>
                            <span>{displayName}</span>
                        </InternalLink>
                    ) : (
                        <span>{displayName}</span>
                    )}
                    {abbreviation ? (
                        <span className="font-normal text-muted-foreground">
                            ({abbreviation})
                        </span>
                    ) : null}
                </div>

                {/* meta: body · the group's own active span · official record */}
                {hasMeta ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {bodyLabelText ? (
                            <MetaItem icon="landmark">{bodyLabelText}</MetaItem>
                        ) : null}
                        {groupSpan ? (
                            <MetaItem icon="calendar-range">{groupSpan}</MetaItem>
                        ) : null}
                        {groupUrl ? (
                            <a
                                href={groupUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                {t("membership_source")}
                                <Icon name="external-link" className="size-3 shrink-0" />
                            </a>
                        ) : null}
                    </div>
                ) : null}

                {/* the role(s) held in this group, newest first. A single role renders
            inline; several stack as a small timeline so a member→president
            progression in the SAME group reads as one history, not duplicates. */}
                <ul className="mt-1 space-y-1">
                    {roles.map((m) => (
                        <RoleLine key={m.id} membership={m} t={t} locale={locale} />
                    ))}
                </ul>
            </div>
        </li>
    );
}

/** One role held within the group: the role label, its period, and a "current"
 *  badge when the membership is still active. Visible text only — no structured
 *  data (roles could be promoted to OrganizationRole in JSON-LD later). */
function RoleLine({
    membership,
    t,
    locale,
}: {
    membership: MembershipClient;
    t: (key: string) => string;
    locale: string;
}) {
    const role =
        membership.role_name ??
        membership.type_harmonized ??
        membership.type_external ??
        t("membership_role_fallback");
    const period = formatPeriod(
        membership.begin_date,
        membership.end_date,
        locale,
        t,
        "membership",
    );
    const current = isCurrent(membership);

    return (
        <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="text-foreground">{role}</span>
            {period ? (
                <span className="text-xs text-muted-foreground">{period}</span>
            ) : null}
            {current ? (
                <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[0.7rem] font-normal"
                >
                    {t("membership_current")}
                </Badge>
            ) : null}
        </li>
    );
}

/* -------------------------------- helpers --------------------------------- */

/** Is this membership currently held? Prefers the explicit `active` flag; when
 *  it is absent, an open-ended span (a begin but no end) is treated as ongoing. */
function isCurrent(m: MembershipClient): boolean {
    if (m.active === true) return true;
    if (m.active === false) return false;
    return m.begin_date != null && m.end_date == null;
}

export default PersonMemberships;