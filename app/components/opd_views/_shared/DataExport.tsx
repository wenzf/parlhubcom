// DataExport.tsx        → ~/components/opd_views/_shared/DataExport.tsx
//
// The single, uniform "Export" control shown in the SAME spot on every result
// page (top-right of the entity header, mounted by the result layout). Two tiers:
//
//   1. THIS PAGE — the entity's fields and/or the visible list rows, serialized
//      in-browser and downloaded instantly (JSON / CSV / Excel).
//   2. FULL DATASET — for lists, links to the bulk resource route
//      (/…/export/:dataset/:format?page=N) which streams the WHOLE dataset in
//      fixed 500-row pages, straight from the server. One submenu per dataset →
//      per format → per page.
//
// Plus a Print action (window.print(); a print stylesheet drops the app chrome).
//
// The tabular sibling of <ChartExportButton> (charts → PNG/SVG). The heavy
// serializer (~/lib/export/data) is import()ed only on the first in-browser
// export click, so its zip/CRC code never ships in the base bundle. SSR-safe: the
// button + menu render on the server; blobs/document only touch after a click.

import * as React from "react";
import { makeT } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportTable, ExportFormat } from "~/lib/export/data";

export type { ExportTable, ExportColumn } from "~/lib/export/data";

/** One list dataset offered as a bulk, paginated download. */
export interface BulkDataset {
    /** URL segment consumed by the resource route (e.g. "votings"). */
    key: string;
    label: string;
    /** Total rows across all pages — drives the page count. */
    total: number;
}

export interface BulkExport {
    /** Absolute base, no trailing slash, e.g. `/de/bodies/42/export`. */
    baseHref: string;
    /** Rows per page (the resource route's fixed cap). */
    pageSize: number;
    datasets: BulkDataset[];
}

export interface DataExportProps {
    /** Download filename WITHOUT extension for the in-browser export (`body-42`). */
    filename: string;
    /** In-browser datasets. CSV uses the first; XLSX makes one sheet each. */
    tables: ExportTable[];
    /** Optional server-side bulk export links (lists only). */
    bulk?: BulkExport | undefined;
    /** Optional localized-data language priority chooser (affects the SERVER/bulk
     *  exports only; the in-browser "This page" export is always the page's
     *  language). `options` = selectable data languages in canonical order;
     *  `initial` = the starting priority (e.g. resolveLangs(urlLang)). */
    langExport?: { options: string[]; initial: string[] } | undefined;
    /** Extra facts for the JSON export's `meta` envelope (the in-browser "this
     *  page" download). `dataset` = the dimension segment; `languages` = the
     *  content-language priority; `totalEntries` = the feed's full size (the export
     *  itself carries only the visible slice). Absent → the envelope fills nulls. */
    jsonMeta?: { dataset?: string | null; languages?: string[] | null; totalEntries?: number | null } | undefined;
    loc?: Record<string, string> | undefined;
    className?: string | undefined;
}

// Matches ChartExportButton exactly so the two export triggers read as siblings.
const TRIGGER =
    "inline-flex min-h-11 items-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-normal " +
    "text-muted-foreground outline-none hover:text-foreground " +
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const FMT_ICON: Record<ExportFormat, "braces" | "table"> = {
    json: "braces",
    csv: "table",
    xlsx: "table",
};

