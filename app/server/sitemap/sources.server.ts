"server-only";
// app/server/sitemap/sources.server.ts
//
// The concrete SitemapSource builders. Three shapes cover every route in scope:
//
//   • tableSource      — a detail entity backed by a real table (people, groups,
//     affairs, …). Enumeration is a bare `SELECT id` (+ optional lastmod) — far
//     cheaper than the localized `_by_id` SQL — paged by ORDER BY id LIMIT/OFFSET
//     (ids are sparse, so never assume a dense range).
//   • staticPagesSource — the fixed, DB-free set of list/index + home pages. One
//     small file; localized alternates like any other entry.
//   • organizationsSource — the special case: orgs are derived from `interests`
//     and their `:id` is language-dependent (base64url of the localized name), so
//     we enumerate once PER language and emit one <url> per (language, org),
//     WITHOUT hreflang alternates (there is no language-stable id to cross-link).
//
// SQL for the table sources is assembled from TRUSTED registry constants
// (table/idColumn/lastmodExpr are hard-coded literals — never user input).

import type { Params } from "react-router";
import type { PageNamespaces } from "@/types/site";
import { db } from "~/server/db/core";
import macro_loc_sql from "~/server/db/sql/macro_loc.sql?raw";
import organization_keys_sql from "~/server/db/sql/sitemap/organization_keys.sql?raw";
import {
    localizedSitemapEntry,
    msToIso,
    pathSitemapEntry,
    SITE_ORIGIN,
} from "~/lib/seo/sitemap/urls";
import type { UrlEntry } from "~/lib/seo/sitemap/xml";
import { SITE_LANGS } from "~/configs/site.config";
import { localizedOrgPath } from "~/lib/urls/org_id";
import { resolveLangs } from "~/lib/lang";
import type { SitemapSource } from "./source";

/* -------------------------------------------------------------------------- */
/* Table-backed detail entities                                               */
/* -------------------------------------------------------------------------- */

export interface TableSourceConfig {
    /** URL shard key + the DuckDB table (trusted constants). */
    key: string;
    table: string;
    /** PAGE_CONFIG namespace whose `absolute_path` (e.g. "/people/:id") builds the URL. */
    pageNamespace: PageNamespaces;
    /** Route param the id fills (default "id"). */
    idParam?: string;
    /** Id / primary-key column, enumerated + used as the URL id (default "id"). */
    idColumn?: string;
    /** SQL expression yielding epoch-ms for `<lastmod>`, or null when unavailable. */
    lastmodExpr?: string | null;
}

export function tableSource(cfg: TableSourceConfig): SitemapSource {
    const idParam = cfg.idParam ?? "id";
    const idColumn = cfg.idColumn ?? "id";
    return {
        key: cfg.key,
        async count() {
            const prepared = await db.prepare(`SELECT count(*)::INTEGER AS n FROM ${cfg.table}`);
            const reader = await prepared.runAndReadAll();
            const rows = reader.getRowObjectsJson() as unknown as { n: number }[];
            return Number(rows[0]?.n ?? 0);
        },
        async entries(page, pageSize) {
            const lm = cfg.lastmodExpr ? `, ${cfg.lastmodExpr} AS lm` : "";
            const sql =
                `SELECT ${idColumn} AS id${lm} FROM ${cfg.table} ` +
                `ORDER BY ${idColumn} LIMIT $1 OFFSET $2`;
            const prepared = await db.prepare(sql);
            prepared.bindInteger(1, pageSize);
            prepared.bindInteger(2, (page - 1) * pageSize);
            const reader = await prepared.runAndReadAll();
            const rows = reader.getRowObjectsJson() as unknown as { id: number; lm?: unknown }[];
            return rows.map((row) =>
                localizedSitemapEntry(
                    cfg.pageNamespace,
                    { [idParam]: String(row.id) } as Params,
                    msToIso(row.lm),
                ),
            );
        },
    };
}

/* -------------------------------------------------------------------------- */
/* Static list / index / home pages                                           */
/* -------------------------------------------------------------------------- */

/** A static page: either a PAGE_CONFIG namespace or a raw path fragment (home). */
export type StaticPage = { ns: PageNamespaces } | { path: string };

/** Build a DB-free source from a fixed page list (fits one file). */
export function staticPagesSource(key: string, pages: StaticPage[]): SitemapSource {
    const build = (): UrlEntry[] =>
        pages.map((p) => ("ns" in p ? localizedSitemapEntry(p.ns, {}) : pathSitemapEntry(p.path)));
    return {
        key,
        async count() {
            return pages.length;
        },
        async entries(page, pageSize) {
            return build().slice((page - 1) * pageSize, page * pageSize);
        },
    };
}

/* -------------------------------------------------------------------------- */
/* Organizations (derived from interests, language-dependent ids)             */
/* -------------------------------------------------------------------------- */

/** Distinct org keys (+ lastmod) for one language priority. */
async function orgKeysForLang(langs: string[]): Promise<{ key: string; lm?: unknown }[]> {
    await db.run(macro_loc_sql); // organization_keys.sql needs loc()
    const prepared = await db.prepare(organization_keys_sql);
    const l = Array.from({ length: 5 }, (_, i) => langs[i] ?? "");
    for (let i = 0; i < 5; i += 1) prepared.bindVarchar(i + 1, l[i]);
    const reader = await prepared.runAndReadAll();
    return reader.getRowObjectsJson() as unknown as { key: string; lm?: unknown }[];
}

/** Every organization detail URL, one per (language, org). Since the id is
 *  language-specific there is no cross-language alternate — each localized page
 *  is its own `<loc>` with no `xhtml:link`s. */
async function allOrgEntries(): Promise<UrlEntry[]> {
    const out: UrlEntry[] = [];
    for (const lang of SITE_LANGS) {
        const keys = await orgKeysForLang(resolveLangs(lang.lang_param));
        for (const row of keys) {
            out.push({
                loc: `${SITE_ORIGIN}${localizedOrgPath(lang.lang_param, row.key)}`,
                lastmod: msToIso(row.lm),
            });
        }
    }
    return out;
}

export const organizationsSource: SitemapSource = {
    key: "organizations",
    async count() {
        return (await allOrgEntries()).length;
    },
    async entries(page, pageSize) {
        return (await allOrgEntries()).slice((page - 1) * pageSize, page * pageSize);
    },
};
