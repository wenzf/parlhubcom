// /app/lib/seo/jsonld/graph.ts
//
// The JSON-LD engine: assemble a set of schema.org nodes into one deduped
// `@graph` and turn it into a route `meta()` descriptor. This is the seam the
// per-entity node builders (person.ts, body.ts, … — later sessions) plug into:
// a leaf `meta()` collects its nodes and emits a single `script:ld+json` block.
//
// CSP: `<script type="application/ld+json">` is a data block, never executed, so
// the strict script-src does not apply — no nonce needed (see the metas seam).

import type { MetaDescriptor } from "react-router";

/** Serialize for embedding: escape `<` so DB-sourced strings (names, labels)
 *  can never close the script tag (`</script>` injection). */
export function safeJsonLd(data: object): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** A schema.org node carrying an optional `@id` — the dedupe key for buildGraph. */
type GraphNode = Record<string, unknown> & { "@id"?: string };

/**
 * Fold a list of nodes into one `{ "@context", "@graph" }` document, deduping
 * nodes that share an `@id` (first occurrence wins — so the shared Organization
 * referenced by many nodes appears once). Nodes without an `@id` are kept as-is.
 * Callers should treat an empty `nodes` list as "emit nothing" (see jsonLdTag).
 */
export function buildGraph(nodes: object[]): { "@context": string; "@graph": object[] } {
    const seen = new Set<string>();
    const graph: object[] = [];
    for (const node of nodes as GraphNode[]) {
        const id = node["@id"];
        if (typeof id === "string") {
            if (seen.has(id)) continue;
            seen.add(id);
        }
        graph.push(node);
    }
    return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * Wrap `nodes` as a route `meta()` descriptor — `{ "script:ld+json": … }` — or
 * emit nothing when there are no nodes. Returns an array (0 or 1 element) so a
 * leaf `meta()` can spread it unconditionally: `...jsonLdTag(collectedNodes)`.
 */
export function jsonLdTag(nodes: object[]): MetaDescriptor[] {
    if (!nodes.length) return [];
    return [{ "script:ld+json": buildGraph(nodes) }];
}
