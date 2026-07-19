// opd_facet_sources.ts
//
// CLIENT-SIDE facet option sources for the dimension/catalogue controls.
//
// Problem this solves: a select facet's option list was previously derived from
// the LOADED PAGE SLICE (withBodyOptions / withCodeOptions / withTypeOptions in
// dimension_descriptors.ts), so a dropdown could only offer values that already
// appeared in the current results. This module fetches the FULL vocabulary for a
// facet from the OpenParlData API — in the browser, after mount — and feeds it
// into the descriptor via withSourcedOptions(), the direct analogue of
// withBodyOptions() but sourced from the API instead of the page.
//
// Nothing here runs on the server: useFacetOptions fetches in a useEffect, and
// parseRaw() treats an empty-options select as an OPEN SET (accepts any URL value
// and lets SQL decide). So filtering works before options load; the fetched list
// only populates the dropdown and resolves labels. Hydration is purely additive.
//
// The engine (dimension_filters.ts) and <DimensionControls /> are untouched: this
// only produces FacetOption[]s and hands back a descriptor copy with them filled.
//
// API shapes (verified against sample responses):
//   • Envelope is always { meta, data: [...] } (a bare array is tolerated too).
//   • Localized values are NESTED OBJECTS { de, fr, it, rm?, en? } — NOT the flat
//     *_de/_fr columns of the DuckDB schema — so we pick a language from the object.
//   • Plain entity lists (bodies, groups): records with an integer `id` + localized
//     name objects.
//   • Harmonized group_by (affairs types/states, group types): buckets of
//     { <prefix>_id, count, <prefix>: { de,fr,... } }. The FIRST bucket is the
//     NULL/unclassified bucket (<prefix>_id === null, label {}) and is dropped. The
//     SAME id can appear in several buckets (accent/encoding variants of the label),
//     so we DEDUPE BY id, SUM counts, and keep the highest-count variant's label.
//
// Facet VALUE is always the stable integer id (bound as {type:"integer"} in the
// descriptor's toSqlParams, matching the existing body facet) — never a localized
// display string (house rule).

import * as React from "react";
import type { DimensionDescriptor, FacetOption } from "./filters";

const BASE = "https://api.openparldata.ch/v1";

/* -------------------------------------------------------------------------- */
/* localized-object helper                                                     */
/* -------------------------------------------------------------------------- */

type LocalizedObj = Record<string, unknown> | null | undefined;

/** Pick a string from a { de, fr, it, rm, en } object by language priority, with
 *  an any-language fallback (mirrors the SQL loc() macro's behavior). Returns null
 *  for an empty/sparse-but-empty object. */
