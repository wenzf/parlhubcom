// ChartExportDialogImpl.tsx   → ~/components/opd_views/shared/ChartExportDialogImpl.tsx
//
// The heavy half of the export experience: the modal with the live preview, the
// colour / label / title editors, theme·size·format controls and the PNG/SVG
// serializer. It is code-split — <ChartExportDialog> in ./ChartExport lazily
// imports THIS module and shows a spinner while the chunk downloads — so the
// export UI (and svg_export's canvas code) never ships in the base bundle.

import * as React from "react";
import { createPortal } from "react-dom";
import { makeT } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { ControlGroup, ControlRow } from "@/components/ui/control-group";
import { Switch } from "@/components/ui/switch";
import {
    exportChart,
    exportThemeCssVars,
    EXPORT_CREDITS,
    type ExportTheme,
} from "~/lib/export/svg";
import {
    FullscreenChart,
    type ChartExportDialogProps,
    type ChartExportRenderCtx,
} from "./ChartExport";

const BTN =
    "inline-flex h-11 items-center gap-1.5 rounded-md border border-input bg-background " +
    "px-2.5 text-xs text-muted-foreground shadow-sm outline-none hover:text-foreground " +
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "disabled:pointer-events-none disabled:opacity-50";

const TOGGLE = (on: boolean) =>
    "h-11 rounded-md border px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    (on
        ? "border-primary bg-primary/10 text-primary"
        : "border-input bg-background text-muted-foreground hover:bg-muted");

const NO_COLOR = "#94a3b8";
const SIZES: Record<"sm" | "md" | "lg", number> = { sm: 900, md: 1400, lg: 2200 };

/* ------------------------------- modal shell ------------------------------ */

function Modal({
    open,
    onClose,
    closeLabel,
    children,
}: {
    open: boolean;
    onClose: () => void;
    closeLabel: string;
    children: React.ReactNode;
}) {
    React.useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open || typeof document === "undefined") return null;
    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
            <div className="relative flex min-h-full items-start justify-center p-4 sm:items-center">
                <div className="relative z-10 my-6 w-full max-w-5xl">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={closeLabel}
                        className="absolute -right-2 -top-2 z-20 flex size-11 items-center justify-center rounded-full border border-input bg-background text-muted-foreground shadow-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <Icon name="x" className="size-4" />
                    </button>
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}

/* -------------------------------- dialog ---------------------------------- */

