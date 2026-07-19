// PersonImages.tsx
//
// Image gallery for a political actor. Two variants:
//   • "page"    — the /people/:id/images dimension route: paginated grid, with a
//                 CC BY 4.0 data credit. Rendered BELOW <PersonBase />.
//   • "snippet" — embedded on the overview route: shows the rows the loader
//                 passed (no pager) plus a link to the full feed.
// Like <PersonVotes />, it owns only its own panel and never re-emits identity
// properties, so nothing is declared twice on the page.
//
// Domain: `person_images` is a VERSIONED image set. Each row is one version of
// the person's portrait, carrying up to four renditions of the same picture:
//   • thumb_url   — small preview
//   • profile_url — display-sized
//   • oparl_url   — the OParl-standard hosted URL
//   • source_url  — the original upstream source
// plus `version` / `latest` (is this the current version) and a valid_from/
// valid_to window. There are NO localized fields on this entity.
//
// Presentation: a responsive gallery grid (the tile = one version). Clicking a
// tile opens a lightbox that doubles as a slider (prev / next across the loaded
// rows, keyboard-navigable), showing the largest rendition plus links to the
// source / OParl / full-size renditions. The "current" version is badged.
//
// Structured data: this gallery emits none — it is purely presentational. The
// page's Person/ProfilePage graph is emitted as head JSON-LD by the route
// meta() (metas/person.ts → jsonld/person.ts); per-image ImageObjects were
// dropped as low search-value (nested sub-lists aren't emitted as graph nodes —
// see the structured-data note in docs/conventions.md).
//
// Conventions:
//   • Current version first, then version desc, then valid_from desc — newest
//     image leads, matching the query's ORDER BY.
//   • Dates are epoch-millis numbers → formatEpoch (explicit tz, no SSR drift).
//   • Pagination ("page") is driven by a URL search param so it is SSR-friendly
//     and linkable; total_count is the unpaginated count, items is the slice.
//
// All visible labels come from the `loc` map; the second arg to t() is the
// English fallback used when a key is missing.

import * as React from "react";
import { useSearchParams } from "react-router";
import type {
    PersonClient,
    IdentityClient,
    BodyClient,
    PersonImageClient,
} from "@/types/opd_db";
import type { PaginatedList } from "@/types/opd_paginated_client";
import { formatEpoch, displayName } from "~/lib/domain/person";
import { safeHref } from "~/lib/security/safe_href";
import {
    parseRaw,
    hasActiveCriteria,
} from "~/lib/dimensions/filters";
import { imagesDescriptor } from "~/lib/dimensions/descriptors";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { InternalLink, makeT, AttributionFooter, feedPath, formatPeriod, PagerLink, usePagerHref, SectionCardHeader } from "../opd_micros";
import { DimensionControls } from "../controls/DimensionControls";
import { DimensionMcpTools } from "../controls/DimensionMcpTools";
import { Icon } from "../../icons/opd_icons";

export interface PersonImagesProps {
    /** The person record. `persons.id` is the canonical (primary) id and drives
     *  the feed link. */
    persons: PersonClient;
    /** The page slice + unpaginated count: `dat.person_images`. (The whole
     *  wrapper — it needs `total_count` for the pager.) */
    person_images: PaginatedList<PersonImageClient>;
    /** Sibling identities grouped under the person (accepted for parity with the
     *  other dimension components; not rendered here). */
    identities?: IdentityClient[];
    /** Bodies referenced by the header (accepted for parity; not rendered here). */
    bodies?: BodyClient[];
    /** Localized label map (pages.person.labels from the loc JSON). */
    loc?: Record<string, string>;
    locale?: string;
    /**
     * "page"    — full dimension route: pagination + data credit (default).
     * "snippet" — embedded on the overview: no pager, just the rows the loader
     *             passed plus a link to the full /people/:id/images feed.
     */
    variant?: "page" | "snippet";
    /** Page size ($7) and page start ($8), echoed from the loader. ("page" only.) */
    limit?: number;
    offset?: number;
    /** URL search param the pager writes the offset to. ("page" only.) */
    pageParam?: string;
    className?: string;
}

/* ------------------------------ url helpers ------------------------------- */

