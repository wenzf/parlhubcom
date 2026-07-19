// /app/lib/seo/jsonld/list.ts
//
// ItemList graph node for a catalogue index page (/people, /parliaments, …) —
// head JSON-LD replacing the CollectionPage/ItemList microdata the list rows and
// FeedShell used to emit. Each row's entity is expressed with the SAME per-entity
// node builder the detail page uses (person.ts, body.ts, …), so a list of people
// emits Person nodes, a list of bodies GovernmentOrganization nodes, etc.
//
// Only the clean, canonical first page should carry an ItemList — the factory
// withholds it on searched / filtered / paged (noindex or canonicalized) views
// (see makeIndexMeta), so positions are always a gapless 1..n over that page.

/** Pull the entity's canonical node out of a per-entity builder's output: the
 *  node whose `@id` is the `…#identity` anchor (ids.ts). Skips the wrapper nodes
 *  some builders also return (e.g. personNode's ProfilePage). */
function entityNode(nodes: object[]): object | null {
    for (const n of nodes) {
        const id = (n as { "@id"?: unknown })["@id"];
        if (typeof id === "string" && id.endsWith("#identity")) return n;
    }
    return null;
}

/**
 * ItemList node (0 or 1) for a catalogue page slice. `itemNode` is a per-entity
 * builder curried with the page's lang/path; each item's entity node is wrapped
 * in a positional `ListItem`. Rows that resolve to no node (missing name/id) are
 * skipped and the survivors are re-numbered so `position` stays gapless.
 * Returns `[]` for an empty slice — `jsonLdTag` then emits nothing.
 */
export function itemListJsonLd<T>(
    items: T[] | null | undefined,
    itemNode: (item: T) => object[],
): object[] {
    if (!items?.length) return [];
    const itemListElement: object[] = [];
    for (const item of items) {
        const node = entityNode(itemNode(item));
        if (!node) continue;
        itemListElement.push({
            "@type": "ListItem",
            position: itemListElement.length + 1,
            item: node,
        });
    }
    if (!itemListElement.length) return [];
    return [
        {
            "@type": "ItemList",
            numberOfItems: itemListElement.length,
            itemListElement,
        },
    ];
}
