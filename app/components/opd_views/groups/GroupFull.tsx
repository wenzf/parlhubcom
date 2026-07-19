// GroupFull.tsx
//
// Full data panel for a group (a parliamentary group / faction / committee) —
// rendered ONLY on the group overview page, below <GroupBase />. Analogue of
// <AffairFull /> / <BodyFull />.
//
// Sections: Profile · References & source. Presentational only — the page's
// schema.org Organization structured data is emitted as head JSON-LD by the
// route meta() (metas/group.ts → jsonld/group.ts).

import * as React from "react";
import type { GroupClient, BodyClient } from "@/types/opd_db";
import { formatEpoch } from "~/lib/domain/person";
import { sanitize } from "~/lib/security/sanitize";

import { InternalLink, makeT, Field, Section, ExternalLinkField, bodyName as getBodyName, codeSuffix } from "../opd_micros";

export interface GroupFullProps {
    group: GroupClient;
    /** The group's linked body (b.id = group.body_id), resolved by the loader. */
    body?: BodyClient | undefined;
    /** Internal link to the body overview (localizedPath), when resolvable. */
    bodyHref?: string | undefined;
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

export function GroupFull({
    group,
    body,
    bodyHref,
    loc = {},
    locale = "de-CH",
    className,
}: GroupFullProps) {
    const t = makeT(loc);

    const bodyName = getBodyName(body);
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);
    const bodyText = bodyName
        ? [bodyName, cantonSuffix ? `(${cantonSuffix})` : null].filter(Boolean).join(" ")
        : (group.body_key ?? null);

    const begin =
        typeof group.begin_date === "number" ? formatEpoch(group.begin_date, locale) : null;
    const end =
        typeof group.end_date === "number" ? formatEpoch(group.end_date, locale) : null;
    const active =
        group.active === true
            ? t("facet_yes")
            : group.active === false
                ? t("facet_no")
                : null;

    // group.description may contain HTML markup → sanitize before injecting.
    const cleanDescription = React.useMemo(
        () => (group.description ? sanitize(group.description) : ""),
        [group.description],
    );

    return (
        <div className={["space-y-4", className].filter(Boolean).join(" ")}>
            {/* ------------------------------ Profile ------------------------------ */}
            <Section title={t("body_section_profile")} icon="users-2">
                <Field label={t("group_abbreviation")} value={group.abbreviation} />
                <Field
                    label={t("facet_type")}
                    value={group.type_harmonized ?? group.type_external}
                />
                <Field label={t("group_description")}>
                    {cleanDescription ? (
                        <div
                            className="opd-richtext"
                            lang={group.description_lang ?? undefined}
                            suppressHydrationWarning
                            dangerouslySetInnerHTML={{ __html: cleanDescription }}
                        />
                    ) : null}
                </Field>
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
                <Field label={t("sort_begin_date")} value={begin} />
                <Field label={t("sort_end_date")} value={end} />
                <Field label={t("facet_active")} value={active} />
            </Section>

            {/* ----------------------- References & source ------------------------- */}
            <Section title={t("section_references")} icon="newspaper">
                <ExternalLinkField
                    label={t("group_official_record")}
                    href={group.url_external}
                    linkText={t("official_profile")}
                />
                <Field label={t("group_contact")} value={group.contact} />
                <Field label={t("affair_external_id")} value={group.external_id} />
            </Section>
        </div>
    );
}

export default GroupFull;