export default function ChartExportDialogImpl({
    open,
    onClose,
    loc,
    filename,
    series,
    defaultTitle,
    defaultSubtitle,
    explorable = false,
    linkifyBase,
    legend: legendOption = false,
    extraControls,
    children,
}: ChartExportDialogProps) {
    const t = React.useMemo(() => makeT(loc ?? {}), [loc]);

    const defaults = React.useMemo(() => {
        const m: Record<string, string> = {};
        for (const s of series) m[s.key] = s.color;
        return m;
    }, [series]);
    const defaultLabels = React.useMemo(() => {
        const m: Record<string, string> = {};
        for (const s of series) m[s.key] = s.label;
        return m;
    }, [series]);

    const [colors, setColors] = React.useState<Record<string, string>>(defaults);
    const [labels, setLabels] = React.useState<Record<string, string>>(defaultLabels);
    const [title, setTitle] = React.useState(defaultTitle ?? "");
    const [subtitle, setSubtitle] = React.useState(defaultSubtitle ?? "");
    const [theme, setTheme] = React.useState<ExportTheme>("light");
    const [size, setSize] = React.useState<"sm" | "md" | "lg">("md");
    const [format, setFormat] = React.useState<"png" | "svg">("png");
    const [transparent, setTransparent] = React.useState(false);
    const [credits, setCredits] = React.useState(true);
    const [interactive, setInteractive] = React.useState(true);
    const [showLegend, setShowLegend] = React.useState(true);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [fullscreen, setFullscreen] = React.useState(false);

    // Re-seed when the source chart changes (new body / voting).
    React.useEffect(() => {
        setColors(defaults);
        setLabels(defaultLabels);
        setTitle(defaultTitle ?? "");
        setSubtitle(defaultSubtitle ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaults, defaultLabels, defaultTitle, defaultSubtitle]);

    const previewRef = React.useRef<HTMLDivElement>(null);

    const colorFor = React.useCallback(
        (key: string | null | undefined) =>
            (key != null ? colors[key] : undefined) ??
            (key != null ? defaults[key] : undefined) ??
            NO_COLOR,
        [colors, defaults],
    );
    const labelFor = React.useCallback(
        (key: string | null | undefined) =>
            (key != null ? labels[key] : undefined) ??
            (key != null ? defaultLabels[key] : undefined) ??
            (key ?? ""),
        [labels, defaultLabels],
    );

    const ctx = (fs: boolean): ChartExportRenderCtx => ({
        colorFor,
        colors,
        labelFor,
        labels,
        title,
        subtitle,
        theme,
        interactive,
        fullscreen: fs,
    });

    const legendData = () =>
        series.map((s) => ({ label: labelFor(s.key), color: colorFor(s.key) }));
    const wantLegend = legendOption && showLegend && series.length > 0;

    const onExport = async () => {
        setError(null);
        setBusy(true);
        try {
            const svg = previewRef.current?.querySelector("svg") as SVGSVGElement | null;
            if (!svg) throw new Error("no svg");
            await exportChart(svg, {
                format,
                filename,
                pngWidth: SIZES[size],
                frame: {
                    theme,
                    title: title || null,
                    subtitle: subtitle || null,
                    transparent: format === "png" && transparent,
                    credits: credits ? EXPORT_CREDITS : null,
                    stripTitles: !interactive,
                    linkifyBase: interactive ? linkifyBase ?? null : null,
                    legend: wantLegend ? legendData() : null,
                    ...(format === "svg" ? { targetWidth: SIZES[size] } : {}),
                },
            });
        } catch {
            setError(t("chart_export_failed"));
        } finally {
            setBusy(false);
        }
    };

    const resetColors = () => {
        setColors(defaults);
        setLabels(defaultLabels);
    };

    const previewStyle = exportThemeCssVars(theme) as React.CSSProperties;

    return (
        <>
            <Modal open={open} onClose={onClose} closeLabel={t("chart_close")}>
                <div className="flex max-h-[calc(100dvh-5rem)] flex-col rounded-xl border bg-card text-card-foreground shadow-lg">
                    <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
                        <Icon name="download" className="size-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{t("chart_export_title")}</span>
                    </div>

                    <div className="grid min-h-0 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,1fr)_18rem]">
                        {/* -------- live preview (what downloads) -------- */}
                        <div className="min-w-0 space-y-2">
                            <div ref={previewRef} className="overflow-hidden rounded-lg border p-3" style={previewStyle}>
                                {(title || subtitle) ? (
                                    <div className="mb-2 text-center">
                                        {title ? <div className="text-sm font-semibold">{title}</div> : null}
                                        {subtitle ? <div className="text-xs opacity-70">{subtitle}</div> : null}
                                    </div>
                                ) : null}
                                <div className="mx-auto w-full max-w-[70vmin]">{children(ctx(false))}</div>
                                {wantLegend ? (
                                    <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] opacity-80">
                                        {series.map((s) => (
                                            <li key={s.key} className="flex items-center gap-1.5">
                                                <span className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: colorFor(s.key) }} />
                                                {labelFor(s.key)}
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                                {credits ? (
                                    <div className="mt-2 text-center text-[10px] opacity-60">{EXPORT_CREDITS}</div>
                                ) : null}
                            </div>
                            {explorable ? (
                                <button type="button" className={BTN} onClick={() => setFullscreen(true)}>
                                    <Icon name="maximize" className="size-3.5" />
                                    {t("chart_fullscreen")}
                                </button>
                            ) : null}
                        </div>

                        {/* -------- controls -------- */}
                        <div className="space-y-4 text-sm">
                            {/* titles */}
                            <div className="space-y-2">
                                <label className="grid gap-1">
                                    <span className="text-xs text-muted-foreground">{t("chart_title")}</span>
                                    <input
                                        name="chart-title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="h-11 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        placeholder={t("chart_title_ph")}
                                    />
                                </label>
                                <label className="grid gap-1">
                                    <span className="text-xs text-muted-foreground">{t("chart_subtitle")}</span>
                                    <input
                                        name="chart-subtitle"
                                        value={subtitle}
                                        onChange={(e) => setSubtitle(e.target.value)}
                                        className="h-11 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        placeholder={t("chart_subtitle_ph")}
                                    />
                                </label>
                            </div>

                            {/* colours & labels */}
                            {series.length > 0 ? (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">{t("chart_colors")}</span>
                                        <button
                                            type="button"
                                            onClick={resetColors}
                                            className="inline-flex min-h-11 items-center rounded-sm text-xs text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        >
                                            {t("chart_reset")}
                                        </button>
                                    </div>
                                    <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
                                        {series.map((s) => (
                                            <li key={s.key} className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    name={`chart-color-${s.key}`}
                                                    value={colors[s.key] ?? s.color}
                                                    onChange={(e) => setColors((c) => ({ ...c, [s.key]: e.target.value }))}
                                                    className="size-11 shrink-0 cursor-pointer rounded border border-input bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                                    aria-label={`${t("chart_color_for")} ${s.label}`}
                                                />
                                                <input
                                                    name={`chart-label-${s.key}`}
                                                    value={labels[s.key] ?? s.label}
                                                    onChange={(e) => setLabels((l) => ({ ...l, [s.key]: e.target.value }))}
                                                    className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                                    aria-label={`${t("chart_label_for")} ${s.label}`}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            {extraControls ? <div className="space-y-1.5">{extraControls(ctx(false))}</div> : null}

                            {/* format · theme · size */}
                            <ControlGroup label={t("chart_output")}>
                                <ControlRow label={t("chart_format")}>
                                    <Segmented size="sm" value={format} onValueChange={(v) => setFormat(v as "png" | "svg")}>
                                        <SegmentedItem value="png">PNG</SegmentedItem>
                                        <SegmentedItem value="svg">SVG</SegmentedItem>
                                    </Segmented>
                                </ControlRow>
                                <ControlRow label={t("chart_theme")}>
                                    <Segmented size="sm" value={theme} onValueChange={(v) => setTheme(v as ExportTheme)}>
                                        <SegmentedItem value="light">{t("chart_theme_light")}</SegmentedItem>
                                        <SegmentedItem value="dark">{t("chart_theme_dark")}</SegmentedItem>
                                    </Segmented>
                                </ControlRow>
                                <ControlRow label={t("chart_size")}>
                                    <Segmented size="sm" value={size} onValueChange={(v) => setSize(v as "sm" | "md" | "lg")}>
                                        <SegmentedItem value="sm">SM</SegmentedItem>
                                        <SegmentedItem value="md">MD</SegmentedItem>
                                        <SegmentedItem value="lg">LG</SegmentedItem>
                                    </Segmented>
                                </ControlRow>
                            </ControlGroup>

                            {/* toggles (immediate on/off switches) */}
                            <ControlGroup label={t("chart_options")}>
                                {legendOption ? (
                                    <ControlRow label={t("chart_show_legend")} asLabel>
                                        <Switch checked={showLegend} onCheckedChange={setShowLegend} />
                                    </ControlRow>
                                ) : null}
                                {format === "png" ? (
                                    <ControlRow label={t("chart_transparent")} asLabel>
                                        <Switch checked={transparent} onCheckedChange={setTransparent} />
                                    </ControlRow>
                                ) : null}
                                <ControlRow label={t("chart_interactive")} asLabel>
                                    <Switch checked={interactive} onCheckedChange={setInteractive} />
                                </ControlRow>
                                <ControlRow label={t("chart_credits")} asLabel>
                                    <Switch checked={credits} onCheckedChange={setCredits} />
                                </ControlRow>
                            </ControlGroup>

                            <div className="flex items-center gap-2 pt-1">
                                <button type="button" disabled={busy} onClick={onExport} className={TOGGLE(true) + " gap-1.5"}>
                                    <Icon name="download" className="size-3.5" />
                                    {busy ? t("chart_exporting") : t("chart_download")}
                                </button>
                                {error ? <span className="text-xs text-destructive">{error}</span> : null}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {explorable ? (
                <FullscreenChart
                    open={fullscreen}
                    onClose={() => setFullscreen(false)}
                    title={[title, subtitle].filter(Boolean).join(" · ") || t("chart_fullscreen")}
                    loc={loc}
                >
                    <div className="flex h-full w-full items-center justify-center" style={previewStyle}>
                        {children(ctx(true))}
                    </div>
                </FullscreenChart>
            ) : null}
        </>
    );
}
