// app/components/icons/logo.tsx
//
// The brand marks as an inline SVG sprite, mirroring the IconSprite pattern:
// <LogoSprite/> is mounted once at the root of the :lang? layout, and the
// <LogoWordmark/> / <LogoMark/> components reference its symbols via <use>.
// Everything draws in `currentColor`, so the marks follow the surrounding text
// color (no more fixed-ink SVG files + `dark:invert`), and the wordmark's
// <text> renders in the page's real Inter Variable instead of an <img>
// fallback font. The files in /public/icons/logo*.svg stay for favicons / OG use.

import clsx from "clsx";

/** The sprite. Rendered once in the lang layout; visually hidden. */
export function LogoSprite() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
            {/* Hemicycle band, unequal blocs — the mark alone (square). */}
            <symbol id="logo-mark" viewBox="0 0 48 48" fill="currentColor">
                <g transform="translate(24 24) scale(1.46) translate(-24 -21)">
                    <path d="M39.99 28.44 A16 16 0 0 0 34.71 17.11 L30.02 22.31 A9 9 0 0 1 32.99 28.69 Z" />
                    <path d="M32.95 15.74 A16 16 0 0 0 24.00 13.00 L24.00 20.00 A9 9 0 0 1 29.03 21.54 Z" />
                    <path d="M21.77 13.16 A16 16 0 0 0 16.99 14.62 L20.05 20.91 A9 9 0 0 1 22.75 20.09 Z" />
                    <path d="M15.05 15.74 A16 16 0 0 0 8.01 28.44 L15.01 28.69 A9 9 0 0 1 18.97 21.54 Z" />
                </g>
            </symbol>
            {/* Mark + "parlhub" wordmark (parl 550 / hub 350). */}
            <symbol id="logo-wordmark" viewBox="0 0 168 48" fill="currentColor">
                <g transform="translate(4 11.2) scale(1.6) translate(-8 -13)">
                    <path d="M39.99 28.44 A16 16 0 0 0 34.71 17.11 L30.02 22.31 A9 9 0 0 1 32.99 28.69 Z" />
                    <path d="M32.95 15.74 A16 16 0 0 0 24.00 13.00 L24.00 20.00 A9 9 0 0 1 29.03 21.54 Z" />
                    <path d="M21.77 13.16 A16 16 0 0 0 16.99 14.62 L20.05 20.91 A9 9 0 0 1 22.75 20.09 Z" />
                    <path d="M15.05 15.74 A16 16 0 0 0 8.01 28.44 L15.01 28.69 A9 9 0 0 1 18.97 21.54 Z" />
                </g>
                <text
                    x="64"
                    y="34"
                    fontSize="28"
                    letterSpacing="-0.6"
                    fontFamily="'Inter Variable', Inter, ui-sans-serif, system-ui, sans-serif"
                    style={{ fontWeight: 550 }}
                >
                    parl
                    <tspan style={{ fontWeight: 350 }}>hub</tspan>
                </text>
            </symbol>
        </svg>
    );
}

type LogoProps = {
    className?: string;
    /** Accessible name (role="img"); omit for a purely decorative mark. */
    title?: string;
};

/** The full wordmark (mark + "parlhub"). Size via height classes; the width
 *  follows from the intrinsic 168:48 ratio. Draws in `currentColor`. */
export function LogoWordmark({ className, title }: LogoProps) {
    return (
        <svg
            className={clsx("aspect-[168/48]", className)}
            viewBox="0 0 168 48"
            role={title ? "img" : undefined}
            aria-hidden={title ? undefined : true}
            aria-label={title}
            focusable="false"
        >
            {title ? <title>{title}</title> : null}
            <use href="#logo-wordmark" />
        </svg>
    );
}

/** The square hemicycle mark alone. Draws in `currentColor`. */
export function LogoMark({ className, title }: LogoProps) {
    return (
        <svg
            className={clsx("aspect-square", className)}
            viewBox="0 0 48 48"
            role={title ? "img" : undefined}
            aria-hidden={title ? undefined : true}
            aria-label={title}
            focusable="false"
        >
            {title ? <title>{title}</title> : null}
            <use href="#logo-mark" />
        </svg>
    );
}
