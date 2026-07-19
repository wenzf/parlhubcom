// DataExportMcpTool.tsx   → ~/components/opd_views/_shared/DataExportMcpTool.tsx
//
// Makes the bulk data export (the <DataExport> "Full dataset" links / the
// /bodies/:id/export/:dataset/:format resource route) DISCOVERABLE to in-browser
// AI agents via the Web MCP API (WebMCP), the same channel as DimensionMcpTools.
//
// It registers ONE action tool, `<toolName>` (e.g. "body_export"), that hands
// back a DOWNLOAD URL for the chosen dataset/format/page rather than streaming
// the rows through the tool result — the agent fetches the file itself. The
// result also carries authoritative row/page counts (read from the resource
// route's X-Total-* headers) and a small JSON preview (columns + first rows) so
// the agent can check the shape before downloading. Active filters/sort in the
// current URL are carried over, so an export matches what `*_query_state` reports.
//
// Lifecycle mirrors DimensionMcpTools: hooks run unconditionally, so this must
// only render on the CLIENT after mount (the parent gates it). It renders
// nothing. The `@mcp-b/global` polyfill is mounted once at the client root.

import * as React from "react";
import { z } from "zod";
import { useWebMCP } from "@mcp-b/react-webmcp";

export interface DataExportMcpToolProps {
    /** Registered tool name, e.g. "body_export". */
    toolName: string;
    /** Absolute base, no trailing slash: `/en/bodies/42/export`. */
    baseHref: string;
    /** Rows per page (the resource route's fixed cap). */
    pageSize: number;
    /** The list datasets available for this entity, with their (unfiltered) totals. */
    datasets: { key: string; label: string; total: number }[];
    /** How the description refers to the subject, e.g. "this institution's". */
    subject?: string;
}

export function DataExportMcpTool({
    toolName,
    baseHref,
    pageSize,
    datasets,
    subject = "",
}: DataExportMcpToolProps) {
    // Live values for the once-registered handler to read.
    const ref = React.useRef({ baseHref, pageSize, datasets });
    ref.current = { baseHref, pageSize, datasets };

    const keys = datasets.map((d) => d.key);
    const keySig = keys.join(",");

    const inputSchema = React.useMemo(() => {
        const datasetEnum = z.enum(keys as [string, ...string[]]);
        return {
            // With a single dataset (a catalogue) the choice is implied → optional.
            dataset: keys.length === 1 ? datasetEnum.optional() : datasetEnum,
            format: z.enum(["json", "csv", "xlsx"]).optional(),
            page: z.number().int().min(1).optional(),
            // Preferred order for localized (de/fr/it/rm/en) fields; first match wins.
            langs: z.array(z.enum(["de", "fr", "it", "rm", "en"])).optional(),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keySig]);

    const description = React.useMemo(
        () =>
            `Get a paginated DOWNLOAD URL for ${subject ? `${subject} ` : ""}full list datasets ` +
            `(${keys.join(", ")}) as JSON, CSV or Excel — ${pageSize} rows per page. Returns the URL for ` +
            `the chosen page plus total row/page counts and a small JSON preview (columns + first rows) so you ` +
            `can inspect the shape before downloading; fetch the URL to get the file. Honors the active ` +
            `filters/sort. Pass \`langs\` (e.g. ["fr","de"]) to prioritize localized fields. ` +
            `Available: ${datasets.map((d) => `${d.key} (${d.total})`).join(", ")}.`,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [keySig, subject, pageSize],
    );

    const handler = React.useCallback(async (input: Record<string, unknown>) => {
        const s = ref.current;
        // Default to the sole dataset when the caller omits it (single-dataset catalogue).
        const dataset = input.dataset ? String(input.dataset) : s.datasets[0]?.key ?? "";
        const format = input.format ? String(input.format) : "json";
        const page = Math.max(1, Math.floor(Number(input.page ?? 1)) || 1);

        // Carry over the active filters/sort from the URL (drop pagination params).
        const search = new URLSearchParams(
            typeof window !== "undefined" ? window.location.search : "",
        );
        search.delete("offset");
        search.set("page", String(page));
        if (Array.isArray(input.langs) && input.langs.length) {
            search.set("langs", input.langs.join(","));
        }
        const qs = search.toString();

        const downloadUrl = `${s.baseHref}/${dataset}/${format}?${qs}`;
        const jsonUrl = `${s.baseHref}/${dataset}/json?${qs}`;

        // Fall back to the known (unfiltered) total if the preview fetch fails.
        let totalCount = s.datasets.find((d) => d.key === dataset)?.total ?? 0;
        let totalPages = Math.max(1, Math.ceil(totalCount / s.pageSize));
        let columns: string[] = [];
        let preview: Record<string, unknown>[] = [];

        try {
            const res = await fetch(jsonUrl, { headers: { accept: "application/json" } });
            totalCount = Number(res.headers.get("X-Total-Count") ?? totalCount);
            totalPages = Number(res.headers.get("X-Total-Pages") ?? totalPages);
            // The JSON export wraps rows as `{ meta, data: [...] }`; older/bare-array
            // shapes are tolerated too.
            const body = (await res.json()) as
                | Record<string, unknown>[]
                | { data?: Record<string, unknown>[] };
            const rows = Array.isArray(body) ? body : body.data ?? [];
            if (Array.isArray(rows)) {
                columns = rows.length ? Object.keys(rows[0]) : [];
                preview = rows.slice(0, 5);
            }
        } catch {
            /* keep URL + known counts even if the preview fetch fails */
        }

        return {
            downloadUrl,
            dataset,
            format,
            page,
            pageSize: s.pageSize,
            totalCount,
            totalPages,
            hasNextPage: page < totalPages,
            columns,
            preview,
            note:
                `downloadUrl streams page ${page} of ${totalPages} (${s.pageSize} rows/page); ` +
                `increment "page" for the rest. CSV/XLSX carry the same rows as the JSON preview.`,
        };
    }, []);

    useWebMCP({ name: toolName, description, inputSchema, handler });

    return null;
}

export default DataExportMcpTool;
