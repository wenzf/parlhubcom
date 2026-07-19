// components/opd_views/organizations/OrgBase.tsx
//
// Compact header for an organization detail page: name + roll-up stat chips
// (members / mandates / paid / bodies). Rendered once by
// organizations_result_layout above the overview. Presentational; copy via `loc`.

import * as React from "react";
import { makeT, StatCount } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";

interface Organization {
    key: string;
    name: string | null;
    n_members: number;
    n_mandates: number;
    n_bodies: number;
    n_paid: number;
}

export interface OrgBaseProps {
    organization: Organization;
    loc?: Record<string, string>;
}

export default function OrgBase({ organization, loc = {} }: OrgBaseProps) {
    const t = makeT(loc);
    return (
        <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Icon name="share-2" className="size-5 text-muted-foreground" />
                <h1 className="text-2xl font-semibold leading-tight tracking-tight">
                    {organization.name ?? "—"}
                </h1>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <StatCount n={organization.n_members} label={t("org_members")} />
                <StatCount n={organization.n_mandates} label={t("org_mandates")} />
                {organization.n_paid > 0 ? <StatCount n={organization.n_paid} label={t("interest_paid")} /> : null}
                <StatCount n={organization.n_bodies} label={t("org_bodies")} />
            </div>
        </header>
    );
}