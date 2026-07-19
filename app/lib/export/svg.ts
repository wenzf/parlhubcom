// /app/lib/export/svg.ts
//
// Shared, client-only helpers to export a hand-rendered <svg> as a standalone
// SVG file or a rasterized PNG. Factored out of VotingHemicycleEditor so every
// chart (the body alignment / lobby / loyalty graphics, and the votings
// hemicycle) reuses the same serialize → frame → (svg|png) → download pipeline.
//
// The functions here touch document / canvas and must only run in the browser
// (call them from event handlers, never during render / SSR).

/** CC-BY credit line baked into the framed export footer. */
export const EXPORT_CREDITS = "OpenParlData.ch · parlhub.com · CC BY 4.0";

export type ExportTheme = "light" | "dark";

// Frame palettes. Text colours meet WCAG AAA against each theme's bg. These are
// also injected as CSS custom properties so any `var(--foreground, …)` /
// `currentColor` / Tailwind `text-*` class used inside the live svg resolves in
// the detached export (where the app stylesheet is not present). Exported so the
// unified export dialog can theme its live preview identically to the output.
export const EXPORT_THEMES: Record<
    ExportTheme,
    {
        bg: string;
        fg: string;
        border: string;
        muted: string;
        mutedBg: string;
        card: string;
        popover: string;
        background: string;
    }
> = {
    light: {
        bg: "#ffffff",
        fg: "#111827",
        border: "#cbd5e1",
        muted: "#334155",
        mutedBg: "#e5e7eb",
        card: "#ffffff",
        popover: "#ffffff",
        background: "#ffffff",
    },
    dark: {
        bg: "#0b0b0e",
        fg: "#f4f4f5",
        border: "#3f3f46",
        muted: "#cbd5e1",
        mutedBg: "#27272a",
        card: "#18181b",
        popover: "#18181b",
        background: "#0b0b0e",
    },
};

const THEMES = EXPORT_THEMES;

/** CSS custom properties for a theme — spread onto a preview wrapper's `style`
 *  (cast to CSSProperties by the caller) so the on-screen preview matches export. */
export function exportThemeCssVars(theme: ExportTheme): Record<string, string> {
    const T = THEMES[theme];
    return {
        "--foreground": T.fg,
        "--border": T.border,
        "--muted-foreground": T.muted,
        "--muted": T.mutedBg,
        "--card": T.card,
        "--popover": T.popover,
        "--background": T.background,
        backgroundColor: T.bg,
        color: T.fg,
    };
}

export interface FrameSvgOptions {
    /** Frame theme (background + resolved text/stroke colours). Default "light". */
    theme?: ExportTheme;
    /** Footer credit text; pass `null` to omit the footer entirely. */
    credits?: string | null;
    /** Editable heading drawn in a top band (baked into the export). */
    title?: string | null;
    /** Editable sub-heading drawn under the title. */
    subtitle?: string | null;
    /** Output pixel width (height scales to the viewBox). Default = viewBox width. */
    targetWidth?: number;
    /** Skip the solid background rect (transparent PNG / SVG). */
    transparent?: boolean;
    /** Extra CSS appended to the injected <style> (per-chart class → colour maps). */
    extraCss?: string;
    /** Wrap every `<g data-pid="N">` in a link to `${linkifyBase}N` (person pages). */
    linkifyBase?: string | null;
    /** Remove `<title>` hover tooltips (used for a non-interactive export). */
    stripTitles?: boolean;
    /** Optional colour legend drawn in a band below the chart. */
    legend?: { label: string; color: string }[] | null;
}

