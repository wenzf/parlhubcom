// HomeSearchMcpTool.tsx   → ~/components/blocks/HomeSearchMcpTool.tsx
//
// Exposes the homepage search box to in-browser AI agents via the Web MCP API
// (WebMCP), the same channel as DimensionMcpTools / DataExportMcpTool.
//
// Registers ONE action tool, `home_search`, mirroring exactly what the <Form> on
// `/` does: pick a section scope, then navigate to that section's catalogue with
// `?q=`. There is no global search backend — search lives in the catalogues — so
// this tool ROUTES rather than returning rows.
//
// Handoff note: navigating unmounts the homepage and mounts the catalogue, which
// registers its own `<dimension>_filter` / `<dimension>_query_state` tools. So
// an agent's tool list changes as a RESULT of this call; the returned `note`
// tells it to re-read the tool list and continue there. That is the intended
// flow — this tool deliberately does not try to page/filter by itself.
//
// Lifecycle mirrors the other MCP components: hooks run unconditionally, so the
// parent must only render this on the CLIENT after mount (`{mounted && …}`). It
// renders nothing. The `@mcp-b/global` polyfill is mounted once at the client
// root (entry.client.tsx), never here.

import * as React from "react";
import { useNavigate } from "react-router";
import { z } from "zod";
import { useWebMCP } from "@mcp-b/react-webmcp";

import { localizedPath } from "~/lib/lang";
import type { PageNamespaces } from "@/types/site";

export interface HomeSearchMcpToolProps {
    /** The homepage's scope list — single source of truth stays in home.tsx. */
    scopes: { label: string; ns: PageNamespaces }[];
    /** Localized section names, for the agent-facing description (label → name). */
    sections: Record<string, string>;
    /**
     * Per-scope search copy shown to humans under the input (label → hint).
     * Folded into the tool description so an agent knows which fields each
     * scope's `q` actually matches — same information, same source.
     */
    hints?: Record<string, { placeholder?: string; hint?: string }> | undefined;
    /** Active `:lang?` route param, so the target path is language-correct. */
    lang: string | undefined;
    /** Scope the form currently shows — the default when the agent omits one. */
    currentScope: PageNamespaces;
}

export function HomeSearchMcpTool({
    scopes,
    sections,
    hints,
    lang,
    currentScope,
}: HomeSearchMcpToolProps) {
    const navigate = useNavigate();

    // Live values for the once-registered handler to read (see DimensionMcpTools).
    const ref = React.useRef({ scopes, lang, currentScope, navigate });
    ref.current = { scopes, lang, currentScope, navigate };

    const labels = scopes.map((s) => s.label);
    const labelSig = labels.join(",");

    const inputSchema = React.useMemo(
        () => ({
            q: z.string().min(1).describe("Free-text query, e.g. a person or party name."),
            scope: z
                .enum(labels as [string, ...string[]])
                .optional()
                .describe("Which section catalogue to search. Defaults to the scope the page shows."),
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [labelSig],
    );

    const description = React.useMemo(
        () =>
            `Search parlhub's parliamentary data by section. Navigates to the chosen section's ` +
            `catalogue with the query applied (this is what the homepage search box does — there ` +
            `is no global search backend, so no rows are returned here). After the navigation the ` +
            `catalogue registers its own <dimension>_filter and <dimension>_query_state tools: ` +
            `re-read the tool list and use those to refine, sort, page or export the results. ` +
            `Scopes (each with what its query matches): ${scopes
                .map((s) => {
                    const name = sections[s.label] ?? s.label;
                    const what = hints?.[s.label]?.hint;
                    return what ? `${s.label} (${name}) — ${what}` : `${s.label} (${name})`;
                })
                .join(" ")}`,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [labelSig, sections, hints],
    );

    const handler = React.useCallback(async (input: Record<string, unknown>) => {
        const s = ref.current;
        const q = String(input.q ?? "").trim();
        // Omitted scope → whatever the form currently shows (the visible default).
        const picked = input.scope
            ? s.scopes.find((x) => x.label === String(input.scope))
            : s.scopes.find((x) => x.ns === s.currentScope);
        const target = picked ?? s.scopes[0];

        const pathname = localizedPath(s.lang, target.ns);
        const search = q ? `?q=${encodeURIComponent(q)}` : "";
        s.navigate(`${pathname}${search}`);

        return {
            q,
            scope: target.label,
            url: `${pathname}${search}`,
            note:
                `Navigated to the ${target.label} catalogue with q="${q}". The homepage tools are ` +
                `now gone; re-read the tool list for ${target.label}'s _filter / _query_state tools ` +
                `to refine, page or export these results.`,
        };
    }, []);

    useWebMCP({ name: "home_search", description, inputSchema, handler });

    return null;
}

export default HomeSearchMcpTool;
