// PersonContributions.tsx
//
// Contributions list for a member of parliament — the parliamentary business
// the person took part in, and the role they played. Two variants:
//   • "page"    — the /people/:id/contributions dimension route: paginated,
//                 with a CC BY 4.0 data credit. Rendered BELOW <PersonBase />.
//   • "snippet" — embedded on the overview route: shows the rows the loader
//                 passed (no pager) plus a link to the full feed.
// Like <PersonVotes />, it owns only its own panel and never re-emits identity
// properties, so nothing is declared twice on the page.
//
// Domain: a "contributor" row is a junction record — it ties the person to one
// piece of business in a given role:
//   • role / role_harmonized — the person's role (author, co-signatory,
//                              spokesperson …). role is localized; role_harmonized
//                              is the normalized key.
//   • affair_id / meeting_id / group_id / session_id / news_id — the target the
//                              person contributed to (exactly one is the subject
//                              of the row; precedence affair → meeting → group →
//                              session → news).
//   • party / party_harmonized — the party the person held at the time.
//   • type                  — the contribution type (normalized category).
//
// Title enrichment: the contributors query is response-scoped — alongside the
// contributor rows it returns the distinct `affairs` and `groups` behind this
// page (affairs.id = affair_id, groups.id = group_id). So affair rows show the
// affair's title, number, type and processing state, and link to the official
// record; group rows show the group name and type. Meetings are NOT part of the
// response, so meeting targets link by type only (pass an optional `meetings`
// array to light up their titles too).
//
// This panel carries no structured data of its own — the person page's graph is
// emitted as head JSON-LD by the route meta() (metas/person.ts). The rows stay
// purely presentational.
//
// Conventions:
//   • Order follows the query (id DESC) — contributions carry no own date, so
//     newest-recorded first is the only stable axis.
//   • Rows can span bodies, so every row shows its own body label.
//   • Pagination ("page") is driven by a URL search param so it is SSR-friendly
//     and linkable; total_count is the unpaginated count, items is the slice.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import { affairHref, groupHref, meetingHref } from "~/lib/urls/hrefs";
import type {
    PersonClient,
    IdentityClient,
    BodyClient,
    AffairClient,
    GroupClient,
    MeetingClient,
    ContributorClient,
} from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { buildBodyLookup, bodyLabel } from "~/lib/domain/person";
import { contributorsDescriptor } from "~/lib/dimensions/descriptors";

import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, feedPath, formatPeriod, InternalLink, Chip } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { Icon, type IconName } from "../../icons/opd_icons";

export interface PersonContributionsProps {
    /** The person record. `persons.id` is the canonical (primary) id and drives
     *  the feed link. Every contribution below was made by this person. */
    persons: PersonClient;
    /** The page slice + unpaginated count: `dat.contributors`. */
    contributors: PaginatedList<ContributorClient>;
    /** Sibling identities grouped under the person (accepted for parity; not
     *  rendered here). */
    identities?: IdentityClient[];
    /** Bodies referenced by the rows, for per-row body labels. */
    bodies?: BodyClient[];
    /** Response-scoped lookups for title enrichment. `affairs` and `groups` are
     *  returned by the contributors query (the distinct affair_id / group_id
     *  behind this page); `meetings` is optional and not currently supplied. */
    affairs?: AffairClient[];
    groups?: GroupClient[];
    meetings?: MeetingClient[];
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    /**
     * "page"    — full dimension route: pagination + data credit (default).
     * "snippet" — embedded on the overview: no pager, just the rows the loader
     *             passed plus a link to the full /people/:id/contributions feed.
     */
    variant?: "page" | "snippet";
    /** Page size ($7) and page start ($8), echoed from the loader. ("page" only.) */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. ("page" only.) */
    pageParam?: string;
    className?: string;
}

/* ------------------------------ target mapping ---------------------------- */

type TargetKind = "affair" | "meeting" | "group" | "session" | "news";

