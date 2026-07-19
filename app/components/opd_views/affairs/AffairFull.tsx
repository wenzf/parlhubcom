// AffairFull.tsx
//
// Full data panel for an affair (parliamentary business item) — rendered ONLY
// on the affair overview page, below <AffairBase />. Analogue of <BodyFull /> /
// <PersonFull />.
//
// Sections: Profile · References & source. Presentational only — the page's
// schema.org Legislation structured data is emitted as head JSON-LD by the route
// meta() (metas/affair.ts → jsonld/affair.ts).
//
// All visible labels come from the `loc` map (Record<string, string>); the
// second arg to t() is the English fallback used when a key is missing.

import * as React from "react";
import type { AffairClient, BodyClient, AgendaClient } from "@/types/opd_db";
import { formatEpoch } from "~/lib/domain/person";

import { InternalLink, makeT, Field, Section, ExternalLinkField, bodyName as getBodyName, codeSuffix } from "../opd_micros";

export interface AffairFullProps {
    affair: AffairClient;
    /** The affair's linked body (b.id = affair.body_id), resolved by the loader. */
    body?: BodyClient | undefined;
    /** Internal link to the body overview (localizedPath), when resolvable. */
    bodyHref?: string | undefined;
    /** Agenda items linked to this affair (agendas.item_affair_id = affair.id). */
    agendas?: AgendaClient[] | undefined;
    /** Localized label map (e.g. pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

export function AffairFull({
    affair,
    body,
    bodyHref,
    agendas,
    loc = {},
    locale = "de-CH",
    className,
}: AffairFullProps) {
    const t = makeT(loc);

    const agendaItems = agendas ?? [];

    // Linked body display: "legislative_name name (canton_key)" — fall back to the
    // affair's raw body_key when no body was resolved.
    const bodyName = getBodyName(body);
    const bodySecondary = body?.name && body.name !== bodyName ? body.name : null;
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);
    const bodyText = bodyName
        ? [bodyName, bodySecondary, cantonSuffix ? `(${cantonSuffix})` : null]
            .filter(Boolean)
            .join(" ")
        : (affair.body_key ?? null);

    const begin =
        typeof affair.begin_date === "number" ? formatEpoch(affair.begin_date, locale) : null;
    const end =
        typeof affair.end_date === "number" ? formatEpoch(affair.end_date, locale) : null;
    const active =
        affair.active === true
            ? t("facet_yes")
            : affair.active === false
                ? t("facet_no")
                : null;
    const longTitle =
        affair.title_long && affair.title_long !== affair.title ? affair.title_long : null;

    return (
        <div className={["space-y-4", className].filter(Boolean).join(" ")}>
            {/* ------------------------------ Profile ------------------------------ */}
            <Section title={t("body_section_profile")} icon="file-text">
                <Field label={t("affair_long_title")} value={longTitle} />
                <Field label={t("facet_type")} value={affair.type_name ?? affair.type_harmonized} />
                <Field label={t("facet_state")} value={affair.state_name ?? affair.state_name_harmonized} />
                <Field label={t("parliament")}>
                    {bodyText ? (
                        bodyHref ? (
                            <InternalLink to={bodyHref}>
                                {bodyText}
                            </InternalLink>
                        ) : (
                            bodyText
                        )
                    ) : null}
                </Field>
                <Field label={t("affair_number")} value={affair.number} />
                <Field label={t("sort_begin_date")} value={begin} />
                <Field label={t("sort_end_date")} value={end} />
                <Field label={t("facet_active")} value={active} />
            </Section>

            {/* ----------------------- References & source ------------------------- */}
            <Section title={t("section_references")} icon="newspaper">
                <ExternalLinkField
                    label={t("affair_official_record")}
                    href={affair.url_external}
                    linkText={t("official_profile")}
                />
                <Field label={t("affair_external_id")} value={affair.external_id} />
            </Section>

            {/* --------------------------- Agenda items ---------------------------- */}
            {agendaItems.length > 0 ? (
                <Section
                    title={t("affair_agenda_section")}
                    icon="list-ordered"
                >
                    <ul className="divide-y divide-border/60">
                        {agendaItems.map((ag) => {
                            const title =
                                ag.item_title ??
                                ag.item_number_display ??
                                ag.item_affair_number ??
                                t("speech_agenda");
                            const date =
                                typeof ag.item_date === "number"
                                    ? formatEpoch(ag.item_date, locale)
                                    : null;
                            return (
                                <li key={ag.id} className="py-2">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-snug">
                                        {ag.item_url ? (
                                            <a
                                                href={ag.item_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary underline-offset-4 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                            >
                                                {title}
                                            </a>
                                        ) : (
                                            <span>{title}</span>
                                        )}
                                        {ag.item_number_display ? (
                                            <span className="text-xs text-muted-foreground">
                                                ({ag.item_number_display})
                                            </span>
                                        ) : null}
                                    </div>
                                    {(date || ag.item_status || ag.item_result || ag.body_key) && (
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                            {ag.body_key ? <span>{ag.body_key}</span> : null}
                                            {date ? <span>{date}</span> : null}
                                            {ag.item_status ? <span>{ag.item_status}</span> : null}
                                            {ag.item_result ? <span>{ag.item_result}</span> : null}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </Section>
            ) : null}
        </div>
    );
}

export default AffairFull;