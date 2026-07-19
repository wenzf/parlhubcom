// chart_alt.ts                 → ~/components/opd_views/_shared/chart_alt.ts
//
// The `{ctx}` token of a chart's text alternative (its `aria-label`).
//
// Every chart label is a tokenized template: the JSON holds a flat string with
// `{count}` / `{ctx}` placeholders, the grammar stays in TS and `t(key, vars)`
// fills them (same shape as the SEO copy, see ~/lib/seo/metas/loc.ts). The
// SENTENCE part of a label is always true, so it interpolates counts directly;
// the SCOPE and the WINDOW are not — a body may have no title, a lobby window is
// unset by default — so they ride in one trailing `{ctx}` fact list instead of
// forking the copy into a sibling key per combination. An empty ctx leaves the
// sentence intact (the template's trailing token just resolves to nothing).
//
// Punctuation only, no prose: the separators are the same ones the cards already
// use (" · " between title and scope, "–" for a date range), so nothing here
// needs localizing.

/** ISO date range as one fact, or just the bound that is set. Null when neither is. */
function dateRange(from?: string | null, to?: string | null): string | null {
    if (from && to) return `${from}–${to}`;
    return from || to || null;
}

/** The `{ctx}` token: "Nationalrat · 2025-07-15–2026-07-15", dropping whatever is
 *  absent, "" when nothing is known. */
export function chartCtx(
    scope?: string | null,
    from?: string | null,
    to?: string | null,
): string {
    return [scope, dateRange(from, to)].filter(Boolean).join(" · ");
}
