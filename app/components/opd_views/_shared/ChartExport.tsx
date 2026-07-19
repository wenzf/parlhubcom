// ChartExport.tsx        → ~/components/opd_views/shared/ChartExport.tsx
//
// The SINGLE, unified export experience shared by every chart on the site
// (votings hemicycle, body member roster, alignment scatter, lobby network,
// loyalty beeswarm). This module is the EAGER, lightweight half:
//
//   • <ChartExportButton /> / <ChartFullscreenButton />  — the triggers, styled
//        identically everywhere.
//   • <FullscreenChart />  — the pan/zoom explore surface (also used directly by
//        alignment & lobby).
//   • <ChartExportDialog />  — a thin wrapper that LAZILY imports the heavy dialog
//        implementation (./ChartExportDialogImpl) on first open and shows a
//        spinner while the chunk downloads, keeping the export UI + svg_export's
//        canvas code out of the base bundle.
//
// A chart plugs in by passing its recolourable `series` (legend) and a
// `children(ctx)` render callback: the dialog hands back the edited colours /
// labels / titles / theme and the chart draws itself with them — inline, in the
// preview, and in the fullscreen surface, from one code path.
//
// Client-only (handlers touch document/canvas) but SSR-safe: portals bail out
// when `document` is undefined and the impl chunk only loads after a click.

import * as React from "react";
import { createPortal } from "react-dom";
import { makeT } from "../opd_micros";
import { Icon } from "../../icons/opd_icons";
import type { ExportTheme } from "~/lib/export/svg";

/* --------------------------------- shared --------------------------------- */

const BTN =
    "inline-flex h-11 items-center gap-1.5 rounded-md border border-input bg-background " +
    "px-2.5 text-xs text-muted-foreground shadow-sm outline-none hover:text-foreground " +
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "disabled:pointer-events-none disabled:opacity-50";

/** A recolourable legend entry the dialog exposes as a colour picker. */
export interface ExportSeries {
    key: string;
    label: string;
    color: string;
}

/** Context the dialog hands to the chart's render callback. */
export interface ChartExportRenderCtx {
    /** series key → colour, with the user's overrides applied. */
    colorFor: (key: string | null | undefined) => string;
    /** raw override map (key → hex) for charts that need it directly. */
    colors: Record<string, string>;
    /** series key → display label, with the user's edits applied. */
    labelFor: (key: string | null | undefined) => string;
    /** raw edited-label map (key → label) for charts that need it directly. */
    labels: Record<string, string>;
    /** edited heading / sub-heading. */
    title: string;
    subtitle: string;
    theme: ExportTheme;
    /** interactive export (keep hover/links) vs a flat still. */
    interactive: boolean;
    /** true when drawn on the fullscreen explore surface. */
    fullscreen: boolean;
}

export interface ChartExportDialogProps {
    open: boolean;
    onClose: () => void;
    loc?: Record<string, string> | undefined;
    /** Download filename WITHOUT extension. */
    filename: string;
    /** Recolourable legend (key, label, default colour). */
    series: ExportSeries[];
    /** Initial editable heading / sub-heading. */
    defaultTitle?: string | null | undefined;
    defaultSubtitle?: string | null | undefined;
    /** Offer a Fullscreen "explore" surface (pan/zoom charts). */
    explorable?: boolean | undefined;
    /** Wrap `data-pid` nodes in person links on interactive export (hemicycle). */
    linkifyBase?: string | null | undefined;
    /** Offer a "Show colour legend" toggle (baked into the exported graphic). */
    legend?: boolean | undefined;
    /** Optional chart-specific controls (e.g. the hemicycle sector re-ordering),
     *  rendered in the controls column. Receives the same ctx as the preview so it
     *  can show live colours. */
    extraControls?: ((ctx: ChartExportRenderCtx) => React.ReactNode) | undefined;
    /** Draw the chart. Called for the preview, the export, and fullscreen. */
    children: (ctx: ChartExportRenderCtx) => React.ReactNode;
}

/* ----------------------------- trigger buttons ---------------------------- */

