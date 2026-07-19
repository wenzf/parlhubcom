// InterestFull.tsx           → ~/components/opd_views/interests/InterestFull.tsx
//
// Full data panel for a declared interest — rendered ONLY on the /interests/:id
// overview, below <InterestBase />. Analogue of <VotingFull /> / <BodyFull />.
//
// Sections: Details (type · role · group · place · period · payment) · Holder
// (the member who declared it — link + party / group / chamber) · References &
// source (declaration doc, external url, granting body). An interest is a leaf
// entity (no sub-feeds), so this is the whole detail surface.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import type { InterestClient, PersonClient, BodyClient } from "@/types/opd_db";

import {
    makeT,
    Field,
    Section,
    InternalLink,
    hostLabel,
    formatPeriod,
    LinkValue,
    ExternalLinkField,
    bodyName as getBodyName,
    AttributionFooter,
} from "../opd_micros";

export interface InterestFullProps {
    interest: InterestClient;
    /** The holder (p.id = interest.person_id). */
    person?: PersonClient | undefined;
    /** The granting body (b.id = interest.body_id). */
    body?: BodyClient | undefined;
    /** Pre-built internal href to the holder (/people/:person_id), or null. */
    personHref?: string | null;
    /** Pre-built internal href to the granting body (/bodies/:body_id), or null. */
    bodyHref?: string | null;
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

export function InterestFull({
    interest,
    person,
    body,
    personHref = null,
    bodyHref = null,
    loc = {},
    locale = "de-CH",
    className,
}: InterestFullProps) {
    const t = makeT(loc);

    const period = formatPeriod(
        interest.begin_date,
        interest.end_date,
        locale,
        t,
        "interest",
    );

    const personName = person?.fullname ?? null;
    const party = person?.party ?? null;
    const group = person?.parliamentary_group_name ?? null;

    const bodyName = getBodyName(body, interest.body_key);

    const externalUrl = interest.url ?? null;
    const externalHost = hostLabel(externalUrl);
    const docUrl = interest.declaration_doc_url ?? null;
    const docTitle =
        interest.declaration_doc_title ?? t("interest_declaration");

    return (
        <div className={["space-y-4", className].filter(Boolean).join(" ")}>
            {/* -------------------------------- Details ------------------------------- */}
            <Section title={t("interest_details")} icon="briefcase">
                <Field label={t("interest_type")} value={interest.type} />
                <Field label={t("interest_role")} value={interest.role_name} />
                <Field label={t("interest_group")} value={interest.group} />
                <Field label={t("interest_place")} value={interest.place} />
                <Field label={t("interest_period")} value={period} />
                <Field
                    label={t("facet_payment")}
                    value={interest.type_payment}
                />
            </Section>

            {/* -------------------------------- Holder -------------------------------- */}
            <Section title={t("interest_person")} icon="user">
                <Field label={t("interest_person")}>
                    {personName && personHref ? (
                        <InternalLink to={personHref}>{personName}</InternalLink>
                    ) : personName ? (
                        personName
                    ) : null}
                </Field>
                <Field label={t("party")} value={party} />
                <Field label={t("parliamentary_group")} value={group} />
            </Section>

            {/* ----------------------- References & source ------------------------- */}
            <Section title={t("section_references")} icon="file-text">
                <Field label={t("interest_body")}>
                    {bodyName && bodyHref ? (
                        <InternalLink to={bodyHref}>{bodyName}</InternalLink>
                    ) : bodyName ? (
                        bodyName
                    ) : null}
                </Field>
                <Field label={t("interest_declaration")}>
                    {docUrl ? <LinkValue href={docUrl}>{docTitle}</LinkValue> : null}
                </Field>
                <ExternalLinkField
                    label={t("external_link")}
                    href={externalUrl}
                    linkText={t("official_profile")}
                    host={externalHost}
                />
            </Section>

            <AttributionFooter t={t} />
        </div>
    );
}

export default InterestFull;