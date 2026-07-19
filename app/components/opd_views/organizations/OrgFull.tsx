// components/opd_views/organizations/OrgFull.tsx
//
// Organization overview: the members tied to this organization — one row per
// mandate (person appears once per role), with party colour, granting body, role,
// payment and period. Party colours reuse buildColorMap. Copy via `loc`.

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useParams } from "react-router";
import { InternalLink, makeT, AttributionFooter, SectionCardHeader } from "../opd_micros";
import { peopleHref, bodyHref } from "~/lib/urls/hrefs";
import { buildColorMap } from "../votings/VotingChart";
import { chartCtx } from "../_shared/chart_alt";
import type { Payment } from "../_shared/interestHelpers";

interface Member {
    person_id: number;
    fullname: string | null;
    party: string | null;
    party_key: string | null;
    body_id: number | null;
    body_name: string | null;
    role: string | null;
    payment: Payment;
    begin_date: number | null;
    end_date: number | null;
}

interface Organization {
    key: string;
    name: string | null;
    n_members: number;
    n_mandates: number;
    n_bodies: number;
    n_paid: number;
}

export interface OrgFullProps {
    organization?: Organization;
    members: Member[];
    loc?: Record<string, string>;
    locale?: string;
}

const PAY_COLOR: Record<Payment, string> = {
    paid: "hsl(38 92% 50%)",
    unpaid: "hsl(220 9% 60%)",
    unknown: "hsl(220 9% 40%)",
};
const yr = (e: number | null) => (e == null ? null : new Date(e).getUTCFullYear());
function period(b: number | null, e: number | null): string | null {
    const yb = yr(b);
    const ye = yr(e);
    if (yb == null && ye == null) return null;
    if (yb != null && ye != null) return yb === ye ? `${yb}` : `${yb}–${ye}`;
    return yb != null ? `${yb}–` : `–${ye}`;
}

export default function OrgFull({ organization, members, loc = {}, locale: _locale = "de-CH" }: OrgFullProps) {
    const t = makeT(loc);
    const params = useParams();
    const { colorOf } = React.useMemo(
        () => buildColorMap(members.map((m) => ({ party_key: m.party_key, party: m.party }))),
        [members],
    );

    return (
        <Card>
            <SectionCardHeader
                icon="users"
                title={t("org_members_heading")}
                count={members.length}
            />
            <CardContent>
                {members.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{t("org_no_members")}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <caption className="sr-only">
                                {t("org_members_table_alt", {
                                    count: members.length,
                                    ctx: chartCtx(organization?.name),
                                })}
                            </caption>
                            <thead>
                                <tr className="border-b border-border text-left text-muted-foreground">
                                    <th className="px-2 py-2 font-medium">{t("org_col_member")}</th>
                                    <th className="px-2 py-2 font-medium">{t("org_col_party")}</th>
                                    <th className="px-2 py-2 font-medium">{t("org_col_body")}</th>
                                    <th className="px-2 py-2 font-medium">{t("org_col_role")}</th>
                                    <th className="px-2 py-2 font-medium">{t("org_col_payment")}</th>
                                    <th className="px-2 py-2 text-right font-medium">{t("org_col_period")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((m, i) => (
                                    <tr key={`${m.person_id}-${i}`} className="border-b border-border/50 last:border-0">
                                        <td className="px-2 py-1.5">
                                            <InternalLink to={peopleHref(params.lang, m.person_id)}>
                                                {m.fullname ?? "—"}
                                            </InternalLink>
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf({ party_key: m.party_key, party: m.party }) }} />
                                                {m.party ?? "—"}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-muted-foreground">
                                            {m.body_id != null && m.body_name ? (
                                                <InternalLink to={bodyHref(params.lang, m.body_id)}>{m.body_name}</InternalLink>
                                            ) : (
                                                m.body_name ?? "—"
                                            )}
                                        </td>
                                        <td className="px-2 py-1.5 text-muted-foreground">{m.role ?? "—"}</td>
                                        <td className="px-2 py-1.5">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: PAY_COLOR[m.payment] }} />
                                                {t(`interest_${m.payment}`)}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{period(m.begin_date, m.end_date) ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <AttributionFooter t={t} />
            </CardContent>
        </Card>
    );
}