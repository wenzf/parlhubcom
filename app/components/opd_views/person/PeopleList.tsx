// PeopleList.tsx
//
// The people DIRECTORY (top-level /people): a paginated, server-filtered list of
// persons with search / filter / sort. Driven by `peopleDescriptor` + the URL,
// exactly like the per-person dimension panels — but this is the LIST family
// (top-level), so the loader uses runListPaginatedFiltered and `people` here is
// already the filtered, sorted page slice (total_count is the filtered total).
//
// Runtime-injected facet options:
//   • party    — STATIC, from the curated swiss_parties list (in the descriptor).
//   • group    — withCodeOptions over the page's parliamentary_group_external_id
//                (label = localized parliamentary_group_name).
//   • gender   — withCodeOptions over the page's `gender` values (label = the value).
//   • body     — withBodyOptions over the response `bodies`.
//
// All visible labels come from the `loc` map; the second arg to t() is the English
// fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type {
    PersonClient,
    BodyClient,
    IdentityClient,
} from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import {
    buildBodyLookup,
    bodyLabel,
    displayName,
} from "~/lib/domain/person";
import { type DimensionDescriptor } from "~/lib/dimensions/filters";
import {
    peopleDescriptor,
    withBodyOptions,
    withCodeOptions,
} from "~/lib/dimensions/descriptors";
import { peopleHref } from "~/lib/urls/hrefs";

import { Badge } from "@/components/ui/badge";

import { InternalLink, makeT, MetaItem } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { Icon } from "../../icons/opd_icons";

export interface PeopleListProps {
    /** The filtered page slice + filtered total: `dat.people`. */
    people: PaginatedList<PersonClient>;
    /**
     * Sibling identities for the people on this page (`dat.person_identities.items`),
     * i.e. the same humans' OTHER mandates in other parliaments (canton / federal /
     * communal). Grouped by `identity_primary_id` to render each row's "also active
     * in" line. The row itself always links to the PRIMARY person (`/people/:id`).
     */
    identities?: IdentityClient[] | undefined;
    /** Bodies referenced by the page slice, for per-row parliament labels + the body facet. */
    bodies?: BodyClient[] | undefined;
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string> | undefined;
    locale?: string;
    /** Page size ($6) and page start ($7), echoed from the loader. */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. */
    pageParam?: string;
    /** Descriptor driving the controls/criteria. Defaults to the people-directory
     *  descriptor; pass a scoped one (e.g. bodyPeopleDescriptor) to reuse this list
     *  for a body-scoped people view. Its facets/sorts must match the loader's SQL. */
    descriptor?: DimensionDescriptor;
    /** loc key for the card title (default "people_title"). */
    titleKey?: string;
    /** Enable data export (catalogue use only) — forwarded to FeedShell. Omit for
     *  scoped reuses (e.g. a body's people tab, which exports via its own layout). */
    exportConfig?: {
        segment: string;
        datasetKey: string;
        filenameBase: string;
        subject?: string;
    };
    className?: string;
}

/** A person's other-parliament mandate, derived from a sibling identity. */
interface OtherParliament {
    label: string;
    active: boolean | null | undefined;
}

/**
 * Distinct OTHER parliaments a person sits in, from their sibling identities —
 * excluding the primary row's own body (already shown as the main parliament).
 * Deduped by body, primary identities first (is_primary), so the most relevant
 * mandate wins the active flag when a body repeats.
 */
function otherParliamentsOf(
    sibs: IdentityClient[],
    primaryBodyId: number | null | undefined,
    lookup: ReturnType<typeof buildBodyLookup>,
): OtherParliament[] {
    const ordered = [...sibs].sort(
        (a, b) => Number(b.is_primary ?? false) - Number(a.is_primary ?? false),
    );
    const seen = new Set<number>();
    const out: OtherParliament[] = [];
    for (const s of ordered) {
        if (s.body_id == null || s.body_id === primaryBodyId) continue;
        if (seen.has(s.body_id)) continue;
        const label = bodyLabel(s.body_key, lookup);
        if (label == null) continue; // body not in the response lookup → skip
        seen.add(s.body_id);
        out.push({ label, active: s.active });
    }
    return out;
}