interface Target {
    kind: TargetKind;
    id: number;
    /** Internal route, or null when the entity has no person-facing page yet. */
    href: string | null;
    /** Resolved title (from the response-scoped lookups), or null when the
     *  lookup record wasn't supplied (e.g. meeting/session/news). */
    title: string | null;
    /** The most specific category for the left chip: an affair's type_name
     *  (Motion, Postulat, …) or a group's type, falling back to the kind label. */
    category: string | null;
    /** Affair business number (e.g. "23.3456"), when the target is an affair. */
    number: string | null;
    /** Affair processing state (e.g. "Erledigt"), shown as a status badge. */
    status: string | null;
    /** The target's own date span (affair lifetime / group active period),
     *  pre-formatted for the active locale. Gives the contribution a time anchor. */
    date: string | null;
    /** Official external record (parlament.ch), when the target exposes one. */
    urlExternal: string | null;
}

const TARGET_ICON: Record<TargetKind, IconName> = {
    affair: "file-text",
    meeting: "calendar-days",
    group: "users",
    session: "calendar-range",
    news: "newspaper",
};

const TARGET_LABEL_KEY: Record<TargetKind, string> = {
    affair: "contrib_target_affair",
    meeting: "contrib_target_meeting",
    group: "contrib_target_group",
    session: "contrib_target_session",
    news: "contrib_target_news",
};

/* -------------------------------- component ------------------------------- */

