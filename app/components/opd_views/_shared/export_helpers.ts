// export_helpers.ts
//
// The small, generic wiring shared by every result layout that mounts
// <DataExport> / <DataExportMcpTool>. Each entity family supplies only its own
// CONFIG (which profile fields, which feed datasets); the machinery — building
// the Field/Value table, the paginated bulk descriptor and the export base href
// — lives here so a new entity is a few lines, not a copy of the body wiring.

import { makeT } from "../opd_micros";
import { resolveLangs } from "~/lib/lang";
import { CONTENT_LANGS } from "~/configs/content_langs.config";
import { rawTable } from "~/lib/export/data";
import type { ExportTable, BulkExport } from "./DataExport";

/** The <DataExport langExport> config: the selectable data languages, and the
 *  starting priority — the same per-interface-language default the page content
 *  uses (resolveLangs → content_langs.config; /fr → French-first, …). */
export function langExportConfig(langParam: string | undefined): {
    options: string[];
    initial: string[];
} {
    return { options: [...CONTENT_LANGS], initial: resolveLangs(langParam) };
}

/** A feed dataset the export route can page over: its URL segment + loc label key. */
export interface ExportFeedSpec {
    /** URL segment consumed by the resource route (e.g. "votings"). */
    key: string;
    /** loc key for the menu label. */
    labelKey: string;
}

/** The base a resource route hangs off. Entity-scoped detail pages pass an `id`
 *  (`/en/bodies/42/export`); catalogue pages omit it (`/en/people/export`). */
export function exportBaseHref(
    langParam: string | undefined,
    segment: string,
    id?: number | string,
): string {
    const lang = langParam ? `/${langParam}` : "";
    return id != null ? `${lang}/${segment}/${id}/export` : `${lang}/${segment}/export`;
}

/** A single table whose columns are the row fields (inferred, first-seen order,
 *  nested struct lookups dot-flattened) — the shape for exporting a LIST's
 *  visible rows as-is. */
export function rowsTable(name: string, rows: Record<string, unknown>[]): ExportTable {
    return rawTable(name, rows);
}

/** An entity's own SCALAR fields as a Field/Value table — the generic "this
 *  record" export for a detail page. Nested objects/arrays (joined lookups) and
 *  empty values are skipped; field labels are the raw column names. */
export function entityFieldsTable(
    name: string,
    entity: Record<string, unknown> | null | undefined,
    loc: Record<string, string> | undefined,
): ExportTable {
    const t = makeT(loc ?? {});
    const rows: { field: string; value: string | number }[] = [];
    for (const [k, v] of Object.entries(entity ?? {})) {
        if (v === null || v === undefined || v === "" || typeof v === "object") continue;
        rows.push({ field: k, value: v as string | number });
    }
    return {
        name,
        columns: [
            { key: "field", label: t("export_col_field") },
            { key: "value", label: t("export_col_value") },
        ],
        rows,
    };
}

/** A single Field/Value table from `[label, rawValue]` entries — the shared shape
 *  for exporting any entity's profile. Null / undefined / empty values are dropped
 *  (matching what the detail panels render). */
export function keyValueTable(
    name: string,
    entries: [string, unknown][],
    loc: Record<string, string> | undefined,
): ExportTable {
    const t = makeT(loc ?? {});
    const rows = entries
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([field, value]) => ({ field, value: value as string | number }));
    return {
        name,
        columns: [
            { key: "field", label: t("export_col_field") },
            { key: "value", label: t("export_col_value") },
        ],
        rows,
    };
}

/** Build the bulk-export descriptor from whatever list data the CURRENT page's
 *  primary match already loaded — each `{ …, total_count }` block with rows
 *  becomes a paginated dataset. Returns undefined when the page carries none, so
 *  the caller can omit the bulk menu / the MCP tool entirely. No extra query. */
