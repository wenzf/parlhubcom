// BodiesList.tsx
//
// The bodies DIRECTORY (top-level /bodies): a paginated, server-filtered list of
// bodies (parliaments / cantons / communal institutions) with search / filter /
// sort. Driven by `bodiesDescriptor` + the URL, exactly like the people directory
// — this is the LIST family (top-level), so the loader uses
// runListPaginatedFiltered and `bodies` here is already the filtered, sorted page
// slice (total_count is the filtered total).
//
// Facet options:
//   • type  — SOURCED client-side from the full body-type vocabulary
//             (bodies/?indexed=true → distinct type/type_name). Enabled by the
//             `sourced` prop on <DimensionControls>; no per-page wiring needed.
//   • country / has_parliament — static (declared on the descriptor).
//
// Bodies are self-contained, so — unlike PeopleList — there are no sibling
// identities and no body lookup; each row IS a body.
//
// All visible labels come from the `loc` map; the second arg to t() is the English
// fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type { BodyClient } from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { bodiesDescriptor } from "~/lib/dimensions/descriptors";
import { bodyHref } from "~/lib/urls/hrefs";

import { Badge } from "@/components/ui/badge";

import { InternalLink, makeT, MetaItem, bodyName, codeSuffix } from "../opd_micros";
import { FeedShell } from "../_shared/feeds/FeedShell";

export interface BodiesListProps {
    /** The filtered page slice + filtered total: `dat.bodies`. */
    bodies: PaginatedList<BodyClient>;
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string> | undefined;
    locale?: string;
    /** Page size ($6) and page start ($7), echoed from the loader. */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. */
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

export function BodiesList({
    bodies,
    loc = {},
    locale = "de-CH",
    limit = 20,
    offset = 0,
    pageParam = "offset",
    exportConfig,
    className,
}: BodiesListProps) {
    const t = React.useMemo(() => makeT(loc), [loc]);
    const { lang } = useParams();

    return (
        <FeedShell
            descriptor={bodiesDescriptor}
            icon="landmark"
            titleKey="bodies_title"
            titleFallback="Institutions"
            emptyKey="no_bodies"
            emptyFallback="No institutions found."
            noResultsFallback="No institutions match your search."
            mcpNamespace="catalog"
            mcpSubject="all"
            sourced
            list={bodies}
            renderRow={(b) => (
                <BodyRow
                    key={b.id}
                    body={b}
                    t={t}
                    locale={locale}
                    href={bodyHref(lang, b.id)}
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

function BodyRow({
    body,
    t,
    locale,
    href,
}: {
    body: BodyClient;
    t: (key: string) => string;
    locale: string;
    href: string;
}) {
    const primary = bodyName(body, body.body_key) ?? String(body.id);
    // `name` shown next to the legislative name (when it adds something), e.g.
    // "Kantonsrat" + "Zürich". Suppressed when it duplicates the primary label.
    const secondary = body.name && body.name !== primary ? body.name : null;
    // body_key appended in brackets only when it's a meaningful code (e.g. "ZH"),
    // not an opaque numeric id.
    const keyRaw = body.body_key ?? null;
    const keySuffix = codeSuffix(keyRaw);

    // Type badge — `type_name` is already localized (resolved by loc() in the SQL).
    const typeLabel = body.type_name ?? null;

    const canton = body.canton_key ?? null;
    const country = body.country_key ?? null;
    const countryLabel =
        country === "CHE"
            ? t("country_che")
            : country === "LIE"
                ? t("country_lie")
                : country;
    const population =
        typeof body.population === "number"
            ? body.population.toLocaleString(locale)
            : null;
    const seats =
        typeof body.legislative_seats === "number" ? body.legislative_seats : null;
    const hasParliament = body.has_parliament === true;

    return (
        <li className="py-3">
            <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium leading-snug">
                    <InternalLink to={href}>{primary}</InternalLink>
                    {secondary ? (
                        <span className="font-normal text-muted-foreground">{secondary}</span>
                    ) : null}
                    {keySuffix ? (
                        <span className="font-normal text-muted-foreground">({keySuffix})</span>
                    ) : null}
                    {typeLabel ? (
                        <Badge variant="secondary" className="font-normal">
                            {typeLabel}
                        </Badge>
                    ) : null}
                    {hasParliament ? (
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                            {t("facet_has_parliament")}
                        </Badge>
                    ) : null}
                </div>

                {canton || countryLabel || population || seats != null ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {countryLabel ? (
                            <MetaItem icon="globe">{countryLabel}</MetaItem>
                        ) : null}
                        {canton ? <MetaItem icon="map-pin">{canton}</MetaItem> : null}
                        {population ? (
                            <MetaItem icon="users">
                                {population} {t("body_population")}
                            </MetaItem>
                        ) : null}
                        {seats != null ? (
                            <MetaItem icon="landmark">
                                {seats} {t("body_seats")}
                            </MetaItem>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

export default BodiesList;
