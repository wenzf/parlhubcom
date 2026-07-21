// /app/lib/seo/jsonld/dataset.ts
//
// schema.org `Dataset` nodes for the bulk exports — the structured-data twin of
// <DataExport>'s "full dataset" tier, fed by the SAME BulkExport descriptor
// (bulkFromData / FeedShell's exportBulk), so it costs no extra query and can
// never drift from what the menu actually offers.
//
// Each bulk feed (votings, affairs, …) becomes one Dataset with a DataDownload
// per format, `publisher` → the site Organization node (by @id), `creator` +
// `isBasedOn` → OpenParlData.ch (the upstream source that collects the records),
// CC BY 4.0. This markup is what makes the exports discoverable in Google Dataset
// Search; `name` + `description` are the mandatory fields there.
//
// Emission = head JSON-LD, built in the leaf `meta()` (Session 5): each entity's
// `metas/*.ts` builds a `DatasetsBuilder` via `makeDatasets` and hands it to the
// factory `datasets` seam, so the Dataset nodes join the page's single `@graph`
// (no more <JsonLd> in the *_result_layout.tsx components).
//
// Localized description copy lives in the dashboard-layout loc (the `metas` block
// of `loc_data_dashboard.json`, keys `dataset.desc` / `dataset.descNoScope` —
// scope vs. no-scope sibling variants, grammar in the template), read off
// `matches` here via `metaLoc` — the SAME seam the per-feed dataset *labels* use
// (`export_ds_*` keys <DataExport> reads). Tokens: {label}/{scope}/{site}.

import type { BulkExport, BulkDataset } from "~/components/opd_views/_shared/DataExport";
import type { ExportFeedSpec } from "~/components/opd_views/_shared/export_helpers";
import { makeT } from "~/lib/lang";
// Leaf imports (metas/core + metas/loc, not the barrel) to stay out of the
// metas ⇄ jsonld init cycle (see ids.ts) — this module is imported by every
// entity metas file. loc.ts only imports a type, so it adds no jsonld dependency.
import { SITE_NAME, SITE_URL, absoluteUrl, type MetaLang } from "~/lib/seo/metas/core";
import { metaLoc, substitute, mt, type MetaLoc } from "~/lib/seo/metas/loc";
import { ORG_ID } from "./site";

const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
const SOURCE_URL = "https://openparldata.ch/";
const SOURCE_NAME = "OpenParlData";
/** `@id` for the upstream data source as an Organization — an external node (its
 *  own domain, not a parlhub URL), so consumers can merge the `creator` of every
 *  Dataset into one entity. Kept distinct from `ORG_ID` (parlhub = publisher). */
const SOURCE_ID = `${SOURCE_URL}#organization`;

/** The upstream collector of the parliamentary data — Dataset `creator`. parlhub
 *  publishes and derives; OpenParlData.ch creates the underlying records, which
 *  is exactly the attribution CC BY 4.0 requires (see the imprint / llms.txt). */
const SOURCE_ORG = {
    "@type": "Organization",
    "@id": SOURCE_ID,
    name: SOURCE_NAME,
    url: SOURCE_URL,
} as const;

/** The bulk formats offered by the export resource routes, with their MIME
 *  types (mirrors data_export.ts' MIME map — kept literal to stay server-safe). */
