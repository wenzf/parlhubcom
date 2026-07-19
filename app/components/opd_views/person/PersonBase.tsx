// PersonBase.tsx
//
// Compact identity header for a political actor. Rendered at the top of every
// person detail page (votes, memberships, speeches, …) and on the overview
// page above <PersonFull />.
//
// Presentational only — the page's schema.org Person/ProfilePage structured data
// is emitted as head JSON-LD by the route meta() (metas/person.ts → jsonld/person.ts),
// not as visible-DOM microdata.
//
// All visible labels come from the `loc` map (Record<string, string>); the
// second arg to t() is the English fallback used when a key is missing.

import * as React from "react";
import type { PersonClient, IdentityClient, BodyClient } from "@/types/opd_db";
import {
    resolveEffectivePerson,
    buildBodyLookup,
    bodyLabel,
    displayName,
    initials,
    formatDate,
    isoDateTime,
    ageOf,
} from "~/lib/domain/person";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem } from "../opd_micros";

export interface PersonBaseProps {
    persons: PersonClient;
    identities?: IdentityClient[];
    bodies?: BodyClient[];
    /** Localized label map (e.g. pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    /** Resolved UI language for date/number formatting. */
    locale?: string;
    className?: string;
}

export function PersonBase({
    persons,
    identities = [],
    bodies = [],
    loc = {},
    locale = "de-CH",
    className,
}: PersonBaseProps) {
    const t = makeT(loc);


    const { person } = resolveEffectivePerson(persons, identities);
    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);

    const name = displayName(person);
    const image = person.image_url_oparl ?? person.image_url_external ?? undefined;

    const party = person.party_harmonized ?? person.party ?? null;
    // Show the raw source party as a tooltip when it differs from the harmonized one.
    const rawPartyDiffers =
        !!person.party && !!person.party_harmonized && person.party !== person.party_harmonized;

    const group = person.parliamentary_group_name ?? null;
    const parliament = bodyLabel(person.body_key, bodyLookup);

    const birth = formatDate(person.birthday, locale, person.birthday_format);
    const death = formatDate(person.deathday, locale);
    // Age depends on "now"; compute it client-side only to avoid SSR/hydration drift.
    const [now, setNow] = React.useState<Date | null>(null);
    React.useEffect(() => setNow(new Date()), []);
    const age = now ? ageOf(person.birthday, person.deathday, now) : null;

    return (
        <header
            className={["flex flex-col gap-4 sm:flex-row sm:items-start", className]
                .filter(Boolean)
                .join(" ")}
        >
            <Avatar className="size-20 rounded-xl border sm:size-24">
                {image ? <AvatarImage src={image} alt={name} className="object-cover" /> : null}
                <AvatarFallback className="rounded-xl text-lg font-medium">
                    {initials(person) || "–"}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
                {/* Name + status */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {person.title ? (
                        <span className="text-sm text-muted-foreground">
                            {person.title}
                        </span>
                    ) : null}
                    <h1 className="text-2xl font-semibold leading-tight tracking-tight">
                        {name}
                    </h1>
                    {person.active === true ? (
                        <Badge variant="secondary">{t("status_active")}</Badge>
                    ) : person.active === false ? (
                        <Badge variant="outline" className="text-muted-foreground">
                            {t("status_former")}
                        </Badge>
                    ) : null}
                </div>

                {/* Political identity: party + parliamentary group */}
                {(party || group) && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        {party ? (
                            <Badge
                                variant="secondary"
                                className="font-medium"
                                title={
                                    rawPartyDiffers
                                        ? `${t("source_party")}: ${person.party}`
                                        : undefined
                                }
                            >
                                {party}
                            </Badge>
                        ) : null}
                        {group ? (
                            <span className="text-muted-foreground">{group}</span>
                        ) : null}
                    </div>
                )}

                {/* Mandate facts */}
                {(person.function_latest || person.electoral_district || parliament) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {person.function_latest ? (
                            <MetaItem icon="briefcase">
                                <span className="text-foreground">{person.function_latest}</span>
                            </MetaItem>
                        ) : null}
                        {parliament ? (
                            <MetaItem icon="building-2">{parliament}</MetaItem>
                        ) : null}
                        {person.electoral_district ? (
                            <MetaItem icon="map-pin">{person.electoral_district}</MetaItem>
                        ) : null}
                    </div>
                )}

                {/* Birth / death */}
                {(birth || death) && (
                    <p className="text-sm text-muted-foreground">
                        {birth ? (
                            <>
                                <span aria-hidden>★ </span>
                                <time dateTime={isoDateTime(person.birthday)}>
                                    {birth}
                                </time>
                                {age != null && !death ? ` (${t("age")} ${age})` : null}
                            </>
                        ) : null}
                        {death ? (
                            <>
                                {birth ? " · " : null}
                                <span aria-hidden>† </span>
                                <time dateTime={isoDateTime(person.deathday)}>
                                    {death}
                                </time>
                            </>
                        ) : null}
                    </p>
                )}
            </div>
        </header>
    );
}

export default PersonBase;