// DimensionMcpTools.tsx
//
// Exposes a person dimension feed to in-browser AI agents via the Web Model
// Context API (WebMCP), using @mcp-b/react-webmcp. Fully descriptor-driven, so
// every dimension reuses it. Registers TWO tools per dimension:
//
//   • <dimension>_filter      (action) — set search/filter/sort/page-size and
//       navigate. Input is described by a Zod schema MAP built from the descriptor
//       (enum-constrained sort keys, facet values and page sizes), so an agent can
//       only pass legal values. @mcp-b/react-webmcp accepts a Zod schema map
//       (`Record<string, ZodType>`) as `inputSchema` and converts it to JSON Schema
//       at registration (via zod-to-json-schema), so the agent-facing tool carries
//       the full constraint set. All plain JS — no eval, CSP-clean.
//   • <dimension>_query_state (read)   — current criteria, available sorts/facets
//       (with legal option values), the page-size menu, and pagination/counts. An
//       agent reads this FIRST to discover what it can do, then calls _filter.
//
// Robustness / lifecycle:
//   • This component calls hooks unconditionally, so it MUST only be rendered on
//     the client AFTER mount (the parent gates it: `{mounted && <… />}`). It
//     renders nothing.
//   • The `@mcp-b/global` polyfill (which provides `document.modelContext` where
//     the browser has no native WebMCP yet — the API is a Chrome DevTrial) is
//     imported ONCE at the CLIENT ROOT, not here: importing it at module top
//     would run on the SSR bundle where `document` is undefined. See
//     webmcp_polyfill.client.ts and mount it from entry.client.tsx.
//   • useWebMCP re-registers on reference change, so the input schema and the
//     handler/getter are memoized — the tools register once and stay put across
//     navigations, reading live state through a ref.
//
import * as React from "react";
import { useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { useWebMCP, useWebMCPContext } from "@mcp-b/react-webmcp";
import {
    type DimensionDescriptor,
    type RawCriteria,
    parseRaw,
    buildSearch,
    defaultCriteria,
    hasActiveCriteria,
    resolveLimit,
    dimensionToolBase,
} from "~/lib/dimensions/filters";

export interface DimensionMcpToolsProps {
    descriptor: DimensionDescriptor;
    /** Page size + start, echoed from the loader (for the state tool). */
    limit: number;
    offset: number;
    /** Filtered total (the query's total_count) and the count on this page. */
    filteredTotal: number;
    visibleCount: number;
    /**
     * Optional tool-name prefix that disambiguates the SAME dimension across
     * contexts — e.g. a person's votes panel vs. a top-level votes catalogue would
     * otherwise both register `votes_filter`. With `namespace="person"` the tools
     * become `person_votes_filter` / `person_votes_query_state`; omitted → the bare
     * `votes_filter` / `votes_query_state` (current behavior, so existing person
     * dimensions are unchanged unless you opt in). Lower-snake-case recommended.
     */
    namespace?: string;
    /**
     * How the tool descriptions refer to the data subject — defaults to
     * `"the person's"` (unchanged person wording). A top-level category passes
     * e.g. `"all"` or `""` so the prose reads "…filter all votes…" instead of
     * "…filter the person's votes…". Purely cosmetic (affects descriptions only,
     * not names or behavior).
     */
    subject?: string;
}

/** Build the Zod input schema MAP from the descriptor: enum-constrained where the
 *  set is known (sort keys, select facets, page sizes), plain string for open sets
 *  like body, ISO-date regex for the range, booleans for boolean facets. Every field
 *  is optional (an agent sets only what it wants to change). Returned as a Zod schema
 *  map (`Record<string, ZodType>`) — @mcp-b/react-webmcp's supported `inputSchema`
 *  form — which it converts to JSON Schema at registration. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const nonEmptyEnum = (values: string[]) => z.enum(values as [string, ...string[]]);

function buildInputSchema(d: DimensionDescriptor): Record<string, z.ZodType> {
    const shape: Record<string, z.ZodType> = {
        dir: z.enum(["asc", "desc"]).optional(),
        reset: z.boolean().optional(),
    };
    // Only advertise a sort control when there are sort keys to choose from.
    if (d.sorts.length) shape.sort = nonEmptyEnum(d.sorts.map((s) => s.key)).optional();
    // Only advertise free-text search where the dimension actually has one.
    if (d.searchable !== false) shape.q = z.string().optional();

    for (const f of d.facets) {
        if (f.kind === "select") {
            shape[f.param] = (
                f.options.length ? nonEmptyEnum(f.options.map((o) => o.value)) : z.string()
            ).optional();
        } else if (f.kind === "boolean") {
            shape[f.param] = z.boolean().optional();
        } else {
            shape[f.fromParam] = z.string().regex(ISO_DATE).optional();
            shape[f.toParam] = z.string().regex(ISO_DATE).optional();
        }
    }

    // page size — numeric-literal union, e.g. 5 | 10 | 25 | 50 (or a lone literal).
    const sizes = d.pageSize.options;
    if (sizes.length === 1) {
        shape.limit = z.literal(sizes[0]).optional();
    } else if (sizes.length > 1) {
        const literals = sizes.map((n) => z.literal(n)) as [
            z.ZodLiteral<number>,
            z.ZodLiteral<number>,
            ...z.ZodLiteral<number>[],
        ];
        shape.limit = z.union(literals).optional();
    }

    return shape;
}

/** Merge tool input onto the current (or reset) criteria. Empty strings clear a
 *  field; absent fields are left as-is. */
function mergeInput(
    d: DimensionDescriptor,
    current: RawCriteria,
    input: Record<string, unknown>,
): RawCriteria {
    const base = input.reset ? defaultCriteria(d) : current;
    const next: RawCriteria = { ...base, facets: { ...base.facets } };

    if (input.q !== undefined) next.q = String(input.q).trim() || null;
    if (input.sort !== undefined) next.sort = String(input.sort);
    if (input.dir !== undefined) next.dir = input.dir === "asc" ? "asc" : "desc";

    for (const f of d.facets) {
        if (f.kind === "select") {
            if (input[f.param] !== undefined)
                next.facets[f.param] = String(input[f.param]) || null;
        } else if (f.kind === "boolean") {
            if (input[f.param] !== undefined)
                next.facets[f.param] =
                    input[f.param] === null ? null : String(Boolean(input[f.param]));
        } else {
            if (input[f.fromParam] !== undefined)
                next.dateFrom = (input[f.fromParam] as string) || null;
            if (input[f.toParam] !== undefined)
                next.dateTo = (input[f.toParam] as string) || null;
        }
    }

    if (input.limit !== undefined) {
        const n = Number(input.limit);
        next.limit = d.pageSize.options.includes(n) ? n : null;
    }

    return next;
}

export function DimensionMcpTools({
    descriptor,
    limit,
    offset,
    filteredTotal,
    visibleCount,
    namespace,
    subject = "the person's",
}: DimensionMcpToolsProps) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const current = React.useMemo(
        () => parseRaw(descriptor, searchParams),
        [descriptor, searchParams],
    );

    // Live state for the (once-registered) handler/getter to read.
    const ref = React.useRef({
        current,
        searchParams,
        navigate,
        filteredTotal,
        visibleCount,
        offset,
        limit,
    });
    ref.current = {
        current,
        searchParams,
        navigate,
        filteredTotal,
        visibleCount,
        offset,
        limit,
    };

    const inputSchema = React.useMemo(() => buildInputSchema(descriptor), [descriptor]);
    // Namespace disambiguates the same dimension across contexts (person vs.
    // top-level catalogue). Omitted → bare `<dimension>_*` names, as before. Shared
    // with DimensionControls' declarative `toolname` so the two never diverge.
    const toolBase = dimensionToolBase(descriptor.dimension, namespace);
    const filterName = `${toolBase}_filter`;
    const stateName = `${toolBase}_query_state`;

    // "the person's interests" | "all interests" | "interests" (subject="").
    const subjectPhrase = subject ? `${subject} ${descriptor.dimension}` : descriptor.dimension;

    // ── action: apply criteria + navigate ────────────────────────────────────
    const filterDescription = React.useMemo(
        () =>
            `Search, filter, sort and page ${subjectPhrase} list ` +
            `(operates over the whole dataset, not just the visible page) by updating the ` +
            `URL. Call ${stateName} first to see the current state and the legal sort keys, ` +
            `filter values and page sizes.`,
        [subjectPhrase, stateName],
    );

    const handler = React.useCallback(
        async (input: Record<string, unknown>) => {
            const s = ref.current;
            const next = mergeInput(descriptor, s.current, input);
            const search = buildSearch(descriptor, next, s.searchParams);
            s.navigate({ search: search ? `?${search}` : "" }, { preventScrollReset: true });
            return {
                applied: next,
                url: search ? `?${search}` : "(defaults)",
                note: "The list reloads with the new criteria; read query_state for updated counts.",
            };
        },
        [descriptor],
    );

    useWebMCP({ name: filterName, description: filterDescription, inputSchema, handler });

    // ── read: current state + the menu of legal inputs ───────────────────────
    const stateDescription = React.useMemo(
        () =>
            `Current search/filter/sort/page state for ${subjectPhrase} ` +
            `list, plus the available sort keys, filter options and page sizes. Read before ` +
            `calling ${filterName}.`,
        [subjectPhrase, filterName],
    );

    const getState = React.useCallback(() => {
        const s = ref.current;
        return {
            dimension: descriptor.dimension,
            criteria: s.current,
            active: hasActiveCriteria(descriptor, s.current),
            sorts: descriptor.sorts.map((x) => x.key),
            facets: descriptor.facets.map((f) =>
                f.kind === "dateRange"
                    ? { kind: f.kind, fromParam: f.fromParam, toParam: f.toParam }
                    : f.kind === "boolean"
                        ? { kind: f.kind, param: f.param }
                        : { kind: f.kind, param: f.param, options: f.options.map((o) => o.value) },
            ),
            pagination: {
                limit: resolveLimit(descriptor, s.current),
                offset: s.offset,
                filteredTotal: s.filteredTotal,
                visibleCount: s.visibleCount,
                pageSizes: descriptor.pageSize.options,
                defaultPageSize: descriptor.pageSize.default,
            },
        };
    }, [descriptor]);

    useWebMCPContext(stateName, stateDescription, getState);

    return null;
}

export default DimensionMcpTools;