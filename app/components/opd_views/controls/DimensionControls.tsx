// DimensionControls.tsx
//
// Reusable search / filter / sort / page-size bar for the dimension + catalogue
// feeds. Renders itself entirely from a DimensionDescriptor (so every dimension
// reuses it), is driven by URL search params, and navigates on change — no form
// action, no server round-trip beyond the loader the navigation triggers.
//
// FACET OPTION SOURCING (new): the select facets are hydrated CLIENT-SIDE with the
// FULL vocabulary for each facet (all bodies, all affair types, …) fetched from the
// OpenParlData API — not just the values present in the current page. This happens
// here, inside the control, via useSourcedDescriptor(): it resolves each facet's
// source (the `body` facet by convention, others by an explicit `source` on the
// descriptor), fetches them after mount, and fills the options in progressively.
// So EVERY dimension that renders this control (all person feeds + the catalogues)
// gets full-list options with no per-consumer wiring. Filtering still works before
// (and regardless of) the fetch: parseRaw treats an unfilled select as an open set,
// so the URL value applies and only the dropdown/labels wait on the fetch. SSR
// renders the unfilled lists; the fetch is browser-only.
//
// Conventions kept from the rest of the panel set:
//   • shadcn/ui <Select> for every dropdown; design tokens for the rest.
//   • Native <input> for free-text search and native <input type="date"> for the
//     range (shadcn has no date control); both stay keyboard- and agent-friendly.
//   • All labels come from the `loc` map via makeT(); the second t() arg is the
//     English fallback.
//   • Any criteria change resets the pager (handled by buildSearch()).
//
// Submit model: search applies on submit (Enter / the Search button) to avoid a
// navigation per keystroke; selects and dates apply on change. `preventScrollReset`
// keeps the viewport steady, matching PagerLink.

import * as React from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
    type DimensionDescriptor,
    type RawCriteria,
    parseRaw,
    buildSearch,
    hasActiveCriteria,
    defaultCriteria,
    resolveLimit,
    visiblePageSizes,
    dimensionToolBase,
} from "~/lib/dimensions/filters";
import {
    useSourcedDescriptor,
    localeToLangs,
} from "~/lib/dimensions/facet_sources";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { makeT, Labeled } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";

export interface DimensionControlsProps {
    descriptor: DimensionDescriptor;
    /** Localized label map (pages.person.labels). */
    loc?: Record<string, string>;
    locale?: string;
    /** Language priority for fetched facet-option labels. Defaults to a list derived
     *  from `locale`; pass the loader's langs (e.g. ["de","fr","it"]) to keep the
     *  dropdown labels in step with the localized result rows. */
    langs?: readonly string[];
    /** Fetch full filter vocabularies from the API. Set ONLY on catalogue pages
     *  (all persons / affairs / votings). Person dimension pages omit it and keep
     *  page-slice options. */
    sourced?: boolean;
    /** Filtered result count — drives the summary line and the page-size menu. */
    resultCount?: number;
    /** WebMCP namespace — mirrors FeedShell's `mcpNamespace` so this control's
     *  declarative `toolname` matches the imperative `<base>_filter` tool that
     *  DimensionMcpTools registers for the same dimension. Omitted → bare dimension. */
    mcpNamespace?: string;
    className?: string;
}

// Matches the Input/Select primitive base (flat bg-transparent, no shadow) so
// filter-bar controls read as the same family as the rest of the site.
const FIELD =
    "h-11 rounded-md border border-input bg-transparent px-3 text-sm dark:bg-transparent " +
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Radix <Select> forbids an empty-string item value, so "All" gets a sentinel
// that maps back to null (= filter cleared).
const ALL = "__all__";

// Hardcoded gender labels (from the loc files), applied to the gender facet
// regardless of how its options are labelled upstream (the People page injects
// raw codes). Keyed by language, then gender code (f | m | d).
const GENDER_LABELS: Record<string, Record<string, string>> = {
    de: { f: "Weiblich", m: "Männlich", d: "Divers" },
    fr: { f: "Féminin", m: "Masculin", d: "Divers" },
    it: { f: "Femminile", m: "Maschile", d: "Diverso" },
    en: { f: "Female", m: "Male", d: "Diverse" },
};