interface ImageUrls {
    /** Smallest rendition for the grid tile. */
    thumb: string | null;
    /** Display-sized rendition for the lightbox. */
    display: string | null;
    /** Best "open the original" target (largest / most authoritative). */
    full: string | null;
    source: string | null;
    oparl: string | null;
}

/** Resolve the four renditions into the three roles the UI needs, each with a
 *  graceful fallback chain so a row with only one populated URL still renders. */
function pickUrls(img: PersonImageClient): ImageUrls {
    const source = img.source_url ?? null;
    const oparl = img.oparl_url ?? null;
    const profile = img.profile_url ?? null;
    const thumb = img.thumb_url ?? null;
    return {
        thumb: thumb ?? profile ?? oparl ?? source,
        display: profile ?? oparl ?? source ?? thumb,
        full: source ?? oparl ?? profile ?? thumb,
        source,
        oparl,
    };
}

const hasAnyUrl = (img: PersonImageClient): boolean =>
    !!(img.source_url || img.oparl_url || img.profile_url || img.thumb_url);

/* -------------------------------- component ------------------------------- */

export function PersonImages({
    persons,
    person_images,
    identities: _identities = [],
    bodies: _bodies = [],
    loc = {},
    locale = "de-CH",
    variant = "page",
    limit = 24,
    offset = 0,
    pageParam = "offset",
    className,
}: PersonImagesProps) {
    const pagerTo = usePagerHref(pageParam);
    const t = makeT(loc);
    const [searchParams] = useSearchParams();

    const isPage = variant === "page";
    const personId = persons.id;
    const feedHref = feedPath(personId, "images");
    const personName = displayName(persons);

    const total = person_images.total_count ?? 0;

    // Whether any criterion is active — picks the right empty-state copy.
    const filtersActive =
        isPage && hasActiveCriteria(imagesDescriptor, parseRaw(imagesDescriptor, searchParams));

    // Trust the server's order (ORDER BY is driven by the same criteria). Still
    // drop rows with no usable URL so the grid never renders an empty tile.
    const items = React.useMemo(
        () => (person_images.items ?? []).filter(hasAnyUrl),
        [person_images.items],
    );

    // Register WebMCP tools only after mount (client-only; SSR renders nothing).
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    // Lightbox / slider state. Starts closed, so SSR renders only the grid.
    const [openIndex, setOpenIndex] = React.useState<number | null>(null);
    const open = openIndex != null ? items[openIndex] ?? null : null;

    const close = React.useCallback(() => setOpenIndex(null), []);
    const go = React.useCallback(
        (delta: number) =>
            setOpenIndex((i) =>
                i == null || items.length === 0
                    ? i
                    : (i + delta + items.length) % items.length,
            ),
        [items.length],
    );

    // Keyboard control + body scroll lock while the lightbox is open (client-only).
    React.useEffect(() => {
        if (open == null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowRight") go(1);
            else if (e.key === "ArrowLeft") go(-1);
        };
        document.addEventListener("keydown", onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, close, go]);

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + (items.length || limit), total);
    const prevOffset = Math.max(0, offset - limit);
    const nextOffset = offset + limit;
    const hasPrev = offset > 0;
    const hasNext = nextOffset < total;

    return (
        <Card className={className}>
            <SectionCardHeader
                icon="image"
                title={t("section_images")}
                count={total}
            />

            <CardContent>
                {/* sort / filter — page variant only (no search: images have no text) */}
                {isPage ? (
                    <DimensionControls
                        descriptor={imagesDescriptor}
                        loc={loc}
                        locale={locale}
                        resultCount={total}
                    />
                ) : null}

                {/* agent tools (render nothing visible; client-only) */}
                {isPage && mounted ? (
                    <DimensionMcpTools
                        descriptor={imagesDescriptor}
                        limit={limit}
                        offset={offset}
                        filteredTotal={total}
                        visibleCount={items.length}
                    />
                ) : null}

                {items.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        {filtersActive
                            ? t("controls_no_results")
                            : t("no_images")}
                    </p>
                ) : (
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(6.5rem,7.5rem))]">
                        {items.map((img, i) => (
                            <ImageTile
                                key={img.id}
                                img={img}
                                index={i}
                                t={t}
                                locale={locale}
                                personName={personName}
                                onOpen={setOpenIndex}
                            />
                        ))}
                    </ul>
                )}

                {isPage && total > limit ? (
                    <nav
                        className="mt-4 flex items-center justify-between gap-4 border-t pt-4 text-sm"
                        aria-label={t("pagination")}
                    >
                        <span className="text-muted-foreground">
                            {t("showing")} {from}–{to} {t("of")} {total}
                        </span>
                        <div className="flex items-center gap-2">
                            <PagerLink
                                disabled={!hasPrev}
                                to={pagerTo(prevOffset)}
                                rel="prev"
                            >
                                <Icon name="arrow-left" className="size-3.5" />
                                {t("pager_prev")}
                            </PagerLink>
                            <PagerLink
                                disabled={!hasNext}
                                to={pagerTo(nextOffset)}
                                rel="next"
                            >
                                {t("pager_next")}
                                <Icon name="arrow-right" className="size-3.5" />
                            </PagerLink>
                        </div>
                    </nav>
                ) : null}

                {!isPage && total > 0 ? (
                    <div className="mt-4 border-t pt-4 text-sm">
                        <InternalLink to={feedHref}>
                            {t("view_all_images")}
                            {total > items.length ? (
                                <span className="text-muted-foreground"> ({total})</span>
                            ) : null}
                        </InternalLink>
                    </div>
                ) : null}

                {isPage ? (
                    <AttributionFooter t={t} />
                ) : null}
            </CardContent>

            {open ? (
                <Lightbox
                    img={open}
                    index={openIndex as number}
                    count={items.length}
                    t={t}
                    locale={locale}
                    personName={personName}
                    onClose={close}
                    onPrev={() => go(-1)}
                    onNext={() => go(1)}
                />
            ) : null}
        </Card>
    );
}

