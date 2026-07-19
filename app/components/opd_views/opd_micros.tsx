// opd_micros.tsx
//
// Small shared UI micros + helpers for the person detail components
// (<PersonBase />, <PersonFull />, and the dimension list components).
// Keep these presentational and dependency-light. Icons come from the shared
// sprite in ./opd_icons (mount <IconSprite /> once at the app root).

import * as React from "react";
import { NavLink, useSearchParams, type To } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEpoch } from "~/lib/domain/person";
import { Icon, type IconName } from "../icons/opd_icons";
import { cn } from "~/lib/std/cn";
import { safeHref } from "~/lib/security/safe_href";
import { MethodologyLink } from "./_shared/MethodologyLink";

/* -------------------------------- labels (loc) ---------------------------- */

// The loc helper lives in ~/lib/lang (shared across generic + data views).
// Imported for local use here and re-exported so the many opd_views call sites
// keep their existing import.
import { makeT, type TFunc } from "~/lib/lang";
export { makeT, type TFunc };

/* ------------------------------ identity / links -------------------------- */

/** Internal path to a person's full dimension feed (the "page" route), e.g.
 *  `feedPath(42, "votes")` → `/people/42/votes`. */
export const feedPath = (
    id: number | string,
    dimension: string,
): string => `/people/${id}/${dimension}`;

/** The canonical internal (in-app) link for table / list rows and detail
 *  panels. Renders a trailing right-arrow and a single unified treatment:
 *  weight (`font-medium`), colour (`text-primary`), hover (underline) and
 *  keyboard focus (visible ring). The link flows as normal inline text and the
 *  arrow is an inline glyph (not a flex sibling), so on a text line-break the
 *  arrow follows the last word instead of pinning to the right edge. Pass
 *  `className` to add layout utilities (e.g. `truncate`, `min-w-0`) — it is
 *  merged, so the unified visual classes win on conflict. */
export const INTERNAL_LINK_CLASS =
    "font-medium text-primary underline-offset-4 rounded-sm hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function InternalLink({
    to,
    className,
    children,
}: {
    to: string;
    className?: string;
    children: React.ReactNode;
}) {
    // NavLink (not Link) so a link pointing at the current page gets aria-current;
    // `end` keeps that exact-match only (a content link to /people shouldn't read as
    // current on /people/42). `viewTransition` opts every internal navigation into
    // the cross-fade — neutralized under prefers-reduced-motion in css/base.css.
    return (
        <NavLink
            to={to}
            end
            viewTransition
            className={cn(INTERNAL_LINK_CLASS, className)}
        >
            {children}
            <Icon name="arrow-right" className="ml-1 inline-block size-3.5 shrink-0 align-middle" />
        </NavLink>
    );
}

/** External link value (opens in a new tab) with a trailing external-link glyph.
 *  The unified "value is a link off-site" primitive used by every <*Full />
 *  detail panel (declaration docs, source URLs, official pages, …). The href is
 *  data-derived, so it passes `safeHref` (scheme allowlist); a disallowed URL
 *  renders the children as plain text instead of a link. */
export function LinkValue({
    href,
    children,
}: {
    href: string;
    children: React.ReactNode;
}) {
    const safe = safeHref(href);
    if (safe === undefined) {
        return (
            <span className="inline-flex items-center gap-1 font-medium">
                {children}
            </span>
        );
    }
    return (
        <a
            href={safe}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 rounded-sm hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
            {children} <Icon name="external-link" className="size-3" />
        </a>
    );
}

/** External link ACTION (leading type icon + label + trailing external glyph),
 *  opens in a new tab. Used by feed rows that expose an off-site artefact —
 *  e.g. a speech's source document / audio / video. Data-derived href, so it
 *  passes `safeHref`; a disallowed URL renders icon + label as plain text. */
export function ExternalAction({
    icon,
    href,
    children,
}: {
    icon: IconName;
    href: string;
    children: React.ReactNode;
}) {
    const safe = safeHref(href);
    if (safe === undefined) {
        return (
            <span className="inline-flex items-center gap-1 font-medium">
                <Icon name={icon} className="size-3.5 shrink-0" />
                {children}
            </span>
        );
    }
    return (
        <a
            href={safe}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 rounded-sm hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
            <Icon name={icon} className="size-3.5 shrink-0" />
            {children}
            <Icon name="external-link" className="size-3 shrink-0" />
        </a>
    );
}

