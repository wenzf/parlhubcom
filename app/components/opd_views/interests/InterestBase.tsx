// InterestBase.tsx           → ~/components/opd_views/interests/InterestBase.tsx
//
// Compact identity header for a declared interest, rendered at the top of the
// /interests/:id overview. Presentational only — the page's schema.org
// Organization structured data (with the holder modelled as an OrganizationRole
// member → Person) is emitted as head JSON-LD by the route meta()
// (metas/interest.ts → jsonld/interest.ts).
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import type { InterestClient, PersonClient, BodyClient } from "@/types/opd_db";

import { Badge } from "@/components/ui/badge";
import { makeT, MetaItem, EntityHeader, formatPeriod, bodyName as getBodyName } from "../opd_micros";
import { classifyPayment, paymentLabel as makePaymentLabel } from "../_shared/interestHelpers";

export interface InterestBaseProps {
    interest: InterestClient;
    /** The holder (p.id = interest.person_id), for the member line. */
    person?: PersonClient | undefined;
    /** The granting body (b.id = interest.body_id), for the parliament line. */
    body?: BodyClient | undefined;
    loc?: Record<string, string>;
    locale?: string;
    className?: string;
}

export function InterestBase({
    interest,
    person,
    body,
    loc = {},
    locale = "de-CH",
    className,
}: InterestBaseProps) {
    const t = makeT(loc);

    const primary =
        interest.name ??
        interest.name_short ??
        interest.name_abbreviation ??
        t("interest_untitled");
    const role = interest.role_name ?? null;

    const payment = classifyPayment(
        interest.type_payment_harmonized,
        interest.type_payment,
    );
    const paymentLabel = makePaymentLabel(interest.type_payment, payment, t);

    const personName = person?.fullname ?? null;
    const bodyName = getBodyName(body, interest.body_key);
    const period = formatPeriod(
        interest.begin_date,
        interest.end_date,
        locale,
        t,
        "interest",
    );

    return (
        <EntityHeader
            gap="gap-3"
            className={className}
            title={primary}
            trailing={
                <>
                    {role ? (
                        <span className="text-base font-normal text-muted-foreground">
                            {role}
                        </span>
                    ) : null}
                    {paymentLabel ? <Badge variant="secondary">{paymentLabel}</Badge> : null}
                    {interest.ex_officio ? (
                        <Badge variant="outline" className="text-muted-foreground">
                            {t("interest_ex_officio")}
                        </Badge>
                    ) : null}
                </>
            }
            meta={
                (personName || bodyName || period) ? (
                    <>
                        {personName ? (
                            <MetaItem icon="user">{personName}</MetaItem>
                        ) : null}
                        {bodyName ? <MetaItem icon="landmark">{bodyName}</MetaItem> : null}
                        {period ? <MetaItem icon="calendar-range">{period}</MetaItem> : null}
                    </>
                ) : null
            }
        />
    );
}

export default InterestBase;