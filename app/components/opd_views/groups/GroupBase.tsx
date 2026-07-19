// GroupBase.tsx
//
// Compact identity header for a group (a parliamentary group / faction /
// committee). Rendered at the top of the group overview + feed routes (owned by
// the groups layout) above the page content. Analogue of <AffairBase /> /
// <BodyBase />.
//
// Presentational only — the page's schema.org Organization structured data is
// emitted as head JSON-LD by the route meta() (metas/group.ts →
// jsonld/group.ts), not as visible-DOM microdata.

import type { GroupClient, BodyClient } from "@/types/opd_db";

import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, EntityHeader, formatPeriod, bodyName as getBodyName, codeSuffix } from "../opd_micros";

export interface GroupBaseProps {
    group: GroupClient;
    /** The group's linked body (b.id = group.body_id), resolved by the loader. */
    body?: BodyClient | undefined;
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

export function GroupBase({
    group,
    body,
    loc = {},
    locale = "de-CH",
    className,
}: GroupBaseProps) {
    const t = makeT(loc);

    const primary =
        group.name ?? group.abbreviation ?? t("group_untitled");
    const abbr =
        group.abbreviation && group.abbreviation !== primary
            ? group.abbreviation
            : null;
    const typeLabel = group.type_harmonized ?? group.type_external ?? null;
    const period = formatPeriod(
        group.begin_date ?? null,
        group.end_date ?? null,
        locale,
    );

    const bodyName = getBodyName(body);
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);
    const bodyDisplay = bodyName ?? group.body_key ?? null;

    return (
        <EntityHeader
            gap="gap-2"
            className={className}
            title={primary}
            trailing={
                <>
                    {abbr ? (
                        <span className="text-sm text-muted-foreground">({abbr})</span>
                    ) : null}
                    {typeLabel ? <Badge variant="secondary">{typeLabel}</Badge> : null}
                    {group.active === false ? (
                        <Badge variant="outline" className="text-muted-foreground">
                            {t("facet_no")}
                        </Badge>
                    ) : null}
                </>
            }
            meta={
                (bodyDisplay || period) ? (
                    <>
                        {bodyDisplay ? (
                            <MetaItem icon="landmark">
                                {bodyName ? (
                                    <>
                                        <span>{bodyName}</span>
                                        {cantonSuffix ? <span> ({cantonSuffix})</span> : null}
                                    </>
                                ) : (
                                    bodyDisplay
                                )}
                            </MetaItem>
                        ) : null}
                        {period ? <MetaItem icon="calendar-range">{period}</MetaItem> : null}
                    </>
                ) : null
            }
        />
    );
}

export default GroupBase;
