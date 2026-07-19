// components/blocks/skip-link/index.tsx
//
// WCAG 2.4.1 Bypass Blocks: the first focusable element in the body, jumping
// past the header chrome to the page's <main>. Every layout that renders a
// <main> tags it with MAIN_ID + tabIndex={-1} — the id is the link target, and
// the tabindex is what makes the element focusable, so the fragment jump moves
// focus rather than only scrolling.
//
// Not `sr-only focus:not-sr-only`: that pair fights over `position` and the
// winner depends on Tailwind's utility order. Translating a `fixed` element off
// the top of the viewport is deterministic and needs no positioned ancestor.

export const MAIN_ID = "main-content";

export default function SkipLink({ label }: { label: string }) {
    return (
        <a
            href={`#${MAIN_ID}`}
            data-print-hide
            className="fixed top-3 left-3 z-50 inline-flex h-11 -translate-y-[200%] items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-lg outline-none focus:translate-y-0 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
            {label}
        </a>
    );
}