export interface ChartExportButtonProps {
    onClick: () => void;
    loc?: Record<string, string> | undefined;
    /** Override the default "Edit & export" label. */
    label?: string | undefined;
    /** Extra classes (e.g. `ml-auto` to right-align in a card header). */
    className?: string | undefined;
}

export function ChartExportButton({ onClick, loc, label, className }: ChartExportButtonProps) {
    const t = React.useMemo(() => makeT(loc ?? {}), [loc]);
    return (
        <button
            type="button"
            onClick={onClick}
            aria-haspopup="dialog"
            className={
                "inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-input px-2 py-1 text-xs font-normal " +
                "text-muted-foreground outline-none hover:text-foreground " +
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
                (className ?? "")
            }
        >
            <Icon name="download" className="size-3.5 shrink-0" />
            {label ?? t("chart_export")}
        </button>
    );
}

export interface ChartFullscreenButtonProps {
    onClick: () => void;
    loc?: Record<string, string> | undefined;
    label?: string | undefined;
    className?: string | undefined;
}

/** Standalone "Fullscreen" trigger, styled to match ChartExportButton. */
export function ChartFullscreenButton({ onClick, loc, label, className }: ChartFullscreenButtonProps) {
    const t = React.useMemo(() => makeT(loc ?? {}), [loc]);
    return (
        <button
            type="button"
            onClick={onClick}
            aria-haspopup="dialog"
            className={
                "inline-flex min-h-11 items-center gap-1 rounded-md border border-input px-2 py-1 text-xs font-normal " +
                "text-muted-foreground outline-none hover:text-foreground " +
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
                (className ?? "")
            }
        >
            <Icon name="maximize" className="size-3.5" />
            {label ?? t("chart_fullscreen")}
        </button>
    );
}

/* --------------------------- fullscreen explore --------------------------- */

export interface FullscreenChartProps {
    open: boolean;
    onClose: () => void;
    title?: string | null;
    loc?: Record<string, string> | undefined;
    toolbar?: React.ReactNode;
    children: React.ReactNode;
}

export function FullscreenChart({ open, onClose, title, loc, toolbar, children }: FullscreenChartProps) {
    const t = React.useMemo(() => makeT(loc ?? {}), [loc]);
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
        <div
            className="fixed inset-0 z-[60] flex flex-col bg-background"
            role="dialog"
            aria-modal="true"
            aria-label={title ?? t("chart_fullscreen")}
        >
            <div className="flex items-center gap-3 border-b border-border px-4 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {title ?? t("chart_fullscreen")}
                </span>
                {toolbar}
                <button type="button" onClick={onClose} className={BTN} aria-label={t("chart_close")}>
                    <Icon name="minimize" className="size-3.5" />
                    <span className="hidden sm:inline">{t("chart_close")}</span>
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-3">{children}</div>
        </div>,
        document.body,
    );
}

/* ----------------------- lazy dialog + loading state ---------------------- */

/** Spinning ring (no icon dependency). */
export function Spinner({ className }: { className?: string }) {
    return (
        <span
            role="status"
            aria-label="Loading"
            className={
                "inline-block animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground " +
                (className ?? "size-6")
            }
        />
    );
}

/** Full-screen spinner shown while the export dialog chunk downloads. */
function ExportLoadingOverlay() {
    if (typeof document === "undefined") return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="status" aria-label="Loading">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
            <Spinner className="relative z-10 size-8 border-white/40 border-t-white" />
        </div>,
        document.body,
    );
}

// Code-split: the modal + editors + PNG/SVG serializer ship in a separate chunk
// that only downloads when the dialog is first opened.
const Impl = React.lazy(() => import("./ChartExportDialogImpl"));

export function ChartExportDialog(props: ChartExportDialogProps) {
    // Mount (and thus fetch the chunk) only once the dialog has been opened.
    const [mounted, setMounted] = React.useState(props.open);
    React.useEffect(() => {
        if (props.open) setMounted(true);
    }, [props.open]);

    if (!mounted) return null;
    return (
        <React.Suspense fallback={props.open ? <ExportLoadingOverlay /> : null}>
            <Impl {...props} />
        </React.Suspense>
    );
}