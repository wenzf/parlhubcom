// /app/lib/seo/metas/factory.ts
//
// Two factories that collapse the repetitive shape shared by every entity's
// sub-routes and catalog page. An entity file supplies a `resolveFacts`
// extractor + localized copy tables; the factory returns a ready-to-export
// `meta()` builder. This is what keeps `person.ts`, `body.ts`, … to *copy +
// facts* rather than repeated control flow.

import type { MetaDescriptor } from "react-router";
import {
    type MetaLang,
    type MetaSpec,
    type EntityMetaCtx,
    metaLang,
    buildMeta,
    countStr,
    readCount,
    joinParts,
    withCtx,
    SITE_NAME,
} from "./core";
import type { MetaKey } from "./keys";
import { metaLoc, substitute, mt } from "./loc";
// Imported from the leaf engine modules (not the barrel) so the metas → jsonld
// dependency stays one-directional: graph.ts has no metas import, no cycle.
import { jsonLdTag } from "~/lib/seo/jsonld/graph";
import { breadcrumbListJsonLd } from "~/lib/seo/jsonld/breadcrumbs";
import { catalogueDatasetNodes, type DatasetsBuilder } from "~/lib/seo/jsonld/dataset";

/* -------------------------------------------------------------------------- */
/* JSON-LD node hook: the seam per-entity node builders plug into              */
/* -------------------------------------------------------------------------- */

/** Build the entity's schema.org graph nodes for one page (empty = emit none).
 *  Supplied per entity in `metas/*.ts` (Session 2+); no entity supplies one yet. */
export type NodeBuilder<T> = (
    data: T | null | undefined,
    lang: MetaLang,
    path: string | undefined,
) => object[];

/**
 * Append the page's BreadcrumbList graph to the bespoke one-off metas
 * (home/about/faq/data_map) that call `buildMeta` directly instead of through a
 * factory. Emits nothing when the page has no breadcrumb config (e.g. the
 * homepage), so it's safe to wrap every one-off `meta()`.
 */
export function withBreadcrumbs(
    tags: MetaDescriptor[],
    matches?: unknown[] | undefined,
    params?: Record<string, string | undefined> | undefined,
): MetaDescriptor[] {
    return [...tags, ...jsonLdTag(breadcrumbListJsonLd(matches, params))];
}

/* -------------------------------------------------------------------------- */
/* Facts: the minimal thing buildMeta needs from any entity                   */
/* -------------------------------------------------------------------------- */

/** The three things every title/description is built from. */
export interface EntityFacts {
    /** Primary label — person name, body name, affair title. */
    label: string;
    /** Context clause — "SVP, Nationalrat", "Motion · erledigt", … (may be ""). */
    ctx: string;
    /** og:image, if the entity has a representative image. */
    image?: string | undefined;
}

/** Extract facts for the active language, or null when the record is absent. */
export type FactsResolver<T> = (
    data: T | null | undefined,
    lang: MetaLang,
) => EntityFacts | null;

/* -------------------------------------------------------------------------- */
/* Dimension builder (person votes/speeches, body votings/affairs, …)         */
/* -------------------------------------------------------------------------- */

export interface DimensionConfig<D extends string, T> {
    /** Entity fact extractor (name/title + context + image). */
    resolveFacts: FactsResolver<T>;
    /** loc_metas key prefix: title/desc come from
     *  `${copyPrefix}.${dimension}.{title,desc}` (tokens `{name}`/`{ctx}`/`{count}`).
     *  `{ctx}` receives the parenthesised `withCtx(facts.ctx)`. */
    copyPrefix: string;
    /** Response field holding the dimension's `total_count` (null = no count). */
    countKey: Record<D, string | null>;
    /** og:type for these pages (default "website"). */
    type?: MetaSpec["type"];
    /** Optional schema.org graph nodes for this entity (Session 2+). */
    node?: NodeBuilder<T>;
    /** Per-dimension graph nodes (Session 5): the visible feed slice as nodes keyed
     *  to the page entity by @id — VoteAction on /votes, CreativeWork on /speeches,
     *  OrganizationRole on /memberships, … Emitted in addition to `node`. */
    dimNode?: Partial<Record<D, NodeBuilder<T>>>;
    /** Optional Dataset graph nodes for the bulk exports (Session 5). */
    datasets?: DatasetsBuilder<T>;
}

