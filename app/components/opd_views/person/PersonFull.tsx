// PersonFull.tsx
//
// Full data panel for a political actor — rendered ONLY on the person overview
// page, below <PersonBase />.
//
// Sections: Mandate · Personal · Contact · Also active in · References & source.
// Presentational only — the page's schema.org Person structured data is emitted
// as head JSON-LD by the route meta() (metas/person.ts → jsonld/person.ts).
//
// All visible labels come from the `loc` map (Record<string, string>); the
// second arg to t() is the English fallback used when a key is missing.

import * as React from "react";
import { useParams } from "react-router";
import type { PersonClient, IdentityClient, BodyClient } from "@/types/opd_db";
import {
    resolveEffectivePerson,
    buildBodyLookup,
    bodyLabel,
    formatDate,
    ageOf,
    formatEpoch,
    wikidataUrl,
} from "~/lib/domain/person";
import { bodyHref } from "~/lib/urls/hrefs";

import { Badge } from "@/components/ui/badge";

import { InternalLink, makeT, Field, Section } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";

export interface PersonFullProps {
    persons: PersonClient;
    identities?: IdentityClient[];
    bodies?: BodyClient[];
    /** Localized label map (e.g. pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

/* -------------------------------- component ------------------------------- */

export function PersonFull({
    persons,
    identities = [],
    bodies = [],
    loc = {},
    locale = "de-CH",
    className,
}: PersonFullProps) {
    const t = makeT(loc);
    const { lang } = useParams();

    const { person, otherIdentities } = resolveEffectivePerson(persons, identities);
    const bodyLookup = React.useMemo(() => buildBodyLookup(bodies), [bodies]);

    const partyPrimary = person.party_harmonized ?? person.party ?? null;
    const partyRawDiffers =
        !!person.party &&
        !!person.party_harmonized &&
        person.party !== person.party_harmonized;

    const parliament = bodyLabel(person.body_key, bodyLookup, { canton: true });
    // Body the person is mandated in → internal /bodies/:id link. Prefer the
    // direct body_id, fall back to the looked-up body's own id.
    const parliamentBodyId =
        person.body_id ??
        (person.body_key ? bodyLookup.get(person.body_key)?.id : undefined) ??
        null;
    const birth = formatDate(person.birthday, locale, person.birthday_format);
    const death = formatDate(person.deathday, locale);
    // Age depends on "now"; compute it client-side only to avoid SSR/hydration drift.
    const [now, setNow] = React.useState<Date | null>(null);
    React.useEffect(() => setNow(new Date()), []);
    const age = now ? ageOf(person.birthday, person.deathday, now) : null;

    const hasAddress = person.street || person.postal_code || person.city;
    const hasContact = person.email || person.phone || hasAddress || person.website_personal;

    return (
        <div className={["space-y-4", className].filter(Boolean).join(" ")}>
            {/* ------------------------------ Mandate ------------------------------ */}
            <Section title={t("section_mandate")} icon="landmark">
                <Field label={t("function")} value={person.function_latest} />
                <Field label={t("party")}>
                    {partyPrimary ? (
                        <span className="inline-flex items-center gap-2">
                            <span>{partyPrimary}</span>
                            {partyRawDiffers ? (
                                <Badge variant="outline" className="font-normal text-muted-foreground">
                                    {t("party_source_prefix")}: {person.party}
                                </Badge>
                            ) : null}
                        </span>
                    ) : null}
                </Field>
                <Field label={t("parliamentary_group")} value={person.parliamentary_group_name} />
                <Field label={t("parliament")}>
                    {parliament ? (
                        parliamentBodyId != null ? (
                            <InternalLink
                                to={bodyHref(lang, parliamentBodyId)}
                            >
                                <span>{parliament}</span>
                            </InternalLink>
                        ) : (
                            <span>{parliament}</span>
                        )
                    ) : null}
                </Field>
                <Field label={t("electoral_district")} value={person.electoral_district} />
                <Field label={t("chamber_sector")} value={person.parliament_sector} />
                <Field
                    label={t("seat_no")}
                    value={person.parliament_seat != null ? person.parliament_seat : null}
                />
                <Field label={t("parliament_page")}>
                    {person.website_parliament_url ? (
                        <a
                            href={person.website_parliament_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            {t("official_profile")} <Icon name="external-link" className="size-3" />
                        </a>
                    ) : null}
                </Field>
            </Section>

            {/* ------------------------------ Personal ----------------------------- */}
            <Section title={t("section_personal")} icon="user">
                <Field
                    label={t("gender")}
                    value={
                        person.gender
                            ? t(`gender_${person.gender.toLowerCase()}`)
                            : undefined
                    }
                />
                <Field label={t("born")}>
                    {birth ? (
                        <span>
                            {birth}
                            {age != null && !death ? (
                                <span className="text-muted-foreground"> ({t("age")} {age})</span>
                            ) : null}
                        </span>
                    ) : null}
                </Field>
                <Field label={t("died")} value={death} />
                <Field label={t("marital_status")} value={person.marital_status} />
                <Field label={t("occupation")} value={person.occupation} />
                <Field
                    label={t("language")}
                    value={
                        person.language
                            ? t(`lang_${person.language.toLowerCase()}`)
                            : undefined
                    }
                />
            </Section>

            {/* ------------------------------ Contact ------------------------------ */}
            {hasContact ? (
                <Section title={t("section_contact")} icon="contact">
                    <Field label={t("email")}>
                        {person.email ? (
                            <a
                                href={`mailto:${person.email}`}
                                className="inline-flex items-center gap-1.5 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                <Icon name="mail" className="size-3.5" />
                                <span>{person.email}</span>
                            </a>
                        ) : null}
                    </Field>
                    <Field label={t("phone")}>
                        {person.phone ? (
                            <a
                                href={`tel:${person.phone.replace(/\s+/g, "")}`}
                                className="inline-flex items-center gap-1.5 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                <Icon name="phone" className="size-3.5" />
                                {person.phone}
                            </a>
                        ) : null}
                    </Field>
                    <Field label={t("address")}>
                        {hasAddress ? (
                            <address className="not-italic">
                                <span className="inline-flex items-start gap-1.5">
                                    <Icon name="map-pin" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                                    <span>
                                        {person.street ? <span>{person.street}</span> : null}
                                        {person.street && (person.postal_code || person.city) ? <br /> : null}
                                        {person.postal_code ? <span>{person.postal_code}</span> : null}
                                        {person.postal_code && person.city ? " " : null}
                                        {person.city ? <span>{person.city}</span> : null}
                                    </span>
                                </span>
                            </address>
                        ) : null}
                    </Field>
                    <Field label={t("website")}>
                        {person.website_personal ? (
                            <a
                                href={person.website_personal}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                <Icon name="globe" className="size-3.5" />
                                {person.website_personal.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </a>
                        ) : null}
                    </Field>
                </Section>
            ) : null}

            {/* --------------------------- Also active in -------------------------- */}
            {otherIdentities.length > 0 ? (
                <Section title={t("section_also_active")} icon="landmark">
                    {otherIdentities.map((id) => {
                        const otherParliament = bodyLabel(id.body_key, bodyLookup, {
                            canton: true,
                        });
                        const otherParty = id.party_harmonized ?? id.party ?? null;
                        return (
                            <div
                                key={id.id}
                                className="grid grid-cols-[minmax(8rem,9rem)_1fr] gap-x-4 gap-y-1 py-2"
                            >
                                <dt className="text-sm font-medium">
                                    {id.body_id != null ? (
                                        <InternalLink to={bodyHref(lang, id.body_id)}>
                                            <span>{otherParliament ?? `#${id.body_id}`}</span>
                                        </InternalLink>
                                    ) : (
                                        <span>{otherParliament ?? `#${id.id}`}</span>
                                    )}
                                </dt>
                                <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                                    {otherParty ? <span>{otherParty}</span> : null}
                                    {id.parliamentary_group_name ? (
                                        <span>· {id.parliamentary_group_name}</span>
                                    ) : null}
                                    {id.electoral_district ? <span>· {id.electoral_district}</span> : null}
                                    {id.active === true ? (
                                        <Badge variant="secondary" className="ml-1">
                                            {t("status_active")}
                                        </Badge>
                                    ) : id.active === false ? (
                                        <Badge variant="outline" className="ml-1 text-muted-foreground">
                                            {t("status_former_short")}
                                        </Badge>
                                    ) : null}
                                </dd>
                            </div>
                        );
                    })}
                </Section>
            ) : null}

            {/* ----------------------- References & source ------------------------- */}
            <Section title={t("section_references")} icon="file-text">
                <Field label={t("wikidata")}>
                    {person.wikidata_id ? (
                        <a
                            href={wikidataUrl(person.wikidata_id)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            {person.wikidata_id} <Icon name="external-link" className="size-3" />
                        </a>
                    ) : null}
                </Field>
                <Field label={t("source_body")} value={person.body_key} />
                <Field label={t("source_updated")} value={formatEpoch(person.updated_external_at, locale)} />
                <Field label={t("record_updated")} value={formatEpoch(person.updated_at, locale)} />
                <Field label={t("first_imported")} value={formatEpoch(person.created_at, locale)} />
            </Section>
        </div>
    );
}

export default PersonFull;