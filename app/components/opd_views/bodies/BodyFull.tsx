// BodyFull.tsx
//
// Full data panel for a body (parliament / canton / communal institution) —
// rendered ONLY on the body overview page, below <BodyBase />. Analogue of
// <PersonFull />.
//
// Sections: Profile · References & source. Presentational only — the page's
// schema.org GovernmentOrganization structured data is emitted as head JSON-LD
// by the route meta() (metas/body.ts → jsonld/body.ts).
//
// All visible labels come from the `loc` map (Record<string, string>); the
// second arg to t() is the English fallback used when a key is missing.

import * as React from "react";
import type { BodyClient } from "@/types/opd_db";
import { wikidataUrl } from "~/lib/domain/person";

import { makeT, Field, Section, LinkValue } from "../opd_micros";

export interface BodyFullProps {
    body: BodyClient;
    /** Localized label map (e.g. pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

export function BodyFull({
    body,
    loc = {},
    locale = "de-CH",
    className,
}: BodyFullProps) {
    const t = makeT(loc);

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
    const hasParliament =
        body.has_parliament === true
            ? t("facet_yes")
            : body.has_parliament === false
                ? t("facet_no")
                : null;

    return (
        <div className={["space-y-4", className].filter(Boolean).join(" ")}>
            {/* ------------------------------ Profile ------------------------------ */}
            <Section title={t("body_section_profile")} icon="landmark">
                <Field label={t("facet_type")} value={body.type_name} />
                <Field label={t("facet_country")} value={countryLabel} />
                <Field label={t("sort_canton")} value={body.canton_key} />
                <Field label={t("body_has_parliament")} value={hasParliament} />
                <Field label={t("body_languages")} value={body.languages} />
                <Field label={t("sort_population")} value={population} />
                <Field
                    label={t("body_seats_legislative")}
                    value={body.legislative_seats != null ? body.legislative_seats : null}
                />
                <Field label={t("body_executive")} value={body.executive_name} />
                <Field
                    label={t("body_seats_executive")}
                    value={body.executive_seats != null ? body.executive_seats : null}
                />
            </Section>

            {/* ----------------------- References & source ------------------------- */}
            <Section title={t("section_references")} icon="file-text">
                <Field label={t("wikidata")}>
                    {body.wikidata_id ? (
                        <LinkValue href={wikidataUrl(body.wikidata_id)!}>{body.wikidata_id}</LinkValue>
                    ) : null}
                </Field>
                <Field label={t("body_consultations")}>
                    {body.consultations_url ? (
                        <LinkValue href={body.consultations_url}>
                            {t("official_profile")}
                        </LinkValue>
                    ) : null}
                </Field>
                <Field label={t("body_elections_votings")}>
                    {body.elections_and_votings_url ? (
                        <LinkValue href={body.elections_and_votings_url}>
                            {t("official_profile")}
                        </LinkValue>
                    ) : null}
                </Field>
                <Field label={t("body_flag")}>
                    {body.flag_image_url ? (
                        <LinkValue href={body.flag_image_url}>{t("body_flag")}</LinkValue>
                    ) : null}
                </Field>
                <Field label={t("body_key_label")} value={body.body_key} />
                <Field label={t("body_source_lang")} value={body.lang} />
            </Section>
        </div>
    );
}

export default BodyFull;