const escapeXml = (s: string) =>
    s.replace(/[<>&"]/g, (c) =>
        c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
    );

/**
 * Serialize a LIVE <svg> element into a self-contained, framed SVG string —
 * what you download is exactly what is on screen. Resolves the common theme
 * tokens the app's charts rely on (`--foreground`, `--border`,
 * `--muted-foreground`, `--muted`, `--background`, plus the matching Tailwind
 * `text-*` / `fill-*` utility classes) so the detached graphic keeps its colours.
 */
export function frameSvgElement(
    svgEl: SVGSVGElement,
    opts: FrameSvgOptions = {},
): { svgString: string; width: number; height: number } {
    const T = THEMES[opts.theme ?? "light"];
    const credits = opts.credits === undefined ? EXPORT_CREDITS : opts.credits;
    const title = opts.title?.trim() || null;
    const subtitle = opts.subtitle?.trim() || null;

    // viewBox → intrinsic size; fall back to width/height attrs, then a default.
    const vbAttr = svgEl.getAttribute("viewBox");
    let [vx, vy, vw, vh] = (vbAttr ?? "").split(/\s+/).map(Number);
    if (!vbAttr || [vx, vy, vw, vh].some((n) => !Number.isFinite(n))) {
        vx = 0;
        vy = 0;
        vw = Number(svgEl.getAttribute("width")) || svgEl.clientWidth || 1040;
        vh = Number(svgEl.getAttribute("height")) || svgEl.clientHeight || 536;
    }

    const header = title || subtitle ? Math.round(vw * (subtitle && title ? 0.12 : 0.08)) : 0;
    const footer = credits ? Math.round(vw * 0.055) : 0;

    // Optional colour legend, wrapped into centred rows below the chart.
    const legendItems = opts.legend && opts.legend.length ? opts.legend : null;
    let legendSvg = "";
    let legendH = 0;
    if (legendItems) {
        const L = Math.max(12, Math.round(vw * 0.02));
        const sw = L;
        const gap = Math.round(L * 0.5);
        const itemGap = Math.round(L * 1.2);
        const rowH = L + Math.round(L * 0.7);
        const maxW = vw * 0.94;
        const textW = (s: string) => s.length * L * 0.58;
        const itemW = (it: { label: string }) => sw + gap + textW(it.label);
        const rows: { label: string; color: string }[][] = [];
        let cur: { label: string; color: string }[] = [];
        let curW = 0;
        for (const it of legendItems) {
            const w = itemW(it);
            if (cur.length && curW + itemGap + w > maxW) {
                rows.push(cur);
                cur = [];
                curW = 0;
            }
            curW += (cur.length ? itemGap : 0) + w;
            cur.push(it);
        }
        if (cur.length) rows.push(cur);
        legendH = rows.length * rowH + Math.round(L * 0.6);
        const y0 = header + vh + Math.round(L * 0.6);
        const parts: string[] = [];
        rows.forEach((row, ri) => {
            const rowW = row.reduce((a, it, i) => a + (i ? itemGap : 0) + itemW(it), 0);
            let x = (vw - rowW) / 2;
            const cy = y0 + ri * rowH + L / 2;
            for (const it of row) {
                parts.push(
                    `<rect x="${x}" y="${cy - sw / 2}" width="${sw}" height="${sw}" rx="${Math.round(sw * 0.2)}" fill="${it.color}"/>`,
                );
                parts.push(
                    `<text x="${x + sw + gap}" y="${cy}" dominant-baseline="middle" font-size="${L}" fill="${T.fg}">${escapeXml(it.label)}</text>`,
                );
                x += itemW(it) + itemGap;
            }
        });
        legendSvg = parts.join("");
    }

    const outW = vw;
    const outH = header + vh + legendH + footer;
    const W = opts.targetWidth ?? vw;
    const H = Math.round((W * outH) / outW);

    let inner = svgEl.innerHTML;
    if (opts.linkifyBase) {
        const base = opts.linkifyBase;
        inner = inner.replace(
            /<g([^>]*?\bdata-pid="(\d+)"[^>]*?)>([\s\S]*?)<\/g>/g,
            (_m, attrs, pid, body) =>
                `<a xlink:href="${base}${pid}" target="_blank"><g${attrs}>${body}</g></a>`,
        );
    }
    if (opts.stripTitles) inner = inner.replace(/<title>[\s\S]*?<\/title>/g, "");

    const cssVars =
        `--foreground:${T.fg};--border:${T.border};--muted-foreground:${T.muted};` +
        `--muted:${T.mutedBg};--card:${T.card};--popover:${T.popover};` +
        `--background:${T.background};color:${T.fg};`;

    const baseCss =
        `text{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}` +
        `svg{${cssVars}}` +
        `.text-border{color:${T.border};}` +
        `.text-foreground{color:${T.fg};}` +
        `.text-muted-foreground{color:${T.muted};}` +
        `.fill-muted-foreground{fill:${T.muted};}` +
        (opts.extraCss ?? "");

    const titleSize = Math.round(vw * 0.03);
    const subSize = Math.round(vw * 0.021);
    const headerSvg =
        header > 0
            ? (title
                ? `<text x="${outW / 2}" y="${subtitle ? header * 0.42 : header * 0.58}" ` +
                `text-anchor="middle" dominant-baseline="middle" font-size="${titleSize}" ` +
                `font-weight="600" fill="${T.fg}">${escapeXml(title)}</text>`
                : "") +
            (subtitle
                ? `<text x="${outW / 2}" y="${title ? header * 0.78 : header * 0.55}" ` +
                `text-anchor="middle" dominant-baseline="middle" font-size="${subSize}" ` +
                `fill="${T.muted}">${escapeXml(subtitle)}</text>`
                : "")
            : "";

    const svgString =
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
        `width="${W}" height="${H}" viewBox="0 0 ${outW} ${outH}">` +
        `<style>${baseCss}</style>` +
        (opts.transparent
            ? ""
            : `<rect x="0" y="0" width="${outW}" height="${outH}" fill="${T.bg}"/>`) +
        headerSvg +
        `<g transform="translate(${-vx},${header - vy})">${inner}</g>` +
        legendSvg +
        (credits
            ? `<text x="${outW / 2}" y="${outH - footer / 2}" text-anchor="middle" ` +
            `dominant-baseline="middle" font-size="13" fill="${T.muted}">${escapeXml(credits)}</text>`
            : "") +
        `</svg>`;

    return { svgString, width: W, height: H };
}

/** Rasterize an SVG string to a PNG Blob (device-pixel-ratio aware, capped 2×). */
export function svgToPngBlob(
    svgString: string,
    width: number,
    height: number,
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const dpr = Math.min(
                typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
                2,
            );
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                URL.revokeObjectURL(url);
                reject(new Error("Canvas 2D context unavailable"));
                return;
            }
            ctx.scale(dpr, dpr);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error("toBlob() returned null"))),
                "image/png",
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("SVG failed to rasterize"));
        };
        img.src = url;
    });
}