/** A single linked-entity card: internal (react-router <NavLink>) or external
 *  (<a>). Whole-card link with a leading type icon, title, optional subtitle,
 *  and a trailing arrow (internal) / external-link (external) glyph. Shared by
 *  the <*Full /> detail panels (DocFull, SpeechFull, …). */
export function LinkedItem({
    icon,
    title,
    subtitle,
    href,
    external,
}: {
    icon: IconName;
    title: string;
    subtitle?: React.ReactNode;
    href: string;
    external?: boolean;
}) {
    const inner = (
        <>
            <Icon name={icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium leading-snug text-primary underline-offset-4 group-hover:underline">
                    {title}
                </div>
                {subtitle ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {subtitle}
                    </div>
                ) : null}
            </div>
            <Icon
                name={external ? "external-link" : "arrow-right"}
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            />
        </>
    );
    const cls =
        "group flex items-start gap-2 rounded-md border p-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
    if (!external) {
        return (
            <NavLink to={href} end viewTransition className={cls}>
                {inner}
            </NavLink>
        );
    }
    // External hrefs are data-derived: scheme-allowlist them, and render the
    // card non-interactive when the URL is disallowed.
    const safe = safeHref(href);
    if (safe === undefined) {
        return <div className="flex items-start gap-2 rounded-md border p-3">{inner}</div>;
    }
    return (
        <a href={safe} target="_blank" rel="noopener noreferrer" className={cls}>
            {inner}
        </a>
    );
}

/** A titled section: a small muted label above its children, separated by a top
 *  border. Used by the <*Full /> detail panels to head each linked-entity block. */
export function Labelled({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="border-t pt-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
            {children}
        </div>
    );
}

/** A stacked field label: a small muted caption above its value. The shared
 *  version of the `Labeled` helper that was copied across the chart panels
 *  (BodyAlignment / BodyLobby / BodyLoyalty). NB: distinct from `Labelled`
 *  (double-l), which is a bordered section header used by the <*Full /> panels. */
