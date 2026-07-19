// colors.ts                          → ~/lib/export/colors.ts
//
// The single source of truth for the palettes used by the app's diagrams
// (hemicycle, discussion beeswarm, alignment/loyalty scatter, lobby network,
// …). Previously the ordinal party palette lived in VotingChart.tsx and was
// duplicated verbatim in BodyDiscussion.tsx; both now import from here so the
// colours can never drift apart. Keep this file dependency-light (plain
// constants) so any component or SVG-export path can consume it.

/* ------------------------------ party palette ----------------------------- */

// Ordinal palette: distinct, reasonably contrasting hues. Consumers assign
// colours by descending member count so the largest groups get the most
// distinct colours (codepoint tiebreak keeps the assignment SSR-stable).
export const PALETTE = [
    "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea",
    "#0891b2", "#ea580c", "#db2777", "#65a30d", "#4f46e5",
    "#0d9488", "#b45309", "#7c3aed", "#be123c", "#15803d",
    "#475569",
] as const;

/** Fallback for a member with no resolvable party/group key. */
export const NO_PARTY = "#94a3b8";

/** Empty hemicycle seat (falls back to the muted token, then a neutral grey). */
export const EMPTY_SEAT = "var(--muted, #e5e7eb)";

/* ------------------------------ vote outcomes ----------------------------- */

// Calm, limited outcome palette. yes/no stay green/red (the established vote
// convention) but muted; absent is a light neutral so non-votes recede.
export const OUTCOME_COLORS: Record<string, string> = {
    yes: "#4a9d6b",
    no: "#cc6b66",
    abstention: "#c9a14a",
    absent: "#cdd3da",
    president: "#7d8ac4",
    other: "#aab2bc",
};

/** Resolve a normalized outcome key to its colour (unknown → "other"). */
export const outcomeColor = (key: string) =>
    OUTCOME_COLORS[key] ?? OUTCOME_COLORS.other;

/** Deterministic palette assignment: given keys already ordered (e.g. by
 *  descending member count with an SSR-stable tiebreak), map each to a PALETTE
 *  colour cyclically. The single place the ordinal palette is applied, shared by
 *  the hemicycle (VotingChart) and the discussion beeswarm (BodyDiscussion). */
export function assignPaletteByOrder(orderedKeys: string[]): Map<string, string> {
    const color = new Map<string, string>();
    orderedKeys.forEach((key, i) => color.set(key, PALETTE[i % PALETTE.length]));
    return color;
}