export function DataExport({ filename, tables, bulk, langExport, jsonMeta, loc, className }: DataExportProps) {
    const t = React.useMemo(() => makeT(loc ?? {}), [loc]);
    const [busy, setBusy] = React.useState(false);

    const hasInline = tables.some((tbl) => tbl.rows.length > 0);
    const bulkSets = bulk?.datasets.filter((d) => d.total > 0) ?? [];
    const hasData = hasInline || bulkSets.length > 0;

    // Preferred data language (the priority's first entry); the rest of the
    // priority follows in the canonical `options` order. Only affects bulk exports.
    const [primaryLang, setPrimaryLang] = React.useState(langExport?.initial[0] ?? "");
    const langPriority = React.useMemo(() => {
        if (!langExport) return [];
        const head = primaryLang || langExport.initial[0] || langExport.options[0];
        return [head, ...langExport.options.filter((l) => l !== head)];
    }, [langExport, primaryLang]);
    // `&langs=…` appended to every bulk link so the server re-resolves loc() fields.
    const langQuery = langExport && langPriority.length ? `&langs=${langPriority.join(",")}` : "";
    const showLangControl = !!langExport && bulkSets.length > 0;

    const runExport = React.useCallback(
        async (format: ExportFormat) => {
            if (busy) return;
            setBusy(true);
            try {
                const { exportTables, buildExportMeta } = await import("~/lib/export/data");
                // JSON gets the API-style `{ meta, data }` envelope. The in-browser export
                // is the visible slice, so it has no endpoint URL / prev-next; the page URL
                // and retrieval time are the live ones.
                const meta =
                    format === "json"
                        ? buildExportMeta({
                            origin: typeof window !== "undefined" ? window.location.origin : null,
                            dataset: jsonMeta?.dataset ?? null,
                            exportUrl: null,
                            pageUrl: typeof window !== "undefined" ? window.location.href : null,
                            retrievedAt: new Date().toISOString(),
                            languages: jsonMeta?.languages ?? null,
                            pagination: {
                                entries_on_page: tables.reduce((n, t) => n + t.rows.length, 0),
                                total_entries: jsonMeta?.totalEntries ?? tables.reduce((n, t) => n + t.rows.length, 0),
                            },
                        })
                        : undefined;
                exportTables(filename, format, tables, meta);
            } finally {
                setBusy(false);
            }
        },
        [busy, filename, tables, jsonMeta],
    );

    const onPrint = React.useCallback(() => {
        if (typeof window !== "undefined") window.print();
    }, []);

    const fmtLabel = (f: ExportFormat) =>
        f === "json" ? t("export_json") : f === "csv" ? t("export_csv") : t("export_xlsx");
    const FORMATS: ExportFormat[] = ["json", "csv", "xlsx"];

    // The per-format links for one bulk dataset: a direct link when it fits on one
    // page, else a nested page picker. Shared by the single- and multi-dataset menus.
    const renderFormats = (d: { key: string; total: number }) => {
        if (!bulk) return null;
        const pages = Math.max(1, Math.ceil(d.total / bulk.pageSize));
        return FORMATS.map((f) => {
            if (pages <= 1) {
                return (
                    <DropdownMenuItem key={f} render={<a href={`${bulk.baseHref}/${d.key}/${f}?page=1${langQuery}`} download />}>
                        <Icon name={FMT_ICON[f]} className="size-3.5 text-muted-foreground" />
                        {fmtLabel(f)}
                    </DropdownMenuItem>
                );
            }
            return (
                <DropdownMenuSub key={f}>
                    <DropdownMenuSubTrigger>
                        <Icon name={FMT_ICON[f]} className="size-3.5 text-muted-foreground" />
                        {fmtLabel(f)}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 min-w-48 overflow-y-auto">
                        {Array.from({ length: pages }, (_, i) => {
                            const p = i + 1;
                            const from = i * bulk.pageSize + 1;
                            const to = Math.min(d.total, p * bulk.pageSize);
                            return (
                                <DropdownMenuItem key={p} render={<a href={`${bulk.baseHref}/${d.key}/${f}?page=${p}${langQuery}`} download />}>
                                    {t("export_page")} {p}
                                    <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">
                                        {from}–{to}
                                    </span>
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
            );
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={!hasData || busy}
                aria-label={t("export_label")}
                render={
                    <button
                        type="button"
                        className={`${TRIGGER} disabled:pointer-events-none disabled:opacity-50 ${className ?? ""}`}
                    />
                }
            >
                <Icon name="download" className="size-3.5" />
                {t("export_label")}
                <Icon name="chevron-down" className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="min-w-52">
                {/* ── tier 1: the visible page, serialized in-browser ── */}
                {hasInline ? (
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>{t("export_current_view")}</DropdownMenuLabel>
                        {FORMATS.map((f) => (
                            <DropdownMenuItem key={f} onClick={() => void runExport(f)}>
                                <Icon name={FMT_ICON[f]} className="size-3.5 text-muted-foreground" />
                                {fmtLabel(f)}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                ) : null}

                {/* ── tier 2: full dataset(s) via the bulk resource route ── */}
                {bulk && bulkSets.length > 0 ? (
                    <>
                        {hasInline ? <DropdownMenuSeparator /> : null}
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>
                                {t("export_bulk").replace("{n}", String(bulk.pageSize))}
                            </DropdownMenuLabel>
                            {bulkSets.length === 1
                                ? // Single dataset (e.g. a catalogue) → formats sit directly under
                                // the label; no redundant dataset submenu.
                                renderFormats(bulkSets[0])
                                : bulkSets.map((d) => (
                                    <DropdownMenuSub key={d.key}>
                                        <DropdownMenuSubTrigger>
                                            <Icon name="download" className="size-3.5 text-muted-foreground" />
                                            {d.label}
                                            <span className="ml-1 text-xs text-muted-foreground">({d.total})</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="min-w-44">
                                            {renderFormats(d)}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                ))}
                        </DropdownMenuGroup>
                    </>
                ) : null}

                {/* ── language priority (localized data · bulk exports only) ── */}
                {showLangControl ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>{t("export_language")}</DropdownMenuLabel>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <Icon name="globe" className="size-3.5 text-muted-foreground" />
                                    {t("export_language_priority")}
                                    <span className="ml-auto pl-3 text-xs uppercase text-muted-foreground">
                                        {langPriority.join(" › ")}
                                    </span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="min-w-44">
                                    <DropdownMenuRadioGroup
                                        value={primaryLang || langPriority[0]}
                                        onValueChange={setPrimaryLang}
                                    >
                                        {langExport!.options.map((code) => (
                                            <DropdownMenuRadioItem key={code} value={code}>
                                                {t(`lang_${code}`)}
                                                <span className="ml-1 text-xs uppercase text-muted-foreground">({code})</span>
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        </DropdownMenuGroup>
                    </>
                ) : null}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onPrint}>
                    <Icon name="printer" className="size-3.5 text-muted-foreground" />
                    {t("export_print")}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default DataExport;
