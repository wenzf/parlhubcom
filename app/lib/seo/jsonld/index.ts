// /app/lib/seo/jsonld — schema.org JSON-LD structured data.
//
//   root layout:    <JsonLd data={siteJsonLd()} />   (Organization + WebSite)
//   every other page: head @graph built in the leaf meta() from the per-entity
//                     node builders + dataset builders (metas factory seam).
//
// Engine: graph.ts (buildGraph / jsonLdTag / safeJsonLd). Node identity: ids.ts.

export * from "./core";
export * from "./graph";
export * from "./ids";
export * from "./site";
export * from "./dataset";
export * from "./breadcrumbs";

// Per-entity node builders (plugged into the metas factory seam, metas/*.ts).
export * from "./person";
export * from "./body";
export * from "./affair";
export * from "./group";
export * from "./meeting";
export * from "./interest";
export * from "./organization";
export * from "./speech";
export * from "./text";
export * from "./doc";
export * from "./list";