export function PersonContributions({
    persons,
    contributors,
    identities: _identities = [],
    bodies = [],
    affairs = [],
    groups = [],
    meetings = [],
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 5,
    offset = 0,
    pageParam = "offset",
    className,
}: PersonContributionsProps) {
    const params = useParams();
    const t = makeT(loc);
    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);

    const affairById = React.useMemo(
        () => new Map(affairs.map((a) => [a.id, a])),
        [affairs],
    );
    const groupById = React.useMemo(
        () => new Map(groups.map((g) => [g.id, g])),
        [groups],
    );
    const meetingById = React.useMemo(
        () => new Map(meetings.map((m) => [m.id, m])),
        [meetings],
    );

    const personId = persons.id;

    // Resolve each row's subject (one target, by precedence) and enrich it from
    // the response-scoped affair / group lookups when a matching record exists.
    const resolveTarget = React.useCallback(
        (c: ContributorClient): Target | null => {
            if (c.affair_id != null) {
                const a = affairById.get(c.affair_id);
                return {
                    kind: "affair",
                    id: c.affair_id,
                    href: affairHref(params.lang, c.affair_id),
                    title: a?.title ?? a?.title_long ?? null,
                    category: a?.type_name ?? a?.type_harmonized ?? null,
                    number: a?.number ?? null,
                    status: a?.state_name ?? null,
                    date: formatPeriod(a?.begin_date, a?.end_date, locale),
                    urlExternal: a?.url_external ?? null,
                };
            }
            if (c.group_id != null) {
                const g = groupById.get(c.group_id);
                return {
                    kind: "group",
                    id: c.group_id,
                    href: groupHref(params.lang, c.group_id),
                    title: g?.name ?? g?.abbreviation ?? null,
                    category: g?.type_external ?? g?.type_harmonized ?? null,
                    number: null,
                    status: null,
                    date: formatPeriod(g?.begin_date, g?.end_date, locale),
                    urlExternal: g?.url_external ?? null,
                };
            }
            if (c.meeting_id != null) {
                // meetings are not part of the contributors response → label-only link.
                const m = meetingById.get(c.meeting_id);
                return {
                    kind: "meeting",
                    id: c.meeting_id,
                    href: meetingHref(params.lang, c.meeting_id),
                    title: m?.name ?? m?.type_external ?? null,
                    category: null,
                    number: null,
                    status: null,
                    date: null,
                    urlExternal: null,
                };
            }
            // session / news have no person-facing route yet → label only.
            if (c.session_id != null)
                return blankTarget("session", c.session_id);
            if (c.news_id != null) return blankTarget("news", c.news_id);
            return null;
        },
        [affairById, groupById, meetingById, locale, params.lang],
    );

    return (
        <FeedShell
            descriptor={contributorsDescriptor}
            feedHref={feedPath(personId, "contributions")}
            icon="file-signature"
            titleKey="section_contributions"
            titleFallback="Contributions"
            emptyKey="no_contributions"
            emptyFallback="No recorded contributions."
            noResultsFallback="No contributions match your search."
            viewAllKey="view_all_contributions"
            viewAllFallback="View all contributions"
            list={contributors}
            renderRow={(c) => (
                <ContributionRow
                    key={c.id}
                    contribution={c}
                    target={resolveTarget(c)}
                    t={t}
                    bodyLabelText={bodyLabel(c.body_key, bodyLookup)}
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

function ContributionRow({
    contribution,
    target,
    t,
    bodyLabelText,
}: {
    contribution: ContributorClient;
    target: Target | null;
    t: (key: string) => string;
    bodyLabelText: string | null;
}) {
    const role =
        contribution.role ??
        contribution.role_harmonized ??
        t("contrib_role_unknown");
    const party = contribution.party ?? contribution.party_harmonized ?? null;

    // Generic per-kind label ("Affair", "Group", …), used as the link fallback
    // and as the chip when no more specific category is known.
    const kindLabel = target
        ? t(TARGET_LABEL_KEY[target.kind])
        : t("contrib_target_unknown");

    // Left chip: the most specific category available — an affair's type
    // (Motion, Postulat, …) or a group's type — else the generic kind label.
    const chipLabel = target?.category ?? kindLabel;

    return (
        <li className="grid grid-cols-1 gap-y-1.5 py-3 sm:grid-cols-[7rem_1fr] sm:gap-x-4 sm:gap-y-0">
            {/* category — aligned, scannable down the column */}
            <div className="justify-self-start sm:justify-self-stretch sm:pt-0.5">
                <Chip>
                    {chipLabel}
                </Chip>
            </div>

            {/* the contribution: role + linked business + context */}
            <div className="min-w-0 space-y-1">
                {/* headline: the role the person played */}
                <div className="text-sm font-medium leading-snug">{role}</div>

                {/* the business contributed to: title when known (linked), else a typed
            link; the affair number trails as a muted identifier. */}
                {target ? (
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                        <span className="inline-flex items-start gap-1.5">
                            <Icon
                                name={TARGET_ICON[target.kind]}
                                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                            />
                            {target.href ? (
                                <InternalLink to={target.href}>
                                    <span>{target.title ?? kindLabel}</span>
                                </InternalLink>
                            ) : (
                                <span>{target.title ?? kindLabel}</span>
                            )}
                        </span>
                        {target.number ? (
                            <span className="text-xs text-muted-foreground">
                                {t("contrib_number_prefix")} {target.number}
                            </span>
                        ) : null}
                    </div>
                ) : null}

                {/* meta: date · status · party-at-the-time · body · official record */}
                {target?.date ||
                    target?.status ||
                    party ||
                    bodyLabelText ||
                    target?.urlExternal ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {target?.date ? (
                            <MetaItem icon="calendar-range">{target.date}</MetaItem>
                        ) : null}
                        {target?.status ? (
                            <Badge
                                variant="outline"
                                className="font-normal text-muted-foreground"
                            >
                                {target.status}
                            </Badge>
                        ) : null}
                        {party ? <MetaItem icon="users">{party}</MetaItem> : null}
                        {bodyLabelText ? (
                            <MetaItem icon="landmark">{bodyLabelText}</MetaItem>
                        ) : null}
                        {target?.urlExternal ? (
                            <a
                                href={target.urlExternal}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                {t("contrib_source")}
                                <Icon name="external-link" className="size-3 shrink-0" />
                            </a>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

/* -------------------------------- helpers --------------------------------- */

/** A target we can name but not enrich or link (session / news: no lookup, no
 *  person-facing route yet). */
function blankTarget(kind: TargetKind, id: number): Target {
    return {
        kind,
        id,
        href: null,
        title: null,
        category: null,
        number: null,
        status: null,
        date: null,
        urlExternal: null,
    };
}

export default PersonContributions;