/** Title-case a raw enum value (e.g. "male" → "Male") for facet option labels. */
function titleCase(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function PeopleList({
    people,
    identities = [],
    bodies = [],
    loc = {},
    locale = "de-CH",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    descriptor: baseDescriptor = peopleDescriptor,
    titleKey = "people_title",
    exportConfig,
    className,
}: PeopleListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);
    const params = useParams();

    // Trust the server's order (the SQL ORDER BY is driven by the same criteria).
    const items = React.useMemo(() => people.items ?? [], [people.items]);

    // Sibling identities grouped by primary person id, for the "also active in" line.
    const identitiesByPrimary = React.useMemo(() => {
        const m = new Map<number, IdentityClient[]>();
        for (const id of identities) {
            const pid = id.identity_primary_id;
            if (pid == null) continue; // no primary link → cannot attach to a row
            const arr = m.get(pid);
            if (arr) arr.push(id);
            else m.set(pid, [id]);
        }
        return m;
    }, [identities]);

    // Descriptor with the runtime-injected selects filled from the loaded page:
    // group + gender from the people rows, body from the response `bodies`. The
    // injectors are no-ops for params the descriptor doesn't declare, so a scoped
    // descriptor (e.g. bodyPeopleDescriptor, no body/group facet) passes through
    // with only the facets it actually has. (party is a static curated list.)
    const descriptor = React.useMemo(() => {
        const rows = items as unknown as Record<string, unknown>[];
        return withBodyOptions(
            withCodeOptions(
                withCodeOptions(
                    baseDescriptor,
                    "group",
                    rows,
                    "parliamentary_group_external_id",
                    (r) =>
                        (r.parliamentary_group_name as string) ??
                        String(r.parliamentary_group_external_id ?? ""),
                ),
                "gender",
                rows,
                "gender",
                (r) => titleCase(String(r.gender ?? "")),
            ),
            bodies,
        );
    }, [baseDescriptor, items, bodies]);

    return (
        <FeedShell
            descriptor={descriptor}
            icon="users"
            titleKey={titleKey}
            titleFallback="People"
            emptyKey="no_people"
            emptyFallback="No people found."
            noResultsFallback="No people match your search."
            sourced
            list={people}
            renderRow={(p) => (
                <PersonRow
                    key={p.id}
                    person={p}
                    t={t}
                    locale={locale}
                    href={peopleHref(params.lang, p.id)}
                    parliament={bodyLabel(p.body_key, bodyLookup)}
                    otherParliaments={otherParliamentsOf(
                        identitiesByPrimary.get(p.id) ?? [],
                        p.body_id,
                        bodyLookup,
                    )}
                />
            )}
            loc={loc}
            locale={locale}
            variant="page"
            limit={limit}
            offset={offset}
            pageParam={pageParam}
            exportConfig={exportConfig}
            className={className}
        />
    );
}

/* --------------------------------- a row ---------------------------------- */

function PersonRow({
    person,
    t,
    locale,
    href,
    parliament,
    otherParliaments,
}: {
    person: PersonClient;
    t: (key: string) => string;
    locale: string;
    href: string;
    parliament: string | null;
    otherParliaments: OtherParliament[];
}) {
    const name = displayName(person);
    const party = person.party_harmonized ?? person.party ?? null;
    const group = person.parliamentary_group_name ?? null;
    const district = person.electoral_district ?? null;
    const fn = person.function_latest ?? null;
    const deceased = person.deathday != null;

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    {/* The link always points at the PRIMARY person, even when matched /
              shown via a sibling identity. */}
                    <InternalLink to={href}>{name}</InternalLink>
                    {party ? (
                        <Badge variant="secondary" className="font-normal">
                            {party}
                        </Badge>
                    ) : null}
                    {person.active === true ? (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                            {t("status_active")}
                        </Badge>
                    ) : person.active === false ? (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                            {t("status_former_short")}
                        </Badge>
                    ) : null}
                    {deceased ? (
                        <span className="text-xs text-muted-foreground" aria-hidden>
                            †
                        </span>
                    ) : null}
                </div>

                {group || parliament || fn || district ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {fn ? (
                            <MetaItem icon="briefcase">{fn}</MetaItem>
                        ) : null}
                        {group ? (
                            <MetaItem icon="users">{group}</MetaItem>
                        ) : null}
                        {parliament ? <MetaItem icon="landmark">{parliament}</MetaItem> : null}
                        {district ? <MetaItem icon="map-pin">{district}</MetaItem> : null}
                    </div>
                ) : null}

                {/* Other mandates from sibling identities (canton / federal / communal). */}
                {otherParliaments.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        <Icon name="landmark" className="size-3 shrink-0 opacity-60" aria-hidden />
                        <span className="text-muted-foreground/70">
                            {t("also_active_in")}:
                        </span>
                        {otherParliaments.map((op, idx) => (
                            <span key={idx}>
                                {op.label}
                                {op.active === false ? (
                                    <span className="opacity-60">
                                        {" "}
                                        ({t("status_former_short")})
                                    </span>
                                ) : null}
                                {idx < otherParliaments.length - 1 ? (
                                    <span aria-hidden> ·</span>
                                ) : null}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default PeopleList;