// VotingBase.tsx              → ~/components/opd_views/votings/VotingBase.tsx
//
// Compact identity header for a voting (a voting EVENT), rendered at the top of
// the /votings/:id overview, above <VotingFull />. Analogue of <BodyBase /> /
// <AffairBase />, but a voting has no clean schema.org type, so this component
// emits no structured data — it is purely presentational (the overview route
// wraps it in a plain container; see votings_id_overview.tsx).
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import type { VotingClient, BodyClient } from "@/types/opd_db";
import { formatEpoch } from "~/lib/domain/person";

import { Badge } from "@/components/ui/badge";
import { makeT, MetaItem, EntityHeader, bodyName as getBodyName, codeSuffix } from "../opd_micros";

export interface VotingBaseProps {
    voting: VotingClient;
    /** The voting's body (b.id = voting.body_id), for the parliament line. */
    body?: BodyClient | undefined;
    /** Localized label map (e.g. pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    /** Resolved UI language for date/number formatting. */
    locale?: string;
    className?: string;
}

export function VotingBase({
    voting,
    body,
    loc = {},
    locale = "de-CH",
    className,
}: VotingBaseProps) {
    const t = makeT(loc);

    const primary = voting.title ?? t("voting_untitled");
    const typeLabel = voting.type ?? null;
    const decision = voting.decision ?? null;
    const date = formatEpoch(voting.date ?? null, locale);

    const bodyName = getBodyName(body, voting.body_key);
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);

    // Group next to the body name, e.g. "Switzerland Nationalrat (NR)".
    const groupName = voting.group_name ?? null;
    const groupLabel =
        groupName && voting.group_abbreviation && voting.group_abbreviation !== groupName
            ? `${groupName} (${voting.group_abbreviation})`
            : (groupName ?? voting.group_abbreviation ?? null);

    return (
        <EntityHeader
            gap="gap-3"
            className={className}
            title={primary}
            trailing={
                <>
                    {typeLabel ? <Badge variant="secondary">{typeLabel}</Badge> : null}
                    {decision ? (
                        <Badge variant="outline" className="text-muted-foreground">
                            {decision}
                        </Badge>
                    ) : null}
                </>
            }
            meta={
                (bodyName || date) ? (
                    <>
                        {bodyName ? (
                            <MetaItem icon="landmark">
                                <span>{bodyName}</span>
                                {groupLabel ? <span> {groupLabel}</span> : null}
                                {cantonSuffix ? <span> ({cantonSuffix})</span> : null}
                            </MetaItem>
                        ) : null}
                        {date ? <MetaItem icon="calendar-days">{date}</MetaItem> : null}
                    </>
                ) : null
            }
        />
    );
}

export default VotingBase;