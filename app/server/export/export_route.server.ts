// export_route.server.ts
//
// The generic engine behind every bulk-export resource route. A route supplies
// only a REGISTRY (dataset segment → SQL + descriptor + result key) and calls
// makeExportLoader(registry) — all the shared machinery (page maths, criteria
// parsing, the PERSON-family paginated query, serialization, attachment headers
// and RFC-8288 `rel="next"`) lives here, once. So adding export to a new entity
// family is config, not copied logic:
//
//   const REGISTRY = { votings: { sql, descriptor, resultKey: "votings" }, … }
//   export const loader = makeExportLoader(REGISTRY, { filePrefix: "body" })
//
// Every dataset is a PERSON-family feed with $1 = the entity id (the same shape
// bodies / people / affairs / groups feeds already use), so one runner covers all.

import { langByParam } from "~/lib/lang";
import { contentLangPriority, CONTENT_LANGS } from "~/configs/content_langs.config";
import { runPersonPaginatedFiltered, runListPaginatedFiltered } from "~/server/db/core";
import { parseRaw, resolveOrderBy, type DimensionDescriptor } from "~/lib/dimensions/filters";
import {
    serializeTables,
    rawTable,
    buildExportMeta,
    type ExportFormat,
} from "~/lib/export/data";

/** dataset segment → the SQL + descriptor + result key that produce its rows. */
export type ExportRegistry = Record<
    string,
    { sql: string; descriptor: DimensionDescriptor; resultKey: string }
>;

export interface ExportLoaderOptions {
    /** Rows per page (the fixed download cap). Default 500. */
    pageSize?: number;
    /** Route param holding the entity id. Default "id". */
    idParam?: string;
    /** Download filename prefix, e.g. "body" → `body-42-votings-p1.csv`. */
    filePrefix?: string;
    /** Which paginated runner the SQL expects:
     *   "person" — entity-scoped feeds ($1 = the id); the default (detail pages).
     *   "list"   — top-level catalogues (no id in the prelude).  */
    runner?: "person" | "list";
}

const FORMATS = new Set<ExportFormat>(["json", "csv", "xlsx"]);

/** The data languages the SQL `loc()` can resolve (from content_langs.config). */
const KNOWN_LANGS = CONTENT_LANGS as readonly string[];

/** Parse a `?langs=de,fr,it` override into a sanitized priority list (known codes
 *  only, deduped, ≤5). Returns null when absent/empty so the caller falls back to
 *  the URL-language default. */
function parseLangsParam(raw: string | null): string[] | null {
    if (!raw) return null;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const code of raw.split(",").map((c) => c.trim().toLowerCase())) {
        if (KNOWN_LANGS.includes(code) && !seen.has(code)) {
            seen.add(code);
            out.push(code);
        }
    }
    return out.length ? out.slice(0, 5) : null;
}

type LoaderArgs = { params: Record<string, string | undefined>; request: Request };

/** Build a resource-route loader for `registry`. Returned loader:
 *  `GET …/:id/export/:dataset/:format?page=N` → an attachment Response. */
export function makeExportLoader(registry: ExportRegistry, options: ExportLoaderOptions = {}) {
    const pageSize = options.pageSize ?? 500;
    const idParam = options.idParam ?? "id";
    const filePrefix = options.filePrefix ?? "export";
    const runner = options.runner ?? "person";

    return async function loader({ params, request }: LoaderArgs): Promise<Response> {
        const dataset = registry[params.dataset ?? ""];
        const format = (params.format ?? "") as ExportFormat;
        if (!dataset) throw new Response("Unknown dataset", { status: 404 });
        if (!FORMATS.has(format)) throw new Response("Unknown format", { status: 404 });

        // Entity-scoped feeds need a valid id in the scope slot; catalogues don't.
        const id = Number(params[idParam]);
        if (runner === "person" && !Number.isInteger(id)) {
            throw new Response("Bad id", { status: 400 });
        }

        const url = new URL(request.url);
        const page = Math.max(1, Math.floor(Number(url.searchParams.get("page") ?? 1)) || 1);
        const offset = (page - 1) * pageSize;

        // Localization priority: an explicit `?langs=` override (chosen in the export
        // UI) wins; otherwise the per-interface-language default from content_langs.config.
        const { lang_code } = langByParam(params.lang);
        const langs = parseLangsParam(url.searchParams.get("langs")) ?? contentLangPriority(lang_code);

        // Same URL → criteria path as the feeds, so a filtered/sorted export matches
        // what the user sees (unknown sorts / bad dates are dropped by parseRaw).
        const criteria = parseRaw(dataset.descriptor, url.searchParams);
        const filters = dataset.descriptor.toSqlParams(criteria);
        const orderBy = resolveOrderBy(dataset.descriptor, criteria);

        const result =
            runner === "person"
                ? await runPersonPaginatedFiltered<Record<string, unknown>>(dataset.sql, {
                    personId: id, // $1 = the entity id (scope slot)
                    langs,
                    limit: pageSize, // $7
                    offset, // $8
                    filters, // $9..$N
                    orderBy,
                })
                : await runListPaginatedFiltered<Record<string, unknown>>(dataset.sql, {
                    langs,
                    limit: pageSize, // $6
                    offset, // $7
                    filters, // $8..$N
                    orderBy,
                });

        const list = (result?.[dataset.resultKey] ?? {}) as {
            items?: Record<string, unknown>[];
            total_count?: number;
        };
        const rows = list.items ?? [];
        const total = list.total_count ?? rows.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        // Flatten joined struct lookups (e.g. votes' embedded `voting`) into real
        // columns rather than one JSON cell; shared with the in-browser export.
        const table = rawTable(`${params.dataset}-p${page}`, rows);

        // Absolute prev/next endpoint URLs for the JSON meta envelope.
        const pageUrl = (n: number): string => {
            const u = new URL(url);
            u.searchParams.set("page", String(n));
            return u.toString();
        };
        // API-style header for JSON downloads (ignored by CSV/XLSX). `page_url` is the
        // same-origin page that initiated the download (Referer).
        const meta = buildExportMeta({
            origin: url.origin,
            dataset: params.dataset ?? null,
            exportUrl: url.toString(),
            pageUrl: request.headers.get("referer"),
            retrievedAt: new Date().toISOString(),
            languages: langs,
            pagination: {
                page,
                page_size: pageSize,
                total_pages: totalPages,
                total_entries: total,
                entries_on_page: rows.length,
                next: page < totalPages ? pageUrl(page + 1) : null,
                previous: page > 1 ? pageUrl(page - 1) : null,
            },
        });
        const { payload, mime } = serializeTables(format, [table], meta);

        const scope = runner === "person" ? `-${id}` : "";
        const filename = `${filePrefix}${scope}-${params.dataset}-p${page}.${format}`;
        const headers = new Headers({
            "Content-Type": mime,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "private, max-age=0, must-revalidate",
            "X-Total-Count": String(total),
            "X-Total-Pages": String(totalPages),
            "X-Page": String(page),
            "X-Page-Size": String(pageSize),
        });
        if (page < totalPages) {
            const next = new URL(url);
            next.searchParams.set("page", String(page + 1));
            headers.set("Link", `<${next.pathname}${next.search}>; rel="next"`);
        }

        const bytes = typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
        return new Response(bytes as unknown as BodyInit, { headers });
    };
}
