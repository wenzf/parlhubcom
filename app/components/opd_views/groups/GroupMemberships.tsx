// GroupMemberships.tsx
//
// The memberships of ONE group — the /groups/:id/memberships feed. Each row is a
// membership (a person holding a role in this group over a period): person, role,
// type, span, and the member's body (via the response-scoped `bodies` lookup).
// The membership links to /memberships/:id (no dedicated namespace yet → a
// lang-prefixed literal path), and the person links to /people/:id. Mirrors
// <GroupContributions />.
//
// Variants:
//   "page"    — full feed route: controls + pager + data credit (default).
//   "snippet" — embedded on the group overview: rows + a "view all" link.

import * as React from "react";
import { useParams } from "react-router";
import type { MembershipClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { groupMembershipsDescriptor } from "~/lib/dimensions/descriptors";
import { localizedPath } from "~/lib/lang";

import { Badge } from "@/components/ui/badge";

import { InternalLink, makeT, MetaItem, formatPeriod, bodyName as getBodyName } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface GroupMembershipsProps {
    /** The filtered page slice + filtered total: `dat.memberships`. */
    memberships: PaginatedList<MembershipClient>;
    /** Response-scoped body lookup (`dat.bodies.items`), keyed by id. */
    bodies?: BodyClient[] | undefined;
    loc?: Record<string, string> | undefined;
    locale?: string;
    variant?: "page" | "snippet";
    /** The group id — drives the "view all" feed link in the snippet variant. */
    groupId?: number;
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

export function GroupMemberships({
    memberships,
    bodies,
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: GroupMembershipsProps) {
    const params = useParams();
    const t = React.useMemo(() => makeT(loc), [loc]);

    const bodyById = React.useMemo(() => {
        const m = new Map<number, BodyClient>();
        for (const b of bodies ?? []) m.set(b.id, b);
        return m;
    }, [bodies]);

    return (
        <FeedShell
            descriptor={groupMembershipsDescriptor}
            feedNs="NS_GROUPS_MEMBERSHIPS"
            icon="users-2"
            titleKey="section_memberships"
            titleFallback="Memberships"
            emptyKey="no_memberships"
            emptyFallback="No recorded memberships."
            noResultsFallback="No memberships match your search."
            viewAllKey="view_all_memberships"
            viewAllFallback="View all memberships"
            mcpNamespace="group"
            mcpSubject="this group's"
            list={memberships}
            loc={loc}
            locale={locale}
            variant={variant}
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            sourced
            className={className}
            renderRow={(m) => (
                <MembershipRow
                    key={m.id}
                    membership={m}
                    t={t}
                    locale={locale}
                    body={m.body_id != null ? bodyById.get(m.body_id) : undefined}
                    personHref={
                        m.person_id != null
                            ? localizedPath(params.lang, "NS_PEOPLE_OVERVIEW", {
                                id: String(m.person_id),
                            })
                            : null
                    }
                />
            )}
        />
    );
}

/* --------------------------------- a row ---------------------------------- */

function MembershipRow({
    membership,
    t,
    locale,
    body,
    personHref,
}: {
    membership: MembershipClient;
    t: (key: string) => string;
    locale: string;
    body?: BodyClient | undefined;
    personHref?: string | null;
}) {
    const name = membership.person_fullname ?? t("member_unknown");
    const role =
        membership.role_name ?? membership.type_harmonized ?? membership.type_external ?? null;
    const period = formatPeriod(
        membership.begin_date ?? null,
        membership.end_date ?? null,
        locale,
        t,
        "membership",
    );
    const bodyName = getBodyName(body, body?.body_key);

    return (
        <li className="py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-snug">
                {personHref ? (
                    <InternalLink to={personHref}>
                        <span>{name}</span>
                    </InternalLink>
                ) : (
                    <span className="font-medium">
                        {name}
                    </span>
                )}
                {role ? (
                    <Badge variant="secondary" className="font-normal">
                        {role}
                    </Badge>
                ) : null}
                {membership.active === false ? (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                        {t("facet_no")}
                    </Badge>
                ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {bodyName ? <MetaItem icon="landmark">{bodyName}</MetaItem> : null}
                {period ? <MetaItem icon="calendar-range">{period}</MetaItem> : null}
            </div>
        </li>
    );
}

export default GroupMemberships;
