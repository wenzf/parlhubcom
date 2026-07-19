// /app/lib/std/strings.ts

export function excerpt(raw: string | null | undefined, max: number): string | null {
    if (!raw) return null;
    const clean = raw.replace(/\s+/g, " ").trim();
    if (clean === "") return null;
    if (clean.length <= max) return clean;
    const slice = clean.slice(0, max);
    const lastSpace = slice.lastIndexOf(" ");
    const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
    return `${cut.trimEnd()}…`;
}