/**
 * Build a `meta()` function for an entity's sub-routes. The returned builder
 * pulls facts from the shared base block, folds the dimension's `total_count`
 * into a localized title + description, and delegates to `buildMeta`.
 *
 *   export const bodyDimensionMeta = makeDimensionMeta({ resolveFacts, copy, countKey })
 *   // route: bodyDimensionMeta(data, "votings", { lang, path })
 */
export function makeDimensionMeta<D extends string, T>(
    config: DimensionConfig<D, T>,
): (data: T | null | undefined, dimension: D, ctx?: EntityMetaCtx) => MetaDescriptor[] {
    return (data, dimension, ctx = {}) => {
        const { lang, path } = ctx;
        const L = metaLang(lang);
        const facts = config.resolveFacts(data, L);
        const label = facts?.label ?? SITE_NAME;
        const count = countStr(readCount(data, config.countKey[dimension]), L);

        const loc = metaLoc(ctx.matches);
        const vars = { name: label, ctx: withCtx(facts?.ctx ?? ""), count };
        const title = substitute(mt(loc, `${config.copyPrefix}.${dimension}.title` as MetaKey), vars);
        const description = substitute(mt(loc, `${config.copyPrefix}.${dimension}.desc` as MetaKey), vars);

        const tags = buildMeta({
            title,
            description,
            path,
            lang: L,
            type: config.type,
            image: facts?.image,
        });

        // One deduped @graph per page: breadcrumbs + entity nodes + this dimension's
        // sub-list nodes + the bulk Dataset nodes.
        return [
            ...tags,
            ...jsonLdTag([
                ...breadcrumbListJsonLd(ctx.matches, ctx.params),
                ...(config.node?.(data, L, path) ?? []),
                ...(config.dimNode?.[dimension]?.(data, L, path) ?? []),
                ...(config.datasets?.(data, L, path, ctx.matches, ctx.params) ?? []),
            ]),
        ];
    };
}

/* -------------------------------------------------------------------------- */
/* Overview builder (a single record's landing page)                          */
/* -------------------------------------------------------------------------- */

export interface OverviewConfig<T> {
    resolveFacts: FactsResolver<T>;
    /** loc_metas key prefix: the "what you find on this page" tail clause (appended
     *  after label — ctx) comes from `${copyPrefix}.tail` (token `{site}`). */
    copyPrefix: string;
    type?: MetaSpec["type"];
    /** Optional schema.org graph nodes for this entity (Session 2+). */
    node?: NodeBuilder<T>;
    /** Optional Dataset graph nodes for the bulk exports (Session 5). */
    datasets?: DatasetsBuilder<T>;
}

/**
 * Build a `meta()` function for an entity's overview / detail page. Title is the
 * record's label; description is "Label — context. <what you find here>". For
 * records with richer, search-driven descriptions (people), write the builder by
 * hand instead — this covers the uniform "label + context + tail" majority.
 */
export function makeOverviewMeta<T>(
    config: OverviewConfig<T>,
): (data: T | null | undefined, ctx?: EntityMetaCtx) => MetaDescriptor[] {
    return (data, ctx = {}) => {
        const { lang, path } = ctx;
        const L = metaLang(lang);
        const facts = config.resolveFacts(data, L);
        const label = facts?.label ?? SITE_NAME;
        const head = joinParts([label, facts?.ctx ?? ""], " — ");

        const loc = metaLoc(ctx.matches);
        const tail = substitute(mt(loc, `${config.copyPrefix}.tail` as MetaKey), { site: SITE_NAME });

        const tags = buildMeta({
            title: label,
            description: `${head}. ${tail}`,
            path,
            lang: L,
            type: config.type,
            image: facts?.image,
        });

        // One deduped @graph per page: breadcrumbs + entity nodes + the bulk Dataset nodes.
        return [
            ...tags,
            ...jsonLdTag([
                ...breadcrumbListJsonLd(ctx.matches, ctx.params),
                ...(config.node?.(data, L, path) ?? []),
                ...(config.datasets?.(data, L, path, ctx.matches, ctx.params) ?? []),
            ]),
        ];
    };
}