const DISTRIBUTIONS: { format: "json" | "csv" | "xlsx"; mime: string }[] = [
    { format: "json", mime: "application/json" },
    { format: "csv", mime: "text/csv" },
    {
        format: "xlsx",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
];

/** Build the localized Dataset-description function from the dashboard-layout
 *  metas loc: scope vs. no-scope are sibling template keys (grammar lives in the
 *  template, per the metas convention), tokens {label}/{scope}/{site} filled here.
 *  Phrased for ANY Swiss parliament (federal, cantonal, municipal) — the scope
 *  can be a Gemeinde council as well as the Nationalrat. */
function makeDescribe(loc: MetaLoc): (label: string, scope?: string) => string {
    return (label, scope) =>
        scope
            ? substitute(mt(loc, "dataset.desc"), { label, scope, site: SITE_NAME })
            : substitute(mt(loc, "dataset.descNoScope"), { label, site: SITE_NAME });
}

export interface DatasetNodesOpts {
    /** The bulk descriptor <DataExport> renders — datasets + baseHref. */
    bulk: BulkExport;
    /** Resolved site language (metaLang(params.lang)) — `inLanguage` on each node. */
    lang: MetaLang;
    /** Localized description builder from the dashboard metas loc (makeDescribe). */
    describe: (label: string, scope?: string) => string;
    /** `location.pathname` — the page describing the datasets (canonical URL). */
    pagePath: string;
    /** Entity name scoping the datasets (e.g. the body's name); omit on
     *  catalogue pages where the dataset IS the whole collection. */
    scopeName?: string | undefined;
    /** The canonical `@id` of the page's main entity (…#identity) — links the
     *  Dataset's `about` to the entity node in the same `@graph`. */
    aboutId?: string | undefined;
}

/** One `Dataset` node per bulk feed (distributions = format × resource route,
 *  page 1 as the entry point; large feeds continue via `?page=N`). Returns the
 *  bare node array — the caller (`meta()` seam) folds them into the page graph. */
export function datasetNodes(opts: DatasetNodesOpts): object[] {
    const { bulk, lang, describe, pagePath, scopeName, aboutId } = opts;
    const url = absoluteUrl(pagePath);

    return bulk.datasets.map((d) => ({
        "@type": "Dataset",
        name: scopeName ? `${d.label} — ${scopeName}` : `${d.label} — ${SITE_NAME}`,
        description: describe(d.label, scopeName),
        url,
        inLanguage: lang,
        ...(aboutId ? { about: { "@id": aboutId } } : {}),
        creator: SOURCE_ORG,
        publisher: { "@id": ORG_ID },
        isBasedOn: SOURCE_URL,
        license: LICENSE_URL,
        distribution: DISTRIBUTIONS.map(({ format, mime }) => ({
            "@type": "DataDownload",
            contentUrl: `${SITE_URL}${bulk.baseHref}/${d.key}/${format}?page=1`,
            encodingFormat: mime,
        })),
    }));
}

/* -------------------------------------------------------------------------- */
/* meta() seam: build the Dataset nodes straight from loader data + matches    */
/* -------------------------------------------------------------------------- */

/** Build the page's Dataset graph nodes from the leaf loaderData. Plugged into
 *  the metas factory `datasets` seam (like `node`), it receives the same
 *  (data, lang, path) plus `matches`/`params` — matches carries the dashboard
 *  layout loc (dataset labels), params.lang the export base href. */
export type DatasetsBuilder<T> = (
    data: T | null | undefined,
    lang: MetaLang,
    path: string | undefined,
    matches: readonly unknown[] | undefined,
    params: Record<string, string | undefined> | undefined,
) => object[];

export interface DatasetsConfig<T> {
    /** The entity's export feeds (result key + loc label key) — the SAME list the
     *  `*_result_layout.tsx` passes to <DataExport>; keep them in one const. */
    feeds: ExportFeedSpec[];
    /** URL path segment for the export resource route (people, parliaments, …). */
    segment: string;
    /** The entity's numeric id, from the base block (persons.id, body.id, …). */
    idOf: (data: T) => number | string | null | undefined;
    /** The entity's display name — the Dataset `scopeName`. Reuse `resolveFacts`. */
    scopeOf: (data: T, lang: MetaLang) => string | null | undefined;
    /** Canonical entity `@id` builder (ids.ts) — the Dataset `about` target. */
    aboutId: (id: number | string) => string;
}

/** The dashboard-layout route id whose loader carries the localized dataset
 *  labels (`export_ds_*`, under `locs.pages.person.labels` — a single shared
 *  namespace for every entity family). */
const DASHBOARD_LAYOUT_ID = "routes/layouts/data_dashboard_layout";

/** Pull the dataset-label loc dict off `matches` (the dashboard layout loader).
 *  Empty dict when absent — `makeT` then falls back to the raw key. */
function datasetLabelLoc(matches: readonly unknown[] | undefined): Record<string, string> {
    const m = matches?.find(
        (it) => (it as { id?: string } | undefined)?.id === DASHBOARD_LAYOUT_ID,
    );
    const loc = (m as { loaderData?: { locs?: { pages?: { person?: { labels?: unknown } } } } })
        ?.loaderData?.locs?.pages?.person?.labels;
    return (loc as Record<string, string>) ?? {};
}

/** The export base href — mirrors `exportBaseHref` (export_helpers) but inlined
 *  so the meta/jsonld path stays free of the component-heavy export module.
 *  Entity-scoped pages pass an `id`; catalogue pages omit it. */
function exportBase(langParam: string | undefined, segment: string, id?: number | string): string {
    const lang = langParam ? `/${langParam}` : "";
    return id != null ? `${lang}/${segment}/${id}/export` : `${lang}/${segment}/export`;
}

/**
 * A `DatasetsBuilder` for one entity family. Reconstructs the bulk descriptor
 * from the leaf loaderData (each `{ …, total_count }` block with rows → one
 * paginated Dataset), reading labels off `matches` — the same inputs `bulkFromData`
 * uses in the layout, so the Dataset markup matches the export menu exactly.
 */
export function makeDatasets<T>(cfg: DatasetsConfig<T>): DatasetsBuilder<T> {
    return (data, lang, path, matches, params) => {
        if (!data) return [];
        const id = cfg.idOf(data);
        if (id == null) return [];

        const t = makeT(datasetLabelLoc(matches));
        const datasets: BulkDataset[] = cfg.feeds.flatMap(({ key, labelKey }) => {
            const block = (data as Record<string, unknown>)[key] as { total_count?: number } | undefined;
            const total = block?.total_count ?? 0;
            return total > 0 ? [{ key, label: t(labelKey), total }] : [];
        });
        if (!datasets.length) return [];

        const bulk: BulkExport = { baseHref: exportBase(params?.lang, cfg.segment, id), pageSize: 500, datasets };
        return datasetNodes({
            bulk,
            lang,
            describe: makeDescribe(metaLoc(matches as unknown[] | undefined)),
            pagePath: path ?? "",
            scopeName: cfg.scopeOf(data, lang) ?? undefined,
            aboutId: cfg.aboutId(id),
        });
    };
}

/* -------------------------------------------------------------------------- */
/* Catalogue Dataset: the whole index list as one Dataset (index pages)        */
/* -------------------------------------------------------------------------- */

/** One `Dataset` node for a catalogue index page — the FeedShell bulk-export
 *  twin, the WHOLE list (no entity `about`, no per-feed scope). The label is the
 *  catalogue's localized title; total>0 is gated by the caller. */
export function catalogueDatasetNodes(opts: {
    /** URL path segment (people, parliaments, …) for the export resource route. */
    segment: string;
    /** Resource-route dataset key (the response list key, e.g. "people"). */
    datasetKey: string;
    /** Localized catalogue label — reuse the index meta's `copy.title`. */
    label: string;
    lang: MetaLang;
    /** `location.pathname` — the catalogue's canonical URL. */
    pagePath: string;
    /** The `:lang?` URL param (for the export base href). */
    langParam: string | undefined;
    /** Route `meta()` `matches` — carries the dashboard metas loc (description copy). */
    matches: readonly unknown[] | undefined;
}): object[] {
    const bulk: BulkExport = {
        baseHref: exportBase(opts.langParam, opts.segment),
        pageSize: 500,
        datasets: [{ key: opts.datasetKey, label: opts.label, total: 0 }],
    };
    return datasetNodes({
        bulk,
        lang: opts.lang,
        describe: makeDescribe(metaLoc(opts.matches as unknown[] | undefined)),
        pagePath: opts.pagePath,
    });
}
