// InterestsList.tsx           → ~/components/opd_views/interests/InterestsList.tsx
//
// The interests DIRECTORY (top-level /interests): a paginated, server-filtered
// list of declared interests (register-of-interests entries) with search /
// filter / sort. Driven by `interestsCatalogDescriptor` + the URL. LIST family
// (top-level): the loader uses runListPaginatedFiltered and `interests` here is
// already the filtered, sorted page slice (total_count is the filtered total).
//
// Facet options: body (`bodies`, by the `body` param convention — sourced
// client-side, grouped by position). Payment + ex_officio are static. The
// interest `type` is localized free-text (no stable code) — NOT a facet.
//
// Each row links to /interests/:id, to its holder /people/:person_id (via the
// response-scoped `persons` lookup), and shows its granting body (via `bodies`).
// Mirrors VotingsList.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type { InterestClient, PersonClient, BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { interestsCatalogDescriptor } from "~/lib/dimensions/descriptors";
import { localizedPath } from "~/lib/lang";

import { Badge } from "@/components/ui/badge";

import {
    makeT,
    MetaItem,
    InternalLink,
    formatPeriod,
    Chip,
    bodyName as getBodyName,
    keyById,
} from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";
import { classifyPayment, PAYMENT_CHIP, paymentLabel as makePaymentLabel } from "../_shared/interestHelpers";

/* -------------------------------- component ------------------------------- */

export interface InterestsListProps {
    /** The filtered page slice + filtered total: `data.interests`. */
    interests: PaginatedList<InterestClient>;
    /** Response-scoped holder lookup (`data.persons.items`), keyed by id. */
    persons?: PersonClient[] | undefined;
    /** Response-scoped body lookup (`data.bodies.items`), keyed by id. */
    bodies?: BodyClient[] | undefined;
    loc?: Record<string, string> | undefined;
    locale?: string;
    limit?: number;
    offset?: number;
    pageParam?: string;
    /** Enable data export (catalogue use only) — forwarded to FeedShell. Omit for scoped reuses. */
    exportConfig?: {
        segment: string;
        datasetKey: string;
        filenameBase: string;
        subject?: string;
    };
    className?: string;
}

export function InterestsList({
    interests,
    persons,
    bodies,
    loc = {},
    locale = "de-CH",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    exportConfig,
    className,
}: InterestsListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const { lang } = useParams();

    const personById = React.useMemo(() => keyById(persons), [persons]);
    const bodyById = React.useMemo(() => keyById(bodies), [bodies]);

    return (
        <FeedShell
            descriptor={interestsCatalogDescriptor}
            icon="briefcase"
            titleKey="interests_title"
            titleFallback="Interests"
            emptyKey="no_interests"
            emptyFallback="No declared interests."
            noResultsFallback="No interests match your search."
            mcpNamespace="catalog"
            mcpSubject="all"
            sourced
            list={interests}
            renderRow={(i) => (
                <InterestRow
                    key={i.id}
                    interest={i}
                    t={t}
                    locale={locale}
                    href={localizedPath(lang, "NS_INTERESTS_OVERVIEW", {
                        id: String(i.id),
                    })}
                    person={i.person_id != null ? personById.get(i.person_id) : undefined}
                    personHref={
                        i.person_id != null
                            ? localizedPath(lang, "NS_PEOPLE_OVERVIEW", {
                                id: String(i.person_id),
                            })
                            : null
                    }
                    body={i.body_id != null ? bodyById.get(i.body_id) : undefined}
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

function InterestRow({
    interest,
    t,
    locale,
    href,
    person,
    personHref,
    body,
}: {
    interest: InterestClient;
    t: (key: string) => string;
    locale: string;
    href: string;
    person?: PersonClient | undefined;
    personHref?: string | null;
    body?: BodyClient | undefined;
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
    const place = interest.place ?? null;
    const period = formatPeriod(
        interest.begin_date,
        interest.end_date,
        locale,
        t,
        "interest",
    );

    const personName = person?.fullname ?? null;
    const bodyName = getBodyName(body, interest.body_key);

    return (
        <li className="py-3">
            <div className="grid grid-cols-[7rem_1fr] gap-x-4">
                <div className="pt-0.5">
                    <Chip tone={PAYMENT_CHIP[payment]}>
                        {paymentLabel}
                    </Chip>
                </div>

                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                        <InternalLink to={href}>
                            {name}
                        </InternalLink>
                        {role ? (
                            <span className="font-normal text-muted-foreground">
                                {" · "}
                                {role}
                            </span>
                        ) : null}
                        {interest.ex_officio ? (
                            <Badge variant="outline" className="font-normal text-muted-foreground">
                                {t("interest_ex_officio")}
                            </Badge>
                        ) : null}
                    </div>

                    {personName || bodyName || type || place || period ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {personName ? (
                                <MetaItem icon="user">
                                    {personHref ? (
                                        <InternalLink to={personHref}>{personName}</InternalLink>
                                    ) : (
                                        personName
                                    )}
                                </MetaItem>
                            ) : null}
                            {bodyName ? <MetaItem icon="landmark">{bodyName}</MetaItem> : null}
                            {type ? <MetaItem icon="tag">{type}</MetaItem> : null}
                            {place ? <MetaItem icon="map-pin">{place}</MetaItem> : null}
                            {period ? <MetaItem icon="calendar-range">{period}</MetaItem> : null}
                        </div>
                    ) : null}
                </div>
            </div>
        </li>
    );
}

export default InterestsList;
