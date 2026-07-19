"server-only";
// app/server/home_stats.server.ts
//
// Live dataset counts for the homepage strip. Prefers the `import_meta` ledger
// (written by the remote import; carries row_count + synced_at), and falls back
// to COUNT(*) over the section tables when the ledger is absent (a locally
// built data.duckdb has no import_meta). Counts are metadata-cheap in DuckDB,
// and the result is cached in-process — it only changes on a re-import.

import { statSync } from "node:fs";
import { db } from "~/server/db/core";
import type { PageNamespaces } from "@/types/site";
import type { ImportMetaClient } from "@/types/opd_db";

/** Homepage strip sections, in display order: DB table → section index route +
 *  the label key in loc_home.sections. (organizations is derived from
 *  interests, not a table — it has no count and stays out of the strip.) */
const STAT_SECTIONS = [
    { table: "persons", label: "people", ns: "NS_PEOPLE_INDEX" },
    { table: "votings", label: "votings", ns: "NS_VOTINGS_INDEX" },
    { table: "affairs", label: "affairs", ns: "NS_AFFAIRS_INDEX" },
    { table: "speeches", label: "speeches", ns: "NS_SPEECHES_INDEX" },
    { table: "bodies", label: "bodies", ns: "NS_BODIES_INDEX" },
    { table: "groups", label: "groups", ns: "NS_GROUPS_INDEX" },
    { table: "meetings", label: "meetings", ns: "NS_MEETINGS_INDEX" },
    { table: "texts", label: "texts", ns: "NS_TEXTS_INDEX" },
    { table: "docs", label: "documents", ns: "NS_DOCS_INDEX" },
    { table: "interests", label: "interests", ns: "NS_INTERESTS_INDEX" },
] as const satisfies readonly { table: string; label: string; ns: PageNamespaces }[];

export interface HomeStat {
    label: string;
    ns: PageNamespaces;
    count: number;
}

export interface HomeStats {
    items: HomeStat[];
    /** Latest import_meta.synced_at (ISO), or null when no ledger exists. */
    updated: string | null;
}

const TTL = 10 * 60 * 1000;
let cache: { data: HomeStats; at: number } | null = null;

/** The ledger columns the strip consumes (BIGINTs cast to INTEGER in SQL). */
type LedgerRow = Pick<ImportMetaClient, "entity" | "row_count" | "synced_at">;

export async function getHomeStats(): Promise<HomeStats> {
    if (cache && Date.now() - cache.at < TTL) return cache.data;

    // Primary source: the import_meta ledger — row_count per entity and
    // synced_at (when the entity was last written), maintained by the importer.
    const ledger = new Map<string, LedgerRow>();
    let updated: string | null = null;
    try {
        const r = await db.run(
            "SELECT entity, CAST(row_count AS INTEGER) AS row_count, synced_at FROM import_meta",
        );
        for (const row of (await r.getRowObjects()) as unknown as LedgerRow[]) {
            ledger.set(String(row.entity), row);
            if (row.synced_at && (!updated || row.synced_at > updated)) {
                updated = row.synced_at;
            }
        }
    } catch {
        // No import_meta ledger (older locally built DB) — fall through to the
        // COUNT(*)/mtime fallbacks below.
    }

    // Fallback counts for sections the ledger doesn't cover: one metadata-cheap
    // scan. Table names come from the static registry above, never from input.
    const missing = STAT_SECTIONS.filter((s) => !ledger.has(s.table));
    const counted = new Map<string, number>();
    if (missing.length) {
        const countsSql = missing
            .map((s) => `SELECT '${s.table}' AS entity, CAST(COUNT(*) AS INTEGER) AS n FROM ${s.table}`)
            .join(" UNION ALL ");
        const reader = await db.run(countsSql);
        for (const row of (await reader.getRowObjects()) as unknown as { entity: string; n: number }[]) {
            counted.set(String(row.entity), Number(row.n));
        }
    }

    if (!updated) {
        // Fallback: when the database file was last written — i.e. when the data
        // was last built or swapped in.
        try {
            updated = statSync("data.duckdb").mtime.toISOString();
        } catch {
            // Unreadable file stats — leave the line hidden.
        }
    }

    const data: HomeStats = {
        items: STAT_SECTIONS.flatMap((s) => {
            const count = ledger.get(s.table)?.row_count ?? counted.get(s.table);
            // Never show a zero/absent count — drop the entry instead.
            return count ? [{ label: s.label, ns: s.ns, count: Number(count) }] : [];
        }),
        updated,
    };
    cache = { data, at: Date.now() };
    return data;
}