export function pickLang(
    obj: LocalizedObj,
    langs: readonly string[],
): string | null {
    if (!obj || typeof obj !== "object") return null;
    for (const l of langs) {
        const v = (obj as Record<string, unknown>)[l];
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    for (const v of Object.values(obj)) {
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
}

/* -------------------------------------------------------------------------- */
/* normalizers                                                                 */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

/** Bodies — value = id, label disambiguated as "<legislative_name> — <place> (<CANTON>)"
 *  because legislative_name alone repeats across municipalities ("Einwohnerrat"). */
function normBodies(rows: Row[], langs: readonly string[]): FacetOption[] {
    const seen = new Set<string>();
    const out: FacetOption[] = [];
    for (const r of rows) {
        if (r["id"] == null) continue;
        const value = String(r["id"]);
        if (seen.has(value)) continue;
        const leg =
            pickLang(r["legislative_name"] as LocalizedObj, langs) ??
            pickLang(r["name"] as LocalizedObj, langs);
        const place = pickLang(r["name"] as LocalizedObj, langs);
        const canton =
            typeof r["canton_key"] === "string" ? (r["canton_key"] as string) : null;
        let label = leg ?? value;
        if (place && place !== leg) label += ` — ${place}`;
        if (canton) label += ` (${canton})`;
        seen.add(value);
        out.push({
            value,
            labelKey: "",
            label,
            country:
                typeof r["country_key"] === "string"
                    ? (r["country_key"] as string)
                    : null,
            bodyKey: typeof r["body_key"] === "string" ? (r["body_key"] as string) : null,
            position:
                typeof r["position"] === "number"
                    ? (r["position"] as number)
                    : r["position"] != null && !Number.isNaN(Number(r["position"]))
                        ? Number(r["position"])
                        : null,
        });
    }
    // position first (country→canton→city→commune; nulls last), then label —
    // so the grouped combobox renders the level headings in rank order.
    out.sort(
        (a, b) =>
            (a.position ?? 99) - (b.position ?? 99) ||
            (a.label ?? "").localeCompare(b.label ?? ""),
    );
    return out;
}

/** Body types — distinct `bodies.type` codes across bodies/?indexed=true, for the
 *  bodies catalogue's type facet. value = the stable `type` code (matches
 *  bodies_list.sql `type = $9`), label = the localized `type_name` object. Bodies
 *  with a null/blank type contribute no option; deduped by code, sorted by label. */
function normBodyTypes(rows: Row[], langs: readonly string[]): FacetOption[] {
    const seen = new Map<string, string>(); // code → label
    for (const r of rows) {
        const raw = r["type"];
        if (raw == null || String(raw).trim() === "") continue;
        const value = String(raw);
        if (seen.has(value)) continue;
        const label = pickLang(r["type_name"] as LocalizedObj, langs) ?? value;
        seen.set(value, label);
    }
    const out: FacetOption[] = [...seen.entries()].map(([value, label]) => ({
        value,
        labelKey: "",
        label,
    }));
    out.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
    return out;
}

/** Groups / parliamentary groups (groups/?indexed=true) — value = group id
 *  (matches meetings.group_id / any *.group_id predicate), label = the localized
 *  `name` object, suffixed with the `abbreviation` when it adds signal. Same
 *  mechanism as normBodies (a plain entity list with an integer id + localized
 *  name), minus the position grouping. Deduped by id, sorted by label. */
function normGroups(rows: Row[], langs: readonly string[]): FacetOption[] {
    const seen = new Set<string>();
    const out: FacetOption[] = [];
    for (const r of rows) {
        if (r["id"] == null) continue;
        const value = String(r["id"]);
        if (seen.has(value)) continue;
        const name = pickLang(r["name"] as LocalizedObj, langs);
        const abbr = pickLang(r["abbreviation"] as LocalizedObj, langs);
        let label = name ?? abbr ?? value;
        if (abbr && name && abbr !== name) label += ` (${abbr})`;
        seen.add(value);
        out.push({ value, labelKey: "", label });
    }
    out.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
    return out;
}

/** Parties (persons/group_by/parties_harmonized). No id column; the People SQL
 *  matches party by NAME (party_harmonized_de/_en), so value = the canonical
 *  harmonized name (de, else en), label = localized. Drops the empty bucket. */
function normParties(rows: Row[], langs: readonly string[]): FacetOption[] {
    const seen = new Set<string>();
    const out: FacetOption[] = [];
    for (const r of rows) {
        const obj = r["party_harmonized"] as LocalizedObj;
        const de = obj && typeof obj === "object" ? (obj["de"] as string) : null;
        const en = obj && typeof obj === "object" ? (obj["en"] as string) : null;
        const name = pickLang(obj, langs);
        // Prefer the stable wikidata id (matches persons.party_harmonized_wikidata_id);
        // fall back to the canonical name for parties without one.
        const wikidata =
            typeof r["party_harmonized_wikidata_id"] === "string"
                ? (r["party_harmonized_wikidata_id"] as string)
                : null;
        const value =
            (wikidata && wikidata.trim()) ||
            (de && de.trim()) ||
            (en && en.trim()) ||
            name;
        if (!value) continue; // empty bucket
        if (seen.has(value)) continue;
        seen.add(value);
        out.push({
            value,
            labelKey: "",
            label: name ?? value,
            ...(Array.isArray(r["body_keys"])
                ? { bodyKeys: r["body_keys"] as string[] }
                : {}),
        });
    }
    out.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
    return out;
}

/** Electoral districts (persons/group_by/electoral_districts). No id — value = the
 *  district NAME (de, else fr/it), matched against persons.electoral_district_de/fr/it.
 *  Drops the empty bucket and obvious junk (urls/hashes), dedupes by name. */
function normElectoralDistricts(
    rows: Row[],
    langs: readonly string[],
): FacetOption[] {
    const seen = new Set<string>();
    const out: FacetOption[] = [];
    for (const r of rows) {
        const obj = r["electoral_district"] as LocalizedObj;
        const de = obj && typeof obj === "object" ? (obj["de"] as string) : null;
        const fr = obj && typeof obj === "object" ? (obj["fr"] as string) : null;
        const it = obj && typeof obj === "object" ? (obj["it"] as string) : null;
        const value =
            (de && de.trim()) || (fr && fr.trim()) || (it && it.trim()) || pickLang(obj, langs);
        if (!value) continue; // empty bucket
        if (/https?:|\//.test(value) || /^[0-9a-f]{16,}$/i.test(value)) continue; // junk
        if (seen.has(value)) continue;
        seen.add(value);
        const bk = Array.isArray(r["body_keys"]) ? (r["body_keys"] as string[]) : [];
        const bkLabel = bk.filter((k) => !/^\d+$/.test(k)); // drop numeric body ids
        const base = pickLang(obj, langs) ?? value;
        out.push({
            value,
            labelKey: "",
            label: bkLabel.length ? `${base} (${bkLabel.join(", ")})` : base,
            ...(bk.length ? { bodyKeys: bk } : {}),
        });
    }
    out.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
    return out;
}

interface HarmonizedAcc {
    label: string;
    count: number;
    pos: number;
    bestCount: number; // count of the variant whose label we kept
}

/** Harmonized group_by (affairs types/states, group types). `prefix` is the field
 *  stem, e.g. "type_harmonized" or "state_name_harmonized": value comes from
 *  `${prefix}_id`, label from the `${prefix}` localized object, optional ordering
 *  from `${prefix}_position`. Drops the null-id bucket; dedupes by id (summing
 *  counts, keeping the highest-count label). When `withCount`, the label gets a
 *  " (1,234)" suffix. */
function normHarmonizedGroupBy(
    rows: Row[],
    langs: readonly string[],
    prefix: string,
    opts?: { withCount?: boolean },
): FacetOption[] {
    const idKey = `${prefix}_id`;
    const posKey = `${prefix}_position`;
    const byId = new Map<string, HarmonizedAcc>();

    for (const r of rows) {
        const idRaw = r[idKey];
        if (idRaw == null) continue; // NULL / unclassified bucket — not a filter value
        const value = String(idRaw);
        const label = pickLang(r[prefix] as LocalizedObj, langs) ?? value;
        const count = typeof r["count"] === "number" ? (r["count"] as number) : 0;
        const pos =
            typeof r[posKey] === "number"
                ? (r[posKey] as number)
                : Number.MAX_SAFE_INTEGER;

        const cur = byId.get(value);
        if (!cur) {
            byId.set(value, { label, count, pos, bestCount: count });
        } else {
            cur.count += count;
            if (count > cur.bestCount) {
                cur.label = label;
                cur.bestCount = count;
            }
            if (pos < cur.pos) cur.pos = pos;
        }
    }

    const items = [...byId.entries()].map(([value, v]) => ({ value, ...v }));
    const anyPos = items.some((i) => i.pos !== Number.MAX_SAFE_INTEGER);
    items.sort((a, b) =>
        anyPos ? a.pos - b.pos || b.count - a.count : b.count - a.count,
    );

    return items.map((i) => ({
        value: i.value,
        labelKey: "",
        label: opts?.withCount
            ? `${i.label} (${i.count.toLocaleString()})`
            : i.label,
    }));
}

/* -------------------------------------------------------------------------- */
/* source registry                                                             */
/* -------------------------------------------------------------------------- */

export interface FacetSource {
    url: string;
    /** Raw API `data` rows → option list (already deduped/sorted/labeled). */
    normalize: (rows: Row[], langs: readonly string[]) => FacetOption[];
}

/** All known facet sources. Add a new endpoint here, point it at the matching
 *  normalizer, and reference its key from a descriptor binding (source / convention).
 *  affair_types / affair_states back the affairs catalogue. */
export const FACET_SOURCES = {
    // bodies / parliaments — value = body id; matches body_id predicates.
    bodies: {
        url: `${BASE}/bodies/?indexed=true`,
        normalize: (r, l) => normBodies(r, l),
    },
    // body types — distinct bodies.type across bodies/?indexed=true; value = type
    // code (matches bodies_list.sql `type = $9`), label = localized type_name.
    body_types: {
        url: `${BASE}/bodies/?indexed=true`,
        normalize: (r, l) => normBodyTypes(r, l),
    },
    // groups / parliamentary groups — value = group id (matches meetings.group_id
    // and any *.group_id predicate), label = localized name (+ abbreviation).
    // Sourced the SAME way as bodies (indexed entity list). If this endpoint shape
    // differs in your deployment, point it at the right groups list endpoint.
    groups: {
        url: `${BASE}/groups/?indexed=true`,
        normalize: (r, l) => normGroups(r, l),
    },
    // parties (harmonized) — value = wikidata id (else name); matched by People SQL.
    parties: {
        url: `${BASE}/persons/group_by/parties_harmonized?number=1000`,
        normalize: (r, l) => normParties(r, l),
    },
    // electoral districts — value = district name; matched against electoral_district_*.
    electoral_districts: {
        url: `${BASE}/persons/group_by/electoral_districts?number=1000`,
        normalize: (r, l) => normElectoralDistricts(r, l),
    },
    // affair harmonized types — value = type_harmonized_id.
    affair_types: {
        url: `${BASE}/affairs/group_by/types_harmonized`,
        normalize: (r, l) =>
            normHarmonizedGroupBy(r, l, "type_harmonized", { withCount: true }),
    },
    // affair harmonized states — value = state_name_harmonized_id.
    affair_states: {
        url: `${BASE}/affairs/group_by/states_harmonized`,
        normalize: (r, l) =>
            normHarmonizedGroupBy(r, l, "state_name_harmonized", { withCount: true }),
    },
    // group harmonized types — value = type_harmonized_id (matches groups_list.sql
    // $10). Full vocabulary from the API, not just the current page slice.
    group_types: {
        url: `${BASE}/groups/group_by/type_harmonized`,
        normalize: (r, l) =>
            normHarmonizedGroupBy(r, l, "type_harmonized", { withCount: true }),
    },
} satisfies Record<string, FacetSource>;

export type FacetSourceId = keyof typeof FACET_SOURCES;

/* -------------------------------------------------------------------------- */
/* facet → source resolution (convention + explicit override)                  */
/* -------------------------------------------------------------------------- */

/** Facets whose source is implied by their `param` name, so a descriptor needs no
 *  edits to get full-list sourcing. The `body` facet is shared by nearly every
 *  person dimension and the people directory, so it's wired by convention here.
 *  A facet can still override/extend this with an explicit `source` on the
 *  descriptor (see resolveFacetSources). */
export const DEFAULT_FACET_SOURCES: Partial<Record<string, FacetSourceId>> = {
    body: "bodies",
    party: "parties",
};

/** Build the { facet param → source id } map for a descriptor, combining an
 *  explicit per-facet `source` (wins) with the param-name convention above. Only
 *  select facets and known source ids are included. */
export function resolveFacetSources(
    descriptor: DimensionDescriptor,
): Partial<Record<string, FacetSourceId>> {
    const out: Partial<Record<string, FacetSourceId>> = {};
    for (const f of descriptor.facets) {
        if (f.kind !== "select") continue;
        const explicit = (f as { source?: string }).source;
        const id = (explicit ?? DEFAULT_FACET_SOURCES[f.param]) as
            | FacetSourceId
            | undefined;
        if (id && id in FACET_SOURCES) out[f.param] = id;
    }
    return out;
}

/** Locale ("de-CH") → language priority list for picking localized labels, with
 *  the locale's own language first and the standard fallback order behind it. */
export function localeToLangs(locale: string | undefined): string[] {
    const order = ["de", "fr", "it", "en", "rm"];
    const base = (locale ?? "").slice(0, 2).toLowerCase();
    const out: string[] = order.includes(base) ? [base] : [];
    for (const l of order) if (l !== base) out.push(l);
    return out;
}

/* -------------------------------------------------------------------------- */
/* fetch + cache                                                               */
/* -------------------------------------------------------------------------- */

// Module-level cache keyed by source + language priority (labels are localized).
// These vocabularies are quasi-static, so one fetch per (source, langs) per page
// load is plenty. Failures are NOT cached (the key is deleted on reject) so a
// transient error can be retried by a later mount.
const cache = new Map<string, Promise<FacetOption[]>>();

function envelopeRows(json: unknown): Row[] {
    if (Array.isArray(json)) return json as Row[];
    if (json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)) {
        return (json as { data: Row[] }).data;
    }
    return [];
}

/** Fetch + normalize one source (shared/deduped across callers). Note: the shared
 *  promise is intentionally NOT tied to any one caller's AbortSignal, so a single
 *  component unmounting can't cancel a fetch other components are awaiting — the
 *  hook simply ignores results after unmount instead. */
export function fetchFacetOptions(
    id: FacetSourceId,
    langs: readonly string[],
): Promise<FacetOption[]> {
    const key = `${id}:${langs.join(",")}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const src = FACET_SOURCES[id];
    const p = fetch(src.url, { headers: { accept: "application/json" } })
        .then((res) => {
            if (!res.ok) throw new Error(`facet source "${id}": HTTP ${res.status}`);
            return res.json();
        })
        .then((json) => src.normalize(envelopeRows(json), langs))
        .catch((err) => {
            cache.delete(key); // don't cache failures
            throw err;
        });

    cache.set(key, p);
    return p;
}

/** Clear cached options (e.g. a manual "refresh" affordance). */
export function clearFacetOptionsCache(): void {
    cache.clear();
}

/* -------------------------------------------------------------------------- */
/* react hook                                                                  */
/* -------------------------------------------------------------------------- */

export interface FacetOptionsState {
    /** Resolved options per source; a key is absent until that source settles. */
    options: Partial<Record<FacetSourceId, FacetOption[]>>;
    /** True while at least one requested source is still in flight. */
    loading: boolean;
    /** Error message per source that failed (others can still succeed). */
    errors: Partial<Record<FacetSourceId, string>>;
}

/** Fetch the given sources on mount and progressively fill them in as each
 *  settles (so the UI hydrates one dropdown at a time rather than all-or-nothing).
 *  Client-only: the effect never runs during SSR, so the first paint uses the
 *  descriptor's empty option lists (open-set facets), which is safe. */
export function useFacetOptions(
    ids: readonly FacetSourceId[],
    langs: readonly string[],
): FacetOptionsState {
    // Stable dependency key so re-renders with an equivalent request don't refetch.
    const idsKey = React.useMemo(() => [...ids].sort().join("|"), [ids]);
    const langKey = langs.join(",");

    const [state, setState] = React.useState<FacetOptionsState>({
        options: {},
        loading: ids.length > 0,
        errors: {},
    });

    React.useEffect(() => {
        let alive = true;
        const list = idsKey ? (idsKey.split("|") as FacetSourceId[]) : [];
        if (list.length === 0) {
            setState({ options: {}, loading: false, errors: {} });
            return;
        }

        setState((s) => ({ ...s, loading: true }));
        let pending = list.length;

        for (const id of list) {
            fetchFacetOptions(id, langKey ? langKey.split(",") : [])
                .then((opts) => {
                    if (!alive) return;
                    setState((s) => ({ ...s, options: { ...s.options, [id]: opts } }));
                })
                .catch((err: unknown) => {
                    if (!alive) return;
                    const message = err instanceof Error ? err.message : String(err);
                    setState((s) => ({ ...s, errors: { ...s.errors, [id]: message } }));
                })
                .finally(() => {
                    if (!alive) return;
                    pending -= 1;
                    if (pending === 0) setState((s) => ({ ...s, loading: false }));
                });
        }

        return () => {
            alive = false;
        };
    }, [idsKey, langKey]);

    return state;
}

/* -------------------------------------------------------------------------- */
/* descriptor hydration                                                        */
/* -------------------------------------------------------------------------- */

/** Return a descriptor copy with each bound select facet's `options` filled from
 *  the fetched sources. `bindings` maps a facet `param` → a FacetSourceId. A facet
 *  whose source hasn't resolved yet keeps its empty list (so it stays an open set
 *  and the current URL value still applies). The direct analogue of
 *  withBodyOptions(), but fed from the API rather than the page slice. */
export function withSourcedOptions(
    descriptor: DimensionDescriptor,
    fetched: Partial<Record<FacetSourceId, FacetOption[]>>,
    bindings: Partial<Record<string, FacetSourceId>>,
): DimensionDescriptor {
    const facets = descriptor.facets.map((f) => {
        if (f.kind !== "select") return f;
        const srcId = bindings[f.param];
        if (!srcId) return f;
        const opts = fetched[srcId];
        if (!opts) return f; // not loaded yet → keep open set
        return { ...f, options: opts };
    });
    return { ...descriptor, facets } as DimensionDescriptor;
}

/* -------------------------------------------------------------------------- */
/* one-call hook: descriptor → descriptor with sourced options                 */
/* -------------------------------------------------------------------------- */

/** Resolve a descriptor's facet sources (convention + explicit), fetch them
 *  client-side, and return a descriptor copy with each sourced select facet's
 *  options filled in (progressively, as each source settles). A descriptor with
 *  no sourced facets returns unchanged and triggers no fetch. This is the single
 *  entry point <DimensionControls /> uses, so every dimension that renders the
 *  controls gets full-list options for free. */
export function useSourcedDescriptor(
    descriptor: DimensionDescriptor,
    langs: readonly string[],
    enabled = true,
): DimensionDescriptor {
    const bindings = React.useMemo(
        () => resolveFacetSources(descriptor),
        [descriptor],
    );
    const ids = React.useMemo(
        () => (enabled ? ([...new Set(Object.values(bindings))] as FacetSourceId[]) : []),
        [bindings, enabled],
    );
    const { options } = useFacetOptions(ids, langs);
    return React.useMemo(
        () => withSourcedOptions(descriptor, options, bindings),
        [descriptor, options, bindings],
    );
}