/* -------------------------------- a tile ---------------------------------- */

function ImageTile({
    img,
    index,
    t,
    locale,
    personName,
    onOpen,
}: {
    img: PersonImageClient;
    index: number;
    t: (key: string) => string;
    locale: string;
    personName: string;
    onOpen: (i: number) => void;
}) {
    const u = pickUrls(img);
    const [broken, setBroken] = React.useState(false);
    // Prefer the largest available rendition for the tile: the browser DOWN-scales
    // it to the small tile, which stays crisp. The thumbnails are only ~100×100, so
    // using them here (then upscaling to fill the tile) is what looked blurry.
    // Fall back to the thumb only if the larger one errors.
    const tileSrc = (!broken ? u.display : null) ?? u.thumb;
    const isCurrent = img.latest === true;
    const versionLabel =
        img.version != null ? `${t("image_version")} ${img.version}` : null;
    const validity = formatPeriod(img.valid_from, img.valid_to, locale, t, "image");
    const alt = imageAlt(personName, img, t);

    return (
        <li>
            <figure className="space-y-1.5">
                <button
                    type="button"
                    onClick={() => onOpen(index)}
                    aria-label={`${t("image_open")}: ${alt}`}
                    className="group relative block w-full overflow-hidden rounded-lg border bg-muted outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                    {/* square box matches the thumbnails' native 1:1 ratio (no crop/stretch) */}
                    <span className="block aspect-square">
                        {tileSrc ? (
                            <img
                                src={tileSrc}
                                alt={alt}
                                loading="lazy"
                                decoding="async"
                                onError={() => setBroken(true)}
                                className="size-full object-cover transition duration-200 group-hover:scale-[1.02]"
                            />
                        ) : (
                            <span className="flex size-full items-center justify-center text-muted-foreground">
                                <Icon name="image-off" className="size-6" />
                            </span>
                        )}
                    </span>
                    {isCurrent ? (
                        <Badge
                            variant="secondary"
                            className="absolute left-1.5 top-1.5 px-1.5 py-0 text-[10px] font-medium shadow-sm"
                        >
                            {t("image_current")}
                        </Badge>
                    ) : null}
                </button>

                {versionLabel || validity ? (
                    <figcaption className="space-y-0.5 px-0.5 text-xs text-muted-foreground">
                        {versionLabel ? (
                            <div className="font-medium text-foreground/80">{versionLabel}</div>
                        ) : null}
                        {validity ? <div>{validity}</div> : null}
                    </figcaption>
                ) : null}
            </figure>
        </li>
    );
}