/** Download a Blob as `filename` (creates + clicks a transient <a>). */
export function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ExportChartOptions {
    format: "png" | "svg";
    /** Download filename WITHOUT extension. */
    filename: string;
    /** Framing options (theme / credits / transparency / extra css). */
    frame?: FrameSvgOptions;
    /** Rasterize width for PNG (default: max(viewBox width, 1600)). */
    pngWidth?: number;
}

/**
 * High-level convenience: take the <svg> inside `el` (or `el` itself when it is
 * an <svg>), frame it, and download it as PNG or SVG. Throws if no <svg> is
 * found so callers can surface an error to the user.
 */
export async function exportChart(
    el: SVGSVGElement | HTMLElement | null,
    opts: ExportChartOptions,
): Promise<void> {
    const svg =
        el instanceof SVGSVGElement ? el : (el?.querySelector("svg") as SVGSVGElement | null);
    if (!svg) throw new Error("No <svg> element to export");

    const targetWidth =
        opts.format === "png"
            ? opts.pngWidth ??
            Math.max(
                1600,
                Number((svg.getAttribute("viewBox") ?? "0 0 0 0").split(/\s+/)[2]) || 0,
            )
            : opts.frame?.targetWidth;

    const { svgString, width, height } = frameSvgElement(svg, {
        ...opts.frame,
        ...(targetWidth != null ? { targetWidth } : {}),
    });

    if (opts.format === "svg") {
        triggerDownload(
            new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
            `${opts.filename}.svg`,
        );
        return;
    }
    const png = await svgToPngBlob(svgString, width, height);
    triggerDownload(png, `${opts.filename}.png`);
}