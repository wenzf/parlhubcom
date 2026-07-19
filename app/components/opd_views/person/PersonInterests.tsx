// PersonInterests.tsx
//
// Register-of-interests list for a member of parliament. Two variants:
//   â¢ "page"    â the /people/:id/interests dimension route: paginated, with a
//                 CC BY 4.0 data credit, AND search / filter / sort controls
//                 (server-side, over the whole set). Rendered BELOW <PersonBase />.
//   â¢ "snippet" â embedded on the overview route: shows the rows the loader
//                 passed (no pager, no controls) plus a link to the full feed.
// Like <PersonVotes />, it owns only its own panel and never re-emits identity
// properties, so nothing is declared twice on the page.
//
// Search / filter / sort (page variant):
//   The controls (<DimensionControls />) and the agent tools (<DimensionMcpTools />)
//   are both driven by the shared `interestsDescriptor` and the URL. The loader
//   applies the same criteria in SQL (person_interests_by_id.sql), so `interests`
//   here is already the filtered, sorted page slice and `total_count` is the
//   filtered total â the component just renders the server's order (no client
//   re-sort) and drives the pager from total_count.
//
// Domain / schema.org: unchanged from before â see the row renderer below.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type {
    PersonClient,
    IdentityClient,
    BodyClient,
    InterestClient,
} from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import {
    buildBodyLookup,
    bodyLabel,
    formatEpoch,
} from "~/lib/domain/person";
import {
    interestsDescriptor,
    withBodyOptions,
} from "~/lib/dimensions/descriptors";

import { Badge } from "@/components/ui/badge";

import { InternalLink, makeT, MetaItem, feedPath, formatPeriod, Chip } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";
import { classifyPayment, PAYMENT_CHIP, paymentLabel as makePaymentLabel } from "../_shared/interestHelpers";
import { localizedOrgPath } from "~/lib/urls/org_id";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface PersonInterestsProps {
    persons: PersonClient;
    interests: PaginatedList<InterestClient>;
    identities?: IdentityClient[];
    bodies?: BodyClient[];
    loc?: Record<string, string>;
    locale?: string;
    variant?: "page" | "snippet";
    limit?: number;
    offset?: number;
    pageParam?: string;
    className?: string;
}

/* -------------------------------- component ------------------------------- */

export function PersonInterests({
    persons,
    interests,
    identities: _identities = [],
    bodies = [],
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    className,
}: PersonInterestsProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);
    const params = useParams();

    const personId = persons.id;

    // Descriptor with the body facet filled from the bodies actually present.
    const descriptor = React.useMemo(
        () => withBodyOptions(interestsDescriptor, bodies),
        [bodies],
    );

    return (
        <FeedShell
            descriptor={descriptor}
            feedHref={feedPath(personId, "interests")}
            icon="briefcase"
            titleKey="section_interests"
            titleFallback="Declared interests"
            emptyKey="no_interests"
            emptyFallback="No declared interests."
            noResultsFallback="No interests match your search."
            viewAllKey="view_all_interests"
            viewAllFallback="View all interests"
            list={interests}
            renderRow={(i) => (
                <InterestRow
                    key={i.id}
                    interest={i}
                    t={t}
                    locale={locale}
                    lang={params.lang}
                    bodyLabelText={bodyLabel(i.body_key, bodyLookup)}
                />
            )}
            methodologyAnchor="interests"
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

function InterestRow({
    interest,
    t,
    locale,
    lang,
    bodyLabelText,
}: {
    interest: InterestClient;
    t: (key: string) => string;
    locale: string;
    lang: string | undefined;
    bodyLabelText: string | null;
}) {
    const payment = classifyPayment(
        interest.type_payment_harmonized,
        interest.type_payment,
    );
    const paymentLabel = makePaymentLabel(
        interest.type_payment,
        payment,
        t,
        t("interest_payment_unknown"),
    );

    const name =
        interest.name ??
        interest.name_short ??
        interest.name_abbreviation ??
        t("interest_untitled");
    const role = interest.role_name ?? null;
    const type = interest.type ?? null;
    const group = interest.group ?? null;
    const place = interest.place ?? null;
    const url = interest.url ?? null;

    // Organizations are derived from interests grouped by the normalized org name
    // (org_key = lower(trimmed localized display name); see organizations_list.sql
    // + org_id.ts). Build that key from the same coalesced display name — WITHOUT
    // the "untitled" fallback — so the row links to the matching /organizations/:id.
    const orgName = (
        interest.name ??
        interest.name_short ??
        interest.name_abbreviation ??
        ""
    ).trim();
    const orgHref = orgName ? localizedOrgPath(lang, orgName.toLowerCase()) : null;

    const period = formatPeriod(
        interest.begin_date,
        interest.end_date,
        locale,
        t,
        "interest",
    );
    const docUrl = interest.declaration_doc_url ?? null;
    const docTitle =
        interest.declaration_doc_title ?? t("interest_declaration");

    const hasMeta = !!(type || place || period || bodyLabelText);

    return (
        <li className="grid grid-cols-1 gap-y-1.5 py-3 sm:grid-cols-[7rem_1fr] sm:gap-x-4 sm:gap-y-0">
            <div className="justify-self-start sm:justify-self-stretch sm:pt-0.5">
                <Chip tone={PAYMENT_CHIP[payment]}>
                    {paymentLabel}
                </Chip>
            </div>

            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-start gap-x-1.5 gap-y-0.5 text-sm font-medium leading-snug">
                    <Icon name="building-2" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    {orgHref ? (
                        <InternalLink to={orgHref}>
                            <span>{name}</span>
                        </InternalLink>
                    ) : (
                        <span>{name}</span>
                    )}
                    {url ? (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t("interest_website")}
                            className="inline-flex items-start rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            <Icon name="external-link" className="mt-0.5 size-3 shrink-0" />
                        </a>
                    ) : null}
                    {role ? (
                        <span className="font-normal text-muted-foreground">
                            {" Â· "}
                            {role}
                        </span>
                    ) : null}
                    {interest.ex_officio ? (
                        <Badge
                            variant="outline"
                            className="ml-1 font-normal text-muted-foreground"
                        >
                            {t("interest_ex_officio")}
                        </Badge>
                    ) : null}
                </div>

                {hasMeta ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {type ? <MetaItem icon="tag">{type}</MetaItem> : null}
                        {place ? <MetaItem icon="map-pin">{place}</MetaItem> : null}
                        {period ? <MetaItem icon="calendar-range">{period}</MetaItem> : null}
                        {bodyLabelText ? (
                            <MetaItem icon="landmark">{bodyLabelText}</MetaItem>
                        ) : null}
                    </div>
                ) : null}

                {group || docUrl ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {group ? (
                            <Badge variant="outline" className="font-normal text-muted-foreground">
                                {group}
                            </Badge>
                        ) : null}
                        {docUrl ? (
                            <MetaItem icon="file-text">
                                <a
                                    href={docUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                    {docTitle}
                                    <Icon name="external-link" className="size-3 shrink-0" />
                                </a>
                            </MetaItem>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default PersonInterests;