/**
 * Small info affordance: an `info` glyph that reveals `text` on hover or keyboard
 * focus. No tooltip primitive in this app, so it's a self-contained CSS popover
 * (group-hover / group-focus-within). The text is also the button's aria-label,
 * and the popover carries role="tooltip" for assistive tech.
 */
function InfoTooltip({ text }: { text: string }) {
    return (
        <span className="group relative inline-flex">
            <button
                type="button"
                aria-label={text}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-muted-foreground/70 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <Icon name="info" className="size-3.5" />
            </button>
            <span
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full z-50 mt-1 w-max max-w-[18rem] rounded-md border bg-popover px-2 py-1 text-xs font-normal leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
                {text}
            </span>
        </span>
    );
}

/** When a country is selected, drop body (parliament) and party options that don't
 *  belong to it. Bodies carry their own country_key; parties carry body_keys, which
 *  we map to a country via the body options (fallback: "LIE" key → LIE, else CHE).
 *  No-op unless the options carry that metadata (i.e. unless `sourced`). */
function applyCountryScope(
    d: DimensionDescriptor,
    country: string | null,
): DimensionDescriptor {
    if (!country) return d;
    const bodyFacet = d.facets.find(
        (f) => f.kind === "select" && f.param === "body",
    );
    const keyToCountry = new Map<string, string>();
    if (bodyFacet && bodyFacet.kind === "select") {
        for (const o of bodyFacet.options) {
            if (o.bodyKey && o.country) keyToCountry.set(o.bodyKey, o.country);
        }
    }
    let changed = false;
    const facets = d.facets.map((f) => {
        if (f.kind !== "select") return f;
        if (f.param === "body") {
            const options = f.options.filter((o) => !o.country || o.country === country);
            if (options.length !== f.options.length) {
                changed = true;
                return { ...f, options };
            }
            return f;
        }
        if (f.param === "party") {
            const options = f.options.filter((o) => {
                if (!o.bodyKeys || o.bodyKeys.length === 0) return true;
                return o.bodyKeys.some(
                    (k) => (keyToCountry.get(k) ?? (k === "LIE" ? "LIE" : "CHE")) === country,
                );
            });
            if (options.length !== f.options.length) {
                changed = true;
                return { ...f, options };
            }
            return f;
        }
        return f;
    });
    return changed ? ({ ...d, facets } as DimensionDescriptor) : d;
}

/** Searchable single-select (shadcn combobox: Popover + Command). Used for every
 *  select facet so long lists (all bodies/parliaments) stay usable. "All" clears. */
