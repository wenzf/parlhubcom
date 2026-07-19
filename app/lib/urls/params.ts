// /app/lib/urls/params.ts

/**
 * Validate a pagination offset param: a non-negative integer that is a
 * multiple of `limit`. Returns the parsed offset, or null if invalid.
 * (Pass raw URL search-param value; 0 is valid = first page.)
 */
export function parseOffsetParam(
    raw: string | number | null | undefined,
    limit: number,
): number | null {
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isInteger(n)) return null;
    if (n < 0) return null;
    if (limit <= 0 || n % limit !== 0) return null;
    return n;
}