export function bulkFromData(
    data: Record<string, unknown> | undefined,
    opts: {
        feeds: ExportFeedSpec[];
        baseHref: string;
        pageSize?: number;
        loc?: Record<string, string>;
    },
): BulkExport | undefined {
    if (!data) return undefined;
    const t = makeT(opts.loc ?? {});
    const datasets = opts.feeds.flatMap(({ key, labelKey }) => {
        const block = data[key] as { total_count?: number } | undefined;
        const total = block?.total_count ?? 0;
        return total > 0 ? [{ key, label: t(labelKey), total }] : [];
    });
    if (datasets.length === 0) return undefined;
    return { baseHref: opts.baseHref, pageSize: opts.pageSize ?? 500, datasets };
}

/** Pull `{ …, items }.items` off a response block by key — the visible rows of
 *  one feed. Undefined when the block / list is absent. */
export function feedItems(
    data: Record<string, unknown> | undefined,
    key: string,
): Record<string, unknown>[] | undefined {
    return (data?.[key] as { items?: Record<string, unknown>[] } | undefined)?.items;
}

/** Pull `{ …, total_count }.total_count` off a response block by key — the feed's
 *  FULL size (the "this page" export carries only the visible slice). */
export function feedTotal(
    data: Record<string, unknown> | undefined,
    key: string,
): number | undefined {
    return (data?.[key] as { total_count?: number } | undefined)?.total_count;
}

/** How to read the current DETAIL sub-page's DIMENSION out of its `loaderData.data`:
 *  the dataset label, its visible rows, and (optionally) its full total_count. */
export interface ViewSpec {
    dataset: string;
    rows: (data: Record<string, unknown> | undefined) => Record<string, unknown>[] | undefined;
    total?: (data: Record<string, unknown> | undefined) => number | undefined;
}

/** page_key → ViewSpec. Maps the current sub-page to the feed dimension it shows
 *  so the "this page" export serializes the DIMENSION (not the entity's profile
 *  fields) and the JSON meta names the dataset + its full size. */
export type ViewRowMap = Record<string, ViewSpec>;

/** ViewSpec for the common case: a `{ items, total_count }` block keyed by
 *  `blockKey`. `dataset` defaults to the block key (override when the URL segment
 *  differs, e.g. the alignment page reads the `neighbours` block). */
export function feedView(blockKey: string, dataset?: string): ViewSpec {
    return {
        dataset: dataset ?? blockKey,
        rows: (d) => feedItems(d, blockKey),
        total: (d) => feedTotal(d, blockKey),
    };
}

/** Resolved export info for the current view: the dataset label, its visible
 *  rows, and its full size. */
export interface ViewInfo {
    dataset: string;
    rows: Record<string, unknown>[] | undefined;
    total: number | undefined;
}

/** The ViewInfo of whichever mapped feed sub-page is the DEEPEST current match —
 *  the dimension the user is actually looking at. Walks matches leaf-first, so on
 *  the overview (unmapped) it returns undefined and the caller falls back to
 *  profile fields. Works whether or not the feed page is the primary data match. */
export function viewInfoFromMatches(
    matches: readonly { handle?: unknown; loaderData?: unknown }[],
    map: ViewRowMap,
): ViewInfo | undefined {
    for (let i = matches.length - 1; i >= 0; i--) {
        const key = (matches[i]?.handle as { page_key?: string } | undefined)?.page_key;
        const spec = key ? map[key] : undefined;
        if (spec) {
            const data = (matches[i]?.loaderData as { data?: Record<string, unknown> } | undefined)?.data;
            return { dataset: spec.dataset, rows: spec.rows(data), total: spec.total?.(data) };
        }
    }
    return undefined;
}

/** The tier-1 "this page" tables for an entity DETAIL layout: the current
 *  sub-page's visible feed rows when it maps to one, else the entity's own
 *  profile fields (the overview). One place so every family reads the same. */
export function viewTables(opts: {
    rows: Record<string, unknown>[] | undefined;
    name: string;
    entity: Record<string, unknown> | null | undefined;
    loc: Record<string, string> | undefined;
}): ExportTable[] {
    const { rows, name, entity, loc } = opts;
    return rows && rows.length > 0
        ? [rowsTable(name, rows)]
        : [entityFieldsTable(name, entity, loc)];
}
