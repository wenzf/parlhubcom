// /app/lib/seo/metas/keys.ts
//
// The typed key contract for the SEO copy that lives under the `"metas"` key of
// the locale namespace a route's subtree already loads (entity pages →
// `public/locales/<lang>/loc_data_dashboard.json` `"metas"`). This is the single
// source of truth for which keys the metas builders read; the `verify:metas`
// script asserts every language's `metas` block has EXACTLY this key set (no
// missing / no extra), which is what replaces the compile-time exhaustiveness the
// old `Record<MetaLang, …>` copy tables gave us. A key read at runtime that isn't
// present throws in dev (see `mt()` in `loc.ts`), so a typo can never silently
// ship a raw key into <title>.
//
// Keys are flat dotted strings. Adding copy for a new entity (Phase 3) = append
// its keys here + fill each language's `metas` block + register in `verify:metas`.

/** The four catalog/index keys every entity's `makeIndexMeta({ copyPrefix })` reads. */
const indexKeys = (p: string) =>
    [`${p}.index.title`, `${p}.index.desc`, `${p}.index.searchTitle`, `${p}.index.searchDesc`] as const;

/** The title+desc pair every `makeDimensionMeta({ copyPrefix })` reads per dimension. */
const dimKeys = (p: string, dims: readonly string[]) =>
    dims.flatMap((d) => [`${p}.dim.${d}.title`, `${p}.dim.${d}.desc`] as const);

/** The `title`+`desc` pair a bespoke one-off page (home/about/…) reads via `mt()`. */
const pageKeys = (p: string) => [`${p}.title`, `${p}.desc`] as const;

/** Person dimensions with their own title/desc copy (mirrors PersonDimension). */
const PERSON_DIMS = [
    "votes",
    "alignment",
    "lobby",
    "contributions",
    "interests",
    "memberships",
    "speeches",
    "images",
    "vocabulary",
] as const;

/** Dimensions per entity that route through `makeDimensionMeta({ copyPrefix })`
 *  (mirror each entity's `<Entity>Dimension` union). */
const GROUP_DIMS = ["contributions", "meetings", "memberships", "votings"] as const;
const MEETING_DIMS = ["agendas", "votings", "speeches", "docs", "events", "contributors"] as const;
const AFFAIR_DIMS = ["votings", "contributors", "speeches", "docs", "events", "texts"] as const;
const BODY_DIMS = [
    "people", "votings", "affairs", "docs", "texts",
    "loyalty", "alignment", "lobby", "discussion",
] as const;

/** Every loc_metas key the code reads. */
export const META_KEYS = [
    // Person — born/age clause variants (picked in TS by data shape).
    "person.born",
    "person.bornNoAge",
    "person.bornDied",
    // Person — overview description fragments (assembled in TS).
    "person.overview.contactLabel",
    "person.overview.tail",
    // Person — per-dimension title + description.
    ...PERSON_DIMS.flatMap((d) => [`person.dim.${d}.title`, `person.dim.${d}.desc`] as const),
    // Person — catalog / search index.
    ...indexKeys("person"),

    // Leaf entities — overview tail clause + catalog/search index.
    "voting.tail", ...indexKeys("voting"),
    "doc.tail", ...indexKeys("doc"),
    "text.tail", ...indexKeys("text"),
    "speech.tail", ...indexKeys("speech"),
    "interest.tail", ...indexKeys("interest"),
    // Organization — bespoke overview description + catalog/search index.
    "organization.overview", ...indexKeys("organization"),

    // Entities with dimension sub-routes — tail + per-dimension title/desc + index.
    "group.tail", ...dimKeys("group", GROUP_DIMS), ...indexKeys("group"),
    "meeting.tail", ...dimKeys("meeting", MEETING_DIMS), ...indexKeys("meeting"),
    "affair.tail", ...dimKeys("affair", AFFAIR_DIMS), ...indexKeys("affair"),
    "body.tail", ...dimKeys("body", BODY_DIMS), ...indexKeys("body"),

    // Bulk-export Dataset (schema.org JSON-LD) description — scope vs. no-scope
    // sibling variants, tokens {label}/{scope}/{site} (jsonld/dataset.ts).
    "dataset.desc",
    "dataset.descNoScope",

    // Bespoke one-off pages — plain title + description, each in its own namespace
    // (home→loc_home, about→loc_about, faq→loc_faq, data_map→loc_data_map,
    // start→loc_start, data_guide→loc_guide, methodology→loc_methodology,
    // wordfish→loc_experiments,
    // sustainability→loc_sustainability, accessibility→loc_accessibility,
    // traffic_stats→loc_traffic_stats, imprint→loc_imprint) except
    // project + experiments, whose pages have no own loader and read loc_main.
    ...pageKeys("home"),
    ...pageKeys("about"),
    ...pageKeys("faq"),
    ...pageKeys("sustainability"),
    ...pageKeys("traffic_stats"),
    ...pageKeys("accessibility"),
    ...pageKeys("data_map"),
    ...pageKeys("start"),
    ...pageKeys("data_guide"),
    ...pageKeys("methodology"),
    ...pageKeys("imprint"),
    ...pageKeys("wordfish"),
    ...pageKeys("project"),
    ...pageKeys("experiments"),
] as const;

export type MetaKey = (typeof META_KEYS)[number];