export function Labeled({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

/** A single roll-up metric: a tabular-nums count followed by a muted label
 *  (e.g. "12 members"). The shared version of the `Chip` (OrgBase) / `Stat`
 *  (OrganizationsList) helpers, which rendered the same data two different ways. */
export function StatCount({ n, label }: { n: number; label: string }) {
    return (
        <span className="inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums">
            {n} <span className="text-xs text-muted-foreground">{label}</span>
        </span>
    );
}

/** The shared compact header for an entity detail page (`<*Base />`): a
 *  `flex flex-col` `<header>` with a `text-2xl` `<h1>` + trailing badges, and an
 *  optional muted meta-row beneath. The single version of the header skeleton
 *  copied across AffairBase / GroupBase / VotingBase / InterestBase / MeetingBase.
 *  - `trailing` → nodes after the `<h1>` (number/abbr span, type/state badges).
 *  - `meta`     → the meta-row content (MetaItems); the row is omitted when null. */
export function EntityHeader({
    title,
    trailing,
    meta,
    gap = "gap-3",
    className,
}: {
    title: React.ReactNode;
    trailing?: React.ReactNode;
    meta?: React.ReactNode;
    gap?: string | undefined;
    className?: string | undefined;
}) {
    return (
        <header className={cn("flex flex-col", gap, className)}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-2xl font-semibold leading-tight tracking-tight">
                    {title}
                </h1>
                {trailing}
            </div>
            {meta ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {meta}
                </div>
            ) : null}
        </header>
    );
}

/** The standard section-card header: `<CardHeader className="pb-3">` + a
 *  `flex items-center gap-2 text-base` `<CardTitle>` with a leading icon, the
 *  title, and optional trailing bits. The single shared version of the header
 *  copied across the chart / detail cards (BodyLoyalty, PersonTopics, OrgFull,
 *  …); the feed/list chrome (FeedShell) keeps its own inline copy.
 *  - `count`  → a muted `(N)` after the title (shown only when > 0).
 *  - `suffix` → an inline node after the title, e.g. `· {bodyTitle}`.
 *  - `action` → trailing controls (the caller adds `ml-auto` on the first one).
 *  - `subtitle` → a muted `<p>` under the title. */
export function SectionCardHeader({
    icon,
    iconClassName = "size-4 text-muted-foreground",
    title,
    count,
    suffix,
    action,
    subtitle,
    subtitleClassName = "text-sm text-muted-foreground",
}: {
    icon: IconName;
    iconClassName?: string;
    title: React.ReactNode;
    count?: number | null;
    suffix?: React.ReactNode;
    action?: React.ReactNode;
    subtitle?: React.ReactNode;
    subtitleClassName?: string;
}) {
    return (
        <CardHeader className="pb-3">
            {/* flex-wrap so a long title (some languages run wider) drops the trailing
          `action` (e.g. Edit & export) onto its own line instead of squeezing it. */}
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-2 text-base">
                {/* The visible card title is the section's heading (h2, under the page
            h1); `action` (e.g. an export menu) stays a sibling so no interactive
            control lands inside the heading. */}
                <h2 className="flex items-center gap-2">
                    <Icon name={icon} className={iconClassName} />
                    {title}
                    {count != null && count > 0 ? (
                        <span className="text-sm font-normal text-muted-foreground">
                            ({count})
                        </span>
                    ) : null}
                    {suffix}
                </h2>
                {action}
            </CardTitle>
            {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
        </CardHeader>
    );
}

/** Data-source + licence attribution line (OpenParlData · CC BY 4.0). The single
 *  footer shared by every catalogue / feed / detail panel. `t` supplies the
 *  localized "Data" label; pass `className` to override the default spacing
 *  (the compact detail-panel variant drops the leading `mt-4`). Pass `anchor` to
 *  carry the computed-metric `{ } Methodology` deep-link on this same bottom row
 *  (pushed to the trailing edge) instead of up in the card header. */
export function AttributionFooter({
    t,
    anchor,
    className = "mt-4 border-t pt-3 text-xs text-muted-foreground",
}: {
    t: TFunc;
    anchor?: string | undefined;
    className?: string;
}) {
    const attribution = (
        <>
            {t("data_source")}:{" "}
            <a
                href="https://openparldata.ch/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                OpenParlData
            </a>{" "}
            ·{" "}
            <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="license noopener noreferrer"
                className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                CC BY 4.0
            </a>
        </>
    );

    if (!anchor) {
        return <p className={className}>{attribution}</p>;
    }

    return (
        <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-1", className)}>
            <p>{attribution}</p>
            <MethodologyLink anchor={anchor} />
        </div>
    );
}

/* --------------------------- response-scoped lookups ---------------------- */

/** Index a response-scoped lookup array (`{ id, … }[]`) into a `Map` keyed by
 *  `id`, for O(1) client-side joins against a row's foreign key. The canonical
 *  helper for the "linked items" pattern (bodies/affairs/persons lookups on a
 *  feed slice). Usage: `const bodyById = keyById(data.bodies?.items);`. */
export function keyById<T extends { id: number }>(rows?: T[]): Map<number, T> {
    const m = new Map<number, T>();
    for (const r of rows ?? []) m.set(r.id, r);
    return m;
}

/* ---------------------------------- body ---------------------------------- */

/** Display name for a linked body: `legislative_name` → `name` → the first
 *  non-nullish `fallback` (e.g. the row's raw `body_key` or `String(id)`) → null.
 *  The canonical form of the `body?.legislative_name ?? body?.name ?? …` idiom
 *  that was copied across every *Base / *Full / list row. */
export function bodyName(
    body:
        | { legislative_name?: string | null; name?: string | null }
        | null
        | undefined,
    ...fallbacks: (string | null | undefined)[]
): string | null {
    return (
        body?.legislative_name ??
        body?.name ??
        fallbacks.find((f) => f != null) ??
        null
    );
}

/** A short code shown as a suffix after a body name (e.g. a canton "ZH"), but
 *  only when the key is a real code — purely-numeric ids are suppressed. */
export function codeSuffix(key: string | null | undefined): string | null {
    return key && !/^\d+$/.test(key) ? key : null;
}

/* -------------------------------- pagination ------------------------------ */

/** Build a pager `to` that sets `pageParam` to `offset` while preserving every
 *  other search param — and DROPS the param entirely for the first page
 *  (offset ≤ 0), so page 1 gets a clean `/people/:id/votes` URL rather than
 *  `?offset=0`. Returns a `To` so the empty-search case clears the query string.
 *  Usage: `const pagerTo = usePagerHref(pageParam);  pagerTo(prevOffset)`. */
export function usePagerHref(pageParam: string): (offset: number) => To {
    const [searchParams] = useSearchParams();
    return (offset: number): To => {
        const next = new URLSearchParams(searchParams);
        if (offset <= 0) next.delete(pageParam);
        else next.set(pageParam, String(offset));
        const search = next.toString();
        return { search: search ? `?${search}` : "" };
    };
}

/** Prev/Next pager control. Renders a non-interactive span when `disabled`,
 *  otherwise a view-transitioned <NavLink> that doesn't reset scroll. */
export function PagerLink({
    disabled,
    to,
    rel,
    children,
}: {
    disabled: boolean;
    to: To;
    rel: "prev" | "next";
    children: React.ReactNode;
}) {
    const cls =
        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm";
    if (disabled) {
        return (
            <span
                aria-disabled="true"
                className={`${cls} cursor-not-allowed text-muted-foreground opacity-50`}
            >
                {children}
            </span>
        );
    }
    return (
        <NavLink
            viewTransition
            to={to}
            rel={rel}
            className={`${cls} text-foreground underline-offset-4 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
            preventScrollReset
        >
            {children}
        </NavLink>
    );
}

/* --------------------------------- dates ---------------------------------- */

/** ISO date (UTC) for a `<time dateTime>`, from an epoch-millis number. */
export function isoOf(ms: number | null | undefined): string | undefined {
    if (ms == null) return undefined;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/** Format a date span from two epoch-millis bounds, for the active locale.
 *
 *  • Both bounds → "X – Y" (collapsed to "X" when identical).
 *  • One bound, no `prefix` → that single date.
 *  • One bound, with `prefix` → a localized "since X" / "until Y" using the
 *    `${prefix}_since` / `${prefix}_until` loc keys (e.g. "membership",
 *    "interest", "image", "badge").
 *  • Neither bound → null.
 *
 *  Pass `prefix` for open-ended records that should read "since …/until …";
 *  omit it for a plain range. */
export function formatPeriod(
    begin: number | null | undefined,
    end: number | null | undefined,
    locale: string,
    t?: TFunc,
    prefix?: string,
): string | null {
    const b = formatEpoch(begin, locale);
    const e = formatEpoch(end, locale);
    if (b && e) return b === e ? b : `${b} – ${e}`;
    if (!prefix) return b ?? e ?? null;
    const tr: TFunc = t ?? ((k) => k);
    if (b) return `${tr(`${prefix}_since`)} ${b}`;
    if (e) return `${tr(`${prefix}_until`)} ${e}`;
    return null;
}

/* ------------------------------- primitives ------------------------------- */

/** The left "chip" column shared by every dimension row — a fixed-width column
 *  from `sm` up, stacked above the row body on narrow screens. Always wraps long
 *  tokens (`break-words hyphens-auto`) so long German compound type words break
 *  instead of overflowing the column; pass `lang` (the locale) for correct
 *  hyphenation. `tone` overrides the default muted color (e.g. the vote-outcome
 *  palette). `block w-full` fills the fixed column, so a caller that places a Chip
 *  outside one must bound the width itself (the rows use `justify-self-start`
 *  while stacked) — left to stretch, it spans the whole row. */
const CHIP_BASE =
    "block w-full break-words hyphens-auto rounded-md border px-2 py-1 text-center text-xs font-medium leading-tight";

export function Chip({
    tone,
    lang,
    children,
}: {
    tone?: string;
    lang?: string;
    children: React.ReactNode;
}) {
    return (
        <span
            lang={lang}
            className={`${CHIP_BASE} ${tone ?? "border-border bg-muted text-muted-foreground"}`}
        >
            {children}
        </span>
    );
}

/** One inline meta fact (icon + text), e.g. in a sub-header or list row. */
export function MetaItem({
    icon,
    children,
}: {
    icon: IconName;
    children: React.ReactNode;
}) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <Icon name={icon} className="size-3.5 shrink-0 text-muted-foreground" />
            {children}
        </span>
    );
}

/** A <dt>/<dd> row. Renders nothing when the value is empty. */
export function Field({
    label,
    value,
    children,
}: {
    label: string;
    value?: string | number | null | undefined;
    children?: React.ReactNode;
}) {
    const content = children ?? (value != null && value !== "" ? String(value) : null);
    if (content == null) return null;
    return (
        <div className="grid grid-cols-[minmax(8rem,9rem)_1fr] gap-x-4 gap-y-1 py-1.5">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            {/* min-w-0 lets the value column shrink below its content; overflow-x-auto
          then scrolls an unbreakable value (long email / URL) instead of forcing
          the whole page to overflow on narrow screens. overflow-x-auto clips on
          both axes, so `p-1 -m-1` gives the scroll box room for a focused link's
          ring on every side — top/bottom, and the left edge of a link sitting
          flush at x=0 (the References panel's Wikidata/flag links) — a scroll
          container clips box-shadow; the equal negative margin keeps the row's
          rhythm unchanged. */}
            <dd className="-m-1 min-w-0 overflow-x-auto p-1 text-sm">{content}</dd>
        </div>
    );
}

/** Card + optional sprite icon + title, wrapping a <dl> of <Field />s. */
export function Section({
    title,
    icon,
    children,
}: {
    title: string;
    icon?: IconName;
    children: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    {icon ? <Icon name={icon} className="size-4 text-muted-foreground" /> : null}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <dl className="divide-y divide-border/60">{children}</dl>
            </CardContent>
        </Card>
    );
}

/** The shared "external record" row of a <*Full /> References section: a
 *  labelled <Field> whose value is a <LinkValue> to `href` (rendered only when
 *  `href` is present), with an optional " (host)" suffix. The single version of
 *  the `official_profile + (externalHost)` block copied across the *Full panels. */
export function ExternalLinkField({
    label,
    href,
    linkText,
    host,
}: {
    label: string;
    href: string | null | undefined;
    linkText: string;
    host?: string | null | undefined;
}) {
    return (
        <Field label={label}>
            {href ? (
                <LinkValue href={href}>
                    {linkText}
                    {host ? ` (${host})` : ""}
                </LinkValue>
            ) : null}
        </Field>
    );
}

/** The shared page chrome for a leaf detail surface (DocFull / SpeechFull /
 *  TextFull): a Card whose CardContent holds an optional "back to catalogue"
 *  link above the caller's content (the `<XItem variant="page" />`, linked-item
 *  fields and AttributionFooter). Standardizes the back link on NavLink +
 *  viewTransition. */
export function DetailCard({
    backHref,
    backLabel,
    actions,
    className,
    children,
}: {
    backHref?: string | null | undefined;
    backLabel: string;
    /** Optional top-right controls (e.g. <DataExport />), opposite the back link. */
    actions?: React.ReactNode;
    className?: string | undefined;
    children: React.ReactNode;
}) {
    return (
        <Card className={className}>
            <CardContent className="space-y-4 pt-6">
                {backHref || actions ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {backHref ? (
                            <NavLink
                                viewTransition
                                to={backHref}
                                className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                                <Icon name="arrow-left" className="size-3.5" />
                                {backLabel}
                            </NavLink>
                        ) : (
                            <span />
                        )}
                        {actions}
                    </div>
                ) : null}
                {children}
            </CardContent>
        </Card>
    );
}


/** Bare host for an external URL — protocol dropped, leading "www." stripped.
 *  e.g. "https://www.grosserrat.ch/de/geschaeft/123" → "grosserrat.ch". Returns
 *  null for empty / unparseable input so the caller can omit the "(domain)" part. */
export function hostLabel(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}