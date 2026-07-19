// AffairBase.tsx
//
// Compact identity header for an affair (a parliamentary business item:
// motion, postulate, interpellation, …). Rendered at the top of the affair
// overview page above <AffairFull />. Analogue of <BodyBase /> / <PersonBase />.
//
// Presentational only — the page's schema.org Legislation structured data is
// emitted as head JSON-LD by the route meta() (metas/affair.ts →
// jsonld/affair.ts), not as visible-DOM microdata.
//
// All visible labels come from the `loc` map (Record<string, string>); the
// second arg to t() is the English fallback used when a key is missing.

import type { AffairClient, BodyClient } from "@/types/opd_db";

import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, EntityHeader, formatPeriod, bodyName as getBodyName, codeSuffix } from "../opd_micros";

export interface AffairBaseProps {
    affair: AffairClient;
    /** The affair's linked body (b.id = affair.body_id), resolved by the loader. */
    body?: BodyClient | undefined;
    /** Localized label map (e.g. pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    /** Resolved UI language for date/number formatting. */
    locale?: string;
    className?: string;
}

export function AffairBase({
    affair,
    body,
    loc = {},
    locale = "de-CH",
    className,
}: AffairBaseProps) {
    const t = makeT(loc);

    const primary =
        affair.title ?? affair.title_long ?? t("affair_untitled");
    const number = affair.number ?? null;

    const typeLabel = affair.type_name ?? affair.type_harmonized ?? null; // localized by SQL
    const stateLabel = affair.state_name ?? affair.state_name_harmonized ?? null;
    const period = formatPeriod(
        affair.begin_date ?? null,
        affair.end_date ?? null,
        locale,
    );
    // Linked body (b.id = affair.body_id): legislative_name, name, (canton_key when
    // it's a real code). Falls back to the affair's raw body_key.
    const bodyName = getBodyName(body);
    const bodySecondary = body?.name && body.name !== bodyName ? body.name : null;
    const cantonKey = body?.canton_key ?? null;
    const cantonSuffix = codeSuffix(cantonKey);
    const bodyDisplay = bodyName ?? affair.body_key ?? null;

    return (
        <EntityHeader
            gap="gap-2"
            className={className}
            title={primary}
            trailing={
                <>
                    {number ? (
                        <span className="text-sm text-muted-foreground">({number})</span>
                    ) : null}
                    {typeLabel ? <Badge variant="secondary">{typeLabel}</Badge> : null}
                    {stateLabel ? (
                        <Badge variant="outline" className="text-muted-foreground">
                            {stateLabel}
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
                                        {bodySecondary ? <span> {bodySecondary}</span> : null}
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

export default AffairBase;