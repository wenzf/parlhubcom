// /app/lib/seo/metas/index.ts
//
// Barrel for the meta builders. Route files import from "~/lib/seo/metas" and
// stay agnostic of the internal split (core engine / factories / per-entity copy).
//
//   export function meta({ loaderData, params, location }: Route.MetaArgs) {
//     const ld = loaderData as unknown as { data?: … }
//     return personDimensionMeta(ld?.data, "votes", { lang: params.lang, path: location.pathname })
//   }

// Generic engine + primitives (available for bespoke one-off pages).
export * from "./core";

// Factories, for adding new entities.
export * from "./factory";

// Static / one-off pages.
export * from "./about";
export * from "./faq";
export * from "./sustainability";
export * from "./traffic_stats";
export * from "./accessibility";
export * from "./home";
export * from "./data_map";
export * from "./data_guide";
export * from "./methodology";
export * from "./imprint";
export * from "./project";
export * from "./start";
export * from "./experiments";

// Per-entity builders.
export * from "./person";
export * from "./body";
export * from "./affair";
export * from "./group";
export * from "./meeting";
export * from "./voting";
export * from "./interest";
export * from "./organization";
export * from "./text";
export * from "./doc";
export * from "./speech";