/* -------------------------------------------------------------------------- */
/* Index builder (searchable catalog pages)                                   */
/* -------------------------------------------------------------------------- */

export interface IndexMetaCtx extends EntityMetaCtx {
    /** Free-text search term, from `?q`. */
    query?: string | null | undefined;
    /** True when any search / facet / sort is active (drives noindex). */
    filtered?: boolean | undefined;
    /** Page offset (`?offset`). Non-zero pages are canonicalized to the first page,
     *  so the ItemList node is emitted only when this is 0/absent. */
    offset?: number | undefined;
}

export interface IndexConfig<T> {
    /** loc_metas key prefix: copy comes from
     *  `${copyPrefix}.{title,desc,searchTitle,searchDesc}` (tokens `{q}`/`{count}`/`{site}`). */
    copyPrefix: string;
    /** Response field holding the list's `total_count`, e.g. "people". */
    countKey: string;
    type?: MetaSpec["type"];
    /** Optional schema.org graph nodes for this index (Session 4: ItemList). */
    node?: NodeBuilder<T>;
    /** The catalogue's bulk-export descriptor (Session 5) — the whole list as one
     *  Dataset. `segment` = export URL segment, `datasetKey` = resource-route list
     *  key; the label reuses the index `${copyPrefix}.title`. Emitted on the canonical
     *  first page only (like the ItemList), and only when the list is non-empty. */
    catalogueDataset?: { segment: string; datasetKey: string };
}

/**
 * Build a `meta()` function for an entity's catalog / index page. Reflects an
 * active `?q` in title + description, folds in the total match count, and marks
 * search/filtered views `noindex` (canonical already points at the clean path
 * since `path` excludes the query string).
 */
export function makeIndexMeta<T>(
    config: IndexConfig<T>,
): (data: T | null | undefined, ctx?: IndexMetaCtx) => MetaDescriptor[] {
    return (data, ctx = {}) => {
        const { lang, path, query, filtered, offset } = ctx;
        const L = metaLang(lang);
        const total = readCount(data, config.countKey);
        const count = countStr(total, L);
        const q = query?.trim() || "";

        // The base list title (also reused as the catalogue Dataset label below).
        const loc = metaLoc(ctx.matches);
        const p = config.copyPrefix;
        const indexTitle = mt(loc, `${p}.title` as MetaKey);
        const title = q ? substitute(mt(loc, `${p}.searchTitle` as MetaKey), { q }) : indexTitle;
        const description = q
            ? substitute(mt(loc, `${p}.searchDesc` as MetaKey), { q, count, site: SITE_NAME })
            : substitute(mt(loc, `${p}.desc` as MetaKey), { count, site: SITE_NAME });

        const tags = buildMeta({
            title,
            description,
            path,
            lang: L,
            type: config.type,
            // Don't index the long tail of search/filter permutations.
            robots: q || filtered ? "noindex, follow" : undefined,
        });

        // The ItemList belongs only on the clean, canonical first page — searched /
        // filtered views are noindex, paged views canonicalize to page 1. Breadcrumbs
        // stay on every page.
        const canonicalFirstPage = !q && !filtered && !offset;
        return [
            ...tags,
            ...jsonLdTag([
                ...breadcrumbListJsonLd(ctx.matches, ctx.params),
                ...(canonicalFirstPage ? (config.node?.(data, L, path) ?? []) : []),
                ...(canonicalFirstPage && config.catalogueDataset && total
                    ? catalogueDatasetNodes({
                        ...config.catalogueDataset,
                        label: indexTitle,
                        lang: L,
                        pagePath: path ?? "",
                        langParam: ctx.params?.lang,
                        matches: ctx.matches,
                    })
                    : []),
            ]),
        ];
    };
}