/* ------------------------------- lightbox --------------------------------- */

function Lightbox({
    img,
    index,
    count,
    t,
    locale,
    personName,
    onClose,
    onPrev,
    onNext,
}: {
    img: PersonImageClient;
    index: number;
    count: number;
    t: (key: string) => string;
    locale: string;
    personName: string;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
}) {
    const u = pickUrls(img);
    const alt = imageAlt(personName, img, t);
    const validity = formatPeriod(img.valid_from, img.valid_to, locale, t, "image");
    const closeRef = React.useRef<HTMLButtonElement>(null);
    React.useEffect(() => closeRef.current?.focus(), []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            {/* top bar: counter + close */}
            <div className="flex items-center justify-between gap-3 p-3 text-sm text-white/90">
                <span className="tabular-nums">
                    {index + 1} / {count}
                </span>
                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label={t("image_close")}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 py-1 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                    <Icon name="x" className="size-5" />
                </button>
            </div>

            {/* image stage — stop propagation so clicking the image doesn't close */}
            <div
                className="flex min-h-0 flex-1 items-center justify-center px-3"
                onClick={(e) => e.stopPropagation()}
            >
                {count > 1 ? (
                    <button
                        type="button"
                        onClick={onPrev}
                        aria-label={t("image_prev")}
                        className="mr-1 hidden min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:inline-flex"
                    >
                        <Icon name="arrow-left" className="size-6" />
                    </button>
                ) : null}

                {u.display ? (
                    <img
                        src={u.display}
                        alt={alt}
                        className="max-h-[70vh] max-w-full rounded-md object-contain shadow-2xl"
                    />
                ) : (
                    <div className="flex size-40 items-center justify-center rounded-md bg-white/5 text-white/70">
                        <Icon name="image-off" className="size-8" />
                    </div>
                )}

                {count > 1 ? (
                    <button
                        type="button"
                        onClick={onNext}
                        aria-label={t("image_next")}
                        className="ml-1 hidden min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:inline-flex"
                    >
                        <Icon name="arrow-right" className="size-6" />
                    </button>
                ) : null}
            </div>

            {/* caption + rendition links */}
            <div
                className="space-y-2 p-4 text-center text-sm text-white/90"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                    {img.version != null ? (
                        <span className="font-medium">
                            {t("image_version")} {img.version}
                        </span>
                    ) : null}
                    {img.latest === true ? (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            {t("image_current")}
                        </Badge>
                    ) : null}
                    {validity ? (
                        <span className="inline-flex items-center gap-1.5 text-white/70">
                            <Icon name="calendar-range" className="size-3.5 shrink-0" />
                            {validity}
                        </span>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
                    {u.full ? (
                        <LightboxLink href={u.full}>
                            {t("image_full")}
                        </LightboxLink>
                    ) : null}
                    {u.source ? (
                        <LightboxLink href={u.source}>
                            {t("image_source")}
                        </LightboxLink>
                    ) : null}
                    {u.oparl ? (
                        <LightboxLink href={u.oparl}>
                            {t("image_oparl")}
                        </LightboxLink>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

/* -------------------------------- helpers --------------------------------- */

/** External rendition link inside the (dark) lightbox. The href comes from
 *  source data, so it passes `safeHref` (scheme allowlist); a disallowed URL
 *  renders the label as plain text. */
function LightboxLink({
    href,
    children,
}: {
    href: string;
    children: React.ReactNode;
}) {
    const safe = safeHref(href);
    if (safe === undefined) {
        return (
            <span className="inline-flex min-h-11 items-center gap-1 text-white/70">
                {children}
            </span>
        );
    }
    return (
        <a
            href={safe}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 rounded-sm text-white/90 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-white/60"
        >
            {children}
            <Icon name="external-link" className="size-3 shrink-0" />
        </a>
    );
}

/** Alt text for an image: the person's name (+ version for uniqueness across
 *  the set), falling back to a generic label when the name is unknown. */
function imageAlt(
    personName: string,
    img: PersonImageClient,
    t: (key: string) => string,
): string {
    const base = personName || t("image_untitled");
    return img.version != null
        ? `${base} — ${t("image_version")} ${img.version}`
        : base;
}

export default PersonImages;