function FacetCombobox({
    options,
    value,
    onChange,
    allLabel,
    searchPlaceholder,
    emptyText,
    ariaLabel,
    groupLabelFor,
}: {
    options: { value: string; label?: string; labelKey: string; position?: number | null }[];
    value: string | null;
    onChange: (value: string | null) => void;
    allLabel: string;
    searchPlaceholder: string;
    emptyText: string;
    ariaLabel: string;
    /** When provided, options are split into <CommandGroup>s keyed by this label
     *  (e.g. body.position → "Country" / "Canton" / …). Returning null = no group. */
    groupLabelFor?: (o: { position?: number | null }) => string | null;
}) {
    const [open, setOpen] = React.useState(false);
    const selected = value == null ? null : options.find((o) => o.value === value);
    const triggerLabel = selected ? selected.label ?? selected.value : allLabel;

    // Build ordered, de-duplicated groups (preserving the incoming option order
    // within each group) when a grouping function is supplied.
    const grouped = React.useMemo(() => {
        if (!groupLabelFor) return null;
        const buckets = new Map<string, typeof options>();
        for (const o of options) {
            const key = groupLabelFor(o) ?? "";
            const list = buckets.get(key) ?? [];
            list.push(o);
            buckets.set(key, list);
        }
        return [...buckets.entries()];
    }, [options, groupLabelFor]);

    const renderItem = (o: { value: string; label?: string }) => {
        const label = o.label ?? o.value;
        return (
            <CommandItem
                key={o.value}
                value={label}
                onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                }}
            >
                <span className="mr-2 w-4">{value === o.value ? "✓" : ""}</span>
                <span className="truncate">{label}</span>
            </CommandItem>
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <button
                        type="button"
                        role="combobox"
                        aria-expanded={open}
                        aria-label={ariaLabel}
                        className={`${FIELD} flex min-w-[10rem] max-w-[16rem] items-center justify-between gap-2 font-normal hover:bg-muted`}
                    >
                        <span className="truncate">{triggerLabel}</span>
                        <span aria-hidden className="shrink-0 opacity-60">▾</span>
                    </button>
                }
            />
            <PopoverContent className="w-[18rem] p-0" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value={allLabel}
                                onSelect={() => {
                                    onChange(null);
                                    setOpen(false);
                                }}
                            >
                                <span className="mr-2 w-4">{value == null ? "✓" : ""}</span>
                                {allLabel}
                            </CommandItem>
                        </CommandGroup>
                        {grouped
                            ? grouped.map(([heading, opts]) => (
                                <CommandGroup key={heading || "_"} heading={heading || undefined}>
                                    {opts.map(renderItem)}
                                </CommandGroup>
                            ))
                            : <CommandGroup>{options.map(renderItem)}</CommandGroup>}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function DimensionControls({
    descriptor: baseDescriptor,
    loc = {},
    locale = "de-CH",
    langs,
    sourced = false,
    resultCount,
    mcpNamespace,
    className,
}: DimensionControlsProps) {
    const t = makeT(loc);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const searchId = React.useId();

    // Mobile: collapse everything but the keyword field behind a toggle; on sm+
    // the advanced group is `contents` (always laid out inline) and the toggle hides.
    const [showAdvanced, setShowAdvanced] = React.useState(false);

    // Language priority for the fetched option labels (loader langs if provided).
    const langPriority = React.useMemo(
        () => (langs && langs.length ? langs : localeToLangs(locale)),
        [langs, locale],
    );

    // Hydrate the descriptor's select facets with the FULL option vocabularies,
    // fetched client-side. Returns the descriptor unchanged (and fetches nothing)
    // for dimensions with no sourced facets. Everything below uses this `descriptor`.
    const sourcedDescriptor = useSourcedDescriptor(baseDescriptor, langPriority, sourced);

    // Country-dependent scoping: hide parliaments/parties of the other country.
    const descriptor = React.useMemo(
        () => applyCountryScope(sourcedDescriptor, searchParams.get("country")),
        [sourcedDescriptor, searchParams],
    );

    // Per-dimension search affordances: the placeholder names the route's topic and
    // the hint lists which fields the keyword matches. Both key off descriptor.dimension
    // and fall back to the shared/generic label when no override is provided.
    const searchPlaceholder = t(`controls_search_placeholder_${descriptor.dimension}`);
    const searchHint = t(`controls_search_hint_${descriptor.dimension}`);

    // Declarative WebMCP: expose this search form as an agent tool named exactly like
    // the imperative `<base>_filter` (DimensionMcpTools), so the two describe one tool.
    // Server-rendered, so Lighthouse's form-coverage audit sees it without waiting on
    // hydration. See types/webmcp.d.ts.
    const filterToolName = `${dimensionToolBase(descriptor.dimension, mcpNamespace)}_filter`;

    const current = React.useMemo(
        () => parseRaw(descriptor, searchParams),
        [descriptor, searchParams],
    );

    // Free-text field is UNCONTROLLED (a ref): typing must not re-render this whole
    // control bar (facets, comboboxes, sort) on every keystroke — that's what made
    // it sluggish. It applies on submit; the effect re-seeds the input only when q
    // changes in the URL (after submit, Clear, or navigating to another record) —
    // never per keystroke, so it doesn't reintroduce lag.
    const searchRef = React.useRef<HTMLInputElement>(null);
    React.useEffect(() => {
        if (searchRef.current) searchRef.current.value = current.q ?? "";
    }, [current.q]);

    const apply = React.useCallback(
        (next: RawCriteria) => {
            const search = buildSearch(descriptor, next, searchParams);
            navigate({ search: search ? `?${search}` : "" }, { preventScrollReset: true });
        },
        [descriptor, navigate, searchParams],
    );

    const onSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault(); // not a form action — JS navigation only
        apply({ ...current, q: searchRef.current?.value.trim() || null });
    };

    const setFacet = (param: string, value: string | null) =>
        apply({ ...current, facets: { ...current.facets, [param]: value } });

    const setSort = (key: string) => apply({ ...current, sort: key });
    const toggleDir = () =>
        apply({ ...current, dir: current.dir === "desc" ? "asc" : "desc" });

    const setDate = (which: "dateFrom" | "dateTo", value: string | null) =>
        apply({ ...current, [which]: value || null });

    const setLimit = (n: number) =>
        apply({ ...current, limit: n === descriptor.pageSize.default ? null : n });

    const active = hasActiveCriteria(descriptor, current);
    // Clear filters/sort/search but keep the chosen page size (a view preference).
    const clearAll = () =>
        apply({ ...defaultCriteria(descriptor), limit: current.limit });

    const effectiveLimit = resolveLimit(descriptor, current);
    const pageSizes = visiblePageSizes(descriptor, resultCount ?? 0, effectiveLimit);

    // Announced politely to assistive tech whenever the sort field/direction changes
    // (the list re-orders silently otherwise — this is what aria-sort would convey on
    // a sortable table, but here the control is a select + toggle over a list).
    const sortFieldLabel = t(
        descriptor.sorts.find((s) => s.key === current.sort)?.labelKey ?? "",
    );
    const sortDirLabel =
        current.dir === "desc"
            ? t("controls_sort_desc")
            : t("controls_sort_asc");
    const sortStatus = t("controls_sort_status")
        .replace("{field}", sortFieldLabel)
        .replace("{direction}", sortDirLabel);

    return (
        <section
            className={`mb-4 rounded-lg border bg-muted/30 p-3 ${className ?? ""}`}
            aria-label={t("controls_label")}
        >
            {/* Visually hidden; stays mounted so sort changes are spoken (not on load). */}
            <div className="sr-only" role="status" aria-live="polite">
                {sortStatus}
            </div>
            <div className="flex flex-wrap items-end gap-3">
                {/* search — hidden for dimensions with no searchable text */}
                {descriptor.searchable !== false ? (
                    <form
                        onSubmit={onSearchSubmit}
                        className="flex min-w-[14rem] flex-1 items-end gap-2"
                        role="search"
                        toolname={filterToolName}
                        tooldescription={`Search the ${descriptor.dimension} list by free text; submitting filters the full result set, not just the current page.`}
                    >
                        <div className="flex-1">
                            <span className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <label htmlFor={searchId}>{t("controls_search")}</label>
                                {searchHint ? <InfoTooltip text={searchHint} /> : null}
                            </span>
                            <input
                                id={searchId}
                                ref={searchRef}
                                type="search"
                                defaultValue={current.q ?? ""}
                                placeholder={searchPlaceholder}
                                className={`${FIELD} w-full`}
                                aria-label={t("controls_search")}
                            />
                        </div>
                        <Button type="submit" variant="outline">
                            {t("controls_search_submit")}
                        </Button>
                    </form>
                ) : null}

                {/* Mobile-only toggle: reveals the collapsed sort / filter / page-size set. */}
                <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between sm:hidden"
                    aria-expanded={showAdvanced}
                    onClick={() => setShowAdvanced((v) => !v)}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <Icon name="search" className="size-4" />
                        {showAdvanced ? t("controls_fewer_options") : t("controls_more_options")}
                    </span>
                    <Icon
                        name="chevron-down"
                        className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                    />
                </Button>

                {/* Advanced controls: inline on sm+ (contents = no extra box), a
            collapsible full-width block on mobile. */}
                <div
                    className={`${showAdvanced ? "flex flex-wrap items-end gap-3" : "hidden"} w-full sm:contents`}
                >
                    {/* sort */}
                    <div className="flex items-end gap-1.5">
                        <Labeled label={t("controls_sort")}>
                            <Select value={current.sort} onValueChange={(v) => v && setSort(v)}>
                                <SelectTrigger
                                    className="!h-11 min-w-[8rem]"
                                    aria-label={t("controls_sort")}
                                >
                                    <SelectValue>
                                        {t(
                                            descriptor.sorts.find((s) => s.key === current.sort)?.labelKey ?? "",
                                        )}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {descriptor.sorts.map((s) => (
                                        <SelectItem key={s.key} value={s.key}>
                                            {t(s.labelKey)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Labeled>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={toggleDir}
                            aria-label={
                                current.dir === "desc"
                                    ? t("controls_sort_desc")
                                    : t("controls_sort_asc")
                            }
                            title={
                                current.dir === "desc"
                                    ? t("controls_sort_desc")
                                    : t("controls_sort_asc")
                            }
                        >
                            {current.dir === "desc" ? "↓" : "↑"}
                        </Button>
                    </div>

                    {/* facets */}
                    {descriptor.facets.map((f) => {
                        if (f.kind === "select") {
                            return (
                                <Labeled key={f.param} label={t(f.labelKey)}>
                                    <FacetCombobox
                                        options={f.options.map((o) => ({
                                            value: o.value,
                                            labelKey: o.labelKey,
                                            position: o.position ?? null,
                                            label:
                                                f.param === "gender"
                                                    ? GENDER_LABELS[langPriority[0]]?.[o.value] ??
                                                    GENDER_LABELS.de[o.value] ??
                                                    o.label ??
                                                    t(o.labelKey)
                                                    : o.label ?? t(o.labelKey),
                                        }))}
                                        value={current.facets[f.param] ?? null}
                                        onChange={(v) => setFacet(f.param, v)}
                                        allLabel={t(f.allLabelKey)}
                                        searchPlaceholder={t("controls_filter_search")}
                                        emptyText={t("controls_no_results")}
                                        ariaLabel={t(f.labelKey)}
                                        {...(f.param === "body"
                                            ? {
                                                groupLabelFor: (o: { position?: number | null }) => {
                                                    switch (o.position) {
                                                        case 1: return t("facet_position_country");
                                                        case 2: return t("facet_position_canton");
                                                        case 3: return t("facet_position_city");
                                                        case 4: return t("facet_position_commune");
                                                        default: return t("facet_position_other");
                                                    }
                                                },
                                            }
                                            : {})}
                                    />
                                </Labeled>
                            );
                        }
                        if (f.kind === "boolean") {
                            const selected = current.facets[f.param];
                            const selectedLabel =
                                selected === "true"
                                    ? t(f.trueLabelKey)
                                    : selected === "false"
                                        ? t(f.falseLabelKey)
                                        : t(f.allLabelKey);
                            return (
                                <Labeled key={f.param} label={t(f.labelKey)}>
                                    <Select
                                        value={selected ?? ALL}
                                        onValueChange={(v) => setFacet(f.param, v === ALL ? null : v)}
                                    >
                                        <SelectTrigger
                                            className="!h-11 min-w-[7rem]"
                                            aria-label={t(f.labelKey)}
                                        >
                                            <SelectValue>{selectedLabel}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL}>{t(f.allLabelKey)}</SelectItem>
                                            <SelectItem value="true">{t(f.trueLabelKey)}</SelectItem>
                                            <SelectItem value="false">{t(f.falseLabelKey)}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Labeled>
                            );
                        }
                        // dateRange
                        return (
                            <div key={`${f.fromParam}-${f.toParam}`} className="flex items-end gap-1.5">
                                <Labeled label={t(f.fromLabelKey)}>
                                    <input
                                        type="date"
                                        value={current.dateFrom ?? ""}
                                        max={current.dateTo ?? undefined}
                                        onChange={(e) => setDate("dateFrom", e.target.value)}
                                        className={FIELD}
                                        aria-label={t(f.fromLabelKey)}
                                    />
                                </Labeled>
                                <Labeled label={t(f.toLabelKey)}>
                                    <input
                                        type="date"
                                        value={current.dateTo ?? ""}
                                        min={current.dateFrom ?? undefined}
                                        onChange={(e) => setDate("dateTo", e.target.value)}
                                        className={FIELD}
                                        aria-label={t(f.toLabelKey)}
                                    />
                                </Labeled>
                            </div>
                        );
                    })}

                    {/* page size — only when the result count makes a choice meaningful */}
                    {pageSizes.length > 0 ? (
                        <Labeled label={t("controls_per_page")}>
                            <Select
                                value={String(effectiveLimit)}
                                onValueChange={(v) => v && setLimit(Number(v))}
                            >
                                <SelectTrigger
                                    className="!h-11 w-[5rem]"
                                    aria-label={t("controls_per_page")}
                                >
                                    <SelectValue>{effectiveLimit}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {pageSizes.map((n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Labeled>
                    ) : null}
                </div>
            </div>

            {/* summary + clear */}
            {(active || resultCount != null) && (
                <div className="mt-2.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                        {resultCount != null
                            ? `${resultCount} ${t("controls_results")}`
                            : ""}
                    </span>
                    {active ? (
                        <button
                            type="button"
                            onClick={clearAll}
                            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-input px-2 py-1 text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            <Icon name="x" className="size-3.5" />
                            {t("controls_clear")}
                        </button>
                    ) : null}
                </div>
            )}
        </section>
    );
}

export default DimensionControls;