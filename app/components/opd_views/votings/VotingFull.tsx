// VotingFull.tsx              → ~/components/opd_views/votings/VotingFull.tsx
//
// Full data panel for a voting (a voting EVENT) — rendered ONLY on the
// /votings/:id overview, below <VotingBase />. Analogue of <BodyFull /> /
// <AffairFull />.
//
// Sections: Result (chamber tally + decision + meaning-of-yes/no) · References
// & source (parent affair link, parliament, external url). A voting is a leaf
// entity (no sub-feeds), so this is the whole detail surface.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import type { VotingClient, BodyClient } from "@/types/opd_db";

import { makeT, Field, Section, InternalLink, hostLabel, ExternalLinkField, bodyName as getBodyName } from "../opd_micros";

export interface VotingFullProps {
    voting: VotingClient;
    /** The voting's body (b.id = voting.body_id), for the parliament reference. */
    body?: BodyClient | undefined;
    /** Pre-built internal href to the parent affair (/affairs/:affair_id), or null. */
    affairHref?: string | null;
    /** Pre-built internal href to the body (/bodies/:body_id), or null. */
    bodyHref?: string | null;
    /** Localized label map (e.g. pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

export function VotingFull({
    voting,
    body,
    affairHref = null,
    bodyHref = null,
    loc = {},
    className,
}: VotingFullProps) {
    const t = makeT(loc);

    const bodyName = getBodyName(body, voting.body_key);
    const externalUrl = voting.url_external ?? null;
    const externalHost = hostLabel(externalUrl);

    return (
        <div className={["space-y-4", className].filter(Boolean).join(" ")}>
            {/* -------------------------------- Result -------------------------------- */}
            <Section title={t("voting_result_section")} icon="vote">
                <Field label={t("voting_decision")} value={voting.decision} />
                <Field
                    label={t("result")}
                    value={voting.results_string}
                />
                <Field
                    label={t("tally_yes")}
                    value={voting.results_yes != null ? voting.results_yes : null}
                />
                <Field
                    label={t("tally_no")}
                    value={voting.results_no != null ? voting.results_no : null}
                />
                <Field
                    label={t("tally_abstention")}
                    value={voting.results_abstention != null ? voting.results_abstention : null}
                />
                <Field
                    label={t("tally_absent")}
                    value={voting.results_absent != null ? voting.results_absent : null}
                />
                <Field
                    label={t("voting_meaning_yes")}
                    value={voting.meaning_of_yes}
                />
                <Field
                    label={t("voting_meaning_no")}
                    value={voting.meaning_of_no}
                />
            </Section>

            {/* ----------------------- References & source ------------------------- */}
            <Section title={t("section_references")} icon="file-text">
                <Field label={t("voting_affair")}>
                    {voting.affair_title && affairHref ? (
                        <InternalLink to={affairHref}>{voting.affair_title}</InternalLink>
                    ) : null}
                </Field>
                <Field label={t("facet_body")}>
                    {bodyName && bodyHref ? (
                        <InternalLink to={bodyHref}>{bodyName}</InternalLink>
                    ) : bodyName ? (
                        bodyName
                    ) : null}
                </Field>
                <ExternalLinkField
                    label={t("external_link")}
                    href={externalUrl}
                    linkText={t("official_profile")}
                    host={externalHost}
                />
            </Section>
        </div>
    );
}

export default VotingFull;