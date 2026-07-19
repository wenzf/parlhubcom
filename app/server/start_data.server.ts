"server-only";
// app/server/start_data.server.ts
//
// Data for the /start quicklinks page. Three lists, all sourced from `bodies`
// (+ `groups` for the federal chambers):
//
//   • federal  — the country-level bodies with a parliament (Switzerland,
//                Liechtenstein). Switzerland carries its two voting chambers
//                (Nationalrat / Ständerat) as `chambers`, each a groups.id used
//                for the ?chamber= filter on the body's votings/lobby pages.
//   • cantons  — all 26 cantonal parliaments (type='canton').
//   • communes — municipality/city bodies that actually have a parliament
//                (~460 of ~2100). Small enough to ship whole and filter in the
//                browser — see the /start search box.
//
// The result only changes when a new data.duckdb is built and swapped in (the
// app opens it READ-ONLY), so it's computed once per language and cached for the
// process lifetime — no per-request query, no per-keystroke query.

import { db } from "~/server/db/core";
import type { SiteLangs } from "@/types/site";

export interface StartLink {
    id: number;
    name: string;
    canton: string | null;
}
export interface StartChamber {
    id: number;
    name: string;
}
export interface FederalBody {
    id: number;
    key: string;
    name: string;
    chambers: StartChamber[];
}
export interface StartData {
    federal: FederalBody[];
    cantons: StartLink[];
    communes: StartLink[];
}

// A row as DuckDB hands it back (ids CAST to INTEGER in SQL → number; names in
// every column the loader might pick per UI language).
type BodyRow = {
    id: number;
    canton_key: string | null;
    country_key?: string | null;
    name_de: string | null;
    name_fr: string | null;
    name_en: string | null;
};
type ChamberRow = {
    body_id: number;
    id: number;
    name_de: string | null;
    name_fr: string | null;
};

const cache = new Map<string, StartData>();

/** Pick the display name for the active UI language, German as the fallback (the
 *  column every body has). Mirrors the SQL loc() fallback for the languages this
 *  page ships names in; `en` bodies fall back to German, `it`/`rm` too. */
const pick = (
    lang: SiteLangs["lang_code"],
    names: { de: string | null; fr?: string | null; en?: string | null },
) => {
    const byLang =
        lang === "en" ? names.en : lang === "fr" ? names.fr : lang === "de" ? names.de : names.de;
    return (byLang || names.de) ?? "";
};

/** Case/diacritic-insensitive locale sort by display name. */
const byName = (lang: SiteLangs["lang_code"]) => (a: StartLink, b: StartLink) =>
    a.name.localeCompare(b.name, lang);

export async function getStartData(lang: SiteLangs["lang_code"]): Promise<StartData> {
    const cached = cache.get(lang);
    if (cached) return cached;

    // The four lists are independent — run them as one batch of round trips.
    const [federalRows, chamberRows, cantonRows, communeRows] = await Promise.all([
        // 1 · Federal country bodies with a parliament — Switzerland first.
        db
            .run(`
        SELECT CAST(id AS INTEGER) AS id, country_key, canton_key, name_de, name_fr, name_en
        FROM bodies
        WHERE type = 'country' AND has_parliament
        ORDER BY (country_key = 'CHE') DESC, name_de
      `)
            .then((r) => r.getRowObjects() as unknown as Promise<BodyRow[]>),
        // 2 · Their voting chambers — active legislative-council groups that appear on
        // votings (same "chamber-list" rule the body pages use). For CH federal this is
        // Nationalrat + Ständerat; single-chamber bodies get none. (groups has no
        // name_en column — German is the fallback for chamber names.)
        db
            .run(`
        SELECT CAST(g.body_id AS INTEGER) AS body_id, CAST(g.id AS INTEGER) AS id, g.name_de, g.name_fr
        FROM groups g
        WHERE g.body_id IN (SELECT id FROM bodies WHERE type = 'country' AND has_parliament)
          AND g.type_harmonized = 'council_legislative'
          AND g.active
          AND EXISTS (SELECT 1 FROM votings vv WHERE vv.body_id = g.body_id AND vv.group_id = g.id)
        ORDER BY g.id
      `)
            .then((r) => r.getRowObjects() as unknown as Promise<ChamberRow[]>),
        // 3 · All 26 cantonal parliaments.
        db
            .run(`
        SELECT CAST(id AS INTEGER) AS id, canton_key, name_de, name_fr, name_en
        FROM bodies
        WHERE type = 'canton'
      `)
            .then((r) => r.getRowObjects() as unknown as Promise<BodyRow[]>),
        // 4 · Communal parliaments — the searchable index (~460 rows).
        db
            .run(`
        SELECT CAST(id AS INTEGER) AS id, canton_key, name_de, name_fr, name_en
        FROM bodies
        WHERE type IN ('municipality', 'city') AND has_parliament
      `)
            .then((r) => r.getRowObjects() as unknown as Promise<BodyRow[]>),
    ]);

    const chambersByBody = new Map<number, StartChamber[]>();
    for (const r of chamberRows) {
        const list = chambersByBody.get(Number(r.body_id)) ?? [];
        list.push({ id: Number(r.id), name: pick(lang, { de: r.name_de, fr: r.name_fr }) });
        chambersByBody.set(Number(r.body_id), list);
    }

    const toLink = (r: BodyRow): StartLink => ({
        id: Number(r.id),
        name: pick(lang, { de: r.name_de, fr: r.name_fr, en: r.name_en }),
        canton: r.canton_key,
    });

    // Sort by the DISPLAYED name (SQL ordered by name_de, which scrambles the grid
    // once names are localized — e.g. EN "Geneva" under a "Genf" sort key).
    const data: StartData = {
        federal: federalRows.map((r) => ({
            id: Number(r.id),
            key: r.country_key ?? "",
            name: pick(lang, { de: r.name_de, fr: r.name_fr, en: r.name_en }),
            chambers: chambersByBody.get(Number(r.id)) ?? [],
        })),
        cantons: cantonRows.map(toLink).sort(byName(lang)),
        communes: communeRows.map(toLink).sort(byName(lang)),
    };

    cache.set(lang, data);
    return data;
}
