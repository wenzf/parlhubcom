// BodyBase.tsx
//
// Compact identity header for a body (parliament / canton / communal
// institution). Rendered at the top of every body detail page and on the
// overview page above <BodyFull />. Analogue of <PersonBase />.
//
// Presentational only — the page's schema.org GovernmentOrganization structured
// data is emitted as head JSON-LD by the route meta() (metas/body.ts →
// jsonld/body.ts), not as visible-DOM microdata.
//
// All visible labels come from the `loc` map (Record<string, string>); the
// second arg to t() is the English fallback used when a key is missing.

import type { BodyClient } from "@/types/opd_db";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { makeT, MetaItem, bodyName, codeSuffix } from "../opd_micros";

export interface BodyBaseProps {
    body: BodyClient;
    /** Localized label map (e.g. pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    /** Resolved UI language for date/number formatting. */
    locale?: string;
    className?: string;
}

export function BodyBase({
    body,
    loc = {},
    locale = "de-CH",
    className,
}: BodyBaseProps) {
    const t = makeT(loc);

    const primary = bodyName(body, body.body_key) ?? String(body.id);
    const secondary = body.name && body.name !== primary ? body.name : null;
    const keyRaw = body.body_key ?? null;
    const keySuffix = codeSuffix(keyRaw);

    const typeLabel = body.type_name ?? null; // already localized by SQL loc()
    const flag = body.flag_image_url ?? body.flag_image_oparl_url ?? undefined;

    const canton = body.canton_key ?? null;
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
    const seats =
        typeof body.legislative_seats === "number" ? body.legislative_seats : null;
    const hasParliament = body.has_parliament === true;

    return (
        <header
            className={["flex flex-col gap-4 sm:flex-row sm:items-start", className]
                .filter(Boolean)
                .join(" ")}
        >
            <Avatar className="size-20 !rounded-sm border sm:size-24">
                {flag ? (
                    <AvatarImage src={flag} alt={primary} className="!rounded-sm object-contain" />
                ) : null}
                <AvatarFallback className="!rounded-sm text-lg font-medium">
                    {(canton ?? keyRaw ?? primary).slice(0, 2).toUpperCase() || "–"}
                </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-2">
                {/* Name + type + parliament status */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 className="text-2xl font-semibold leading-tight tracking-tight">
                        {primary}
                    </h1>
                    {secondary ? (
                        <span className="text-lg text-muted-foreground">{secondary}</span>
                    ) : null}
                    {keySuffix ? (
                        <span className="text-sm text-muted-foreground">({keySuffix})</span>
                    ) : null}
                    {typeLabel ? <Badge variant="secondary">{typeLabel}</Badge> : null}
                    {hasParliament ? (
                        <Badge variant="outline" className="text-muted-foreground">
                            {t("facet_has_parliament")}
                        </Badge>
                    ) : null}
                </div>

                {/* Location + scale facts */}
                {(countryLabel || canton || population || seats != null) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {countryLabel ? (
                            <MetaItem icon="globe">{countryLabel}</MetaItem>
                        ) : null}
                        {canton ? <MetaItem icon="map-pin">{canton}</MetaItem> : null}
                        {population ? (
                            <MetaItem icon="users">
                                {population} {t("body_population")}
                            </MetaItem>
                        ) : null}
                        {seats != null ? (
                            <MetaItem icon="landmark">
                                {seats} {t("body_seats")}
                            </MetaItem>
                        ) : null}
                    </div>
                )}
            </div>
        </header>
    );
}

export default BodyBase;