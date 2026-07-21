// /app/lib/seo/jsonld/meeting.ts
//
// Event graph node for a /meetings/:id page — head JSON-LD replacing the
// microdata <MeetingBase /> and the meetings layout emitted. Wired into
// `meetingMeta`/`meetingDimensionMeta` (metas/meeting.ts).
//
// Beyond the record's own columns the node reads the response-scoped lookups the
// meeting queries already return — `bodies` (organizer name/url + the address
// country/region the free-text `location` rarely carries) and `persons` (speech
// speakers + contributors → `performer`). Both are optional: the by-id feeds ship
// different subsets (docs/events carry neither), so every enrichment is guarded
// and simply drops out when its source is absent.
//
// Not emitted: `offers`. Nothing in the meetings data describes admission (price,
// availability, a registration URL), and an invented free-of-charge Offer would
// be an unverifiable claim about public access.

import type { MetaLang } from "~/lib/seo/metas/core";
import type { MeetingClient } from "@/types/opd_db";
import { isoOf } from "~/components/opd_views/opd_micros";
import { meetingNodeId, meetingPageUrl, bodyNodeId, bodyPageUrl, personNodeId } from "./ids";

type BodyLookup = {
    id?: number | null;
    legislative_name?: string | null;
    name?: string | null;
    body_key?: string | null;
    country_key?: string | null;
    canton_key?: string | null;
};

type MeetingNodeData =
    | {
        meeting?: MeetingClient | null;
        bodies?: { items?: BodyLookup[] } | null;
        persons?: { items?: Array<{ id?: number | null; fullname?: string | null }> };
    }
    | null
    | undefined;

/** Cap on `performer` entries — the by-id feeds page up to 50 speakers and the
 *  head must stay small; the list is a sample, not the attendance record. */
const MAX_PERFORMERS = 20;

/** Strip tags + decode the few common entities so a rich-text description
 *  becomes a plain schema.org string (mirrors speech.ts). */
function plainText(html: string | null | undefined): string | undefined {
    if (!html) return undefined;
    const s = html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    return s || undefined;
}

/** Fold accents + case so the multilingual `state` / country tokens below can be
 *  matched with plain ASCII substrings. */
const fold = (s: string): string =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * `meetings.state` → a schema.org EventStatusType. The column is free-text and
 * per-parliament (`final` / `Terminée` / `Abgeschlossen` / `Eröffnet` / `planned`
 * / …), so only recognized tokens map; anything unknown yields `undefined` rather
 * than a guess. Held and completed sittings stay `EventScheduled` — schema has no
 * "took place" status, and EventScheduled means "going ahead as planned".
 */
function eventStatus(state: string | null | undefined): string | undefined {
    if (!state) return undefined;
    const s = fold(state);
    if (/annul|abgesagt|cancel|storniert/.test(s)) return "https://schema.org/EventCancelled";
    if (/verschoben|postpon|reporte|rinviat/.test(s)) return "https://schema.org/EventPostponed";
    if (/final|complet|termine|abgeschlossen|eroffnet|ouvert|apert|plan|geplant/.test(s))
        return "https://schema.org/EventScheduled";
    return undefined;
}

/** ISO country code for a body's `country_key` (schema.org `addressCountry`). */
const countryCode = (key: string | null | undefined): string | undefined =>
    key === "CHE" ? "CH" : key === "LIE" ? "LI" : undefined;

/** Country word appearing as the tail of a `::`-separated location string. */
function countryFromWord(word: string): string | undefined {
    const w = fold(word);
    if (/^(suisse|schweiz|svizzera|svizra|switzerland)$/.test(w)) return "CH";
    if (/^liechtenstein$/.test(w)) return "LI";
    return undefined;
}

/**
 * Best-effort PostalAddress for the free-text `meetings.location`, widened by the
 * organizing body's country/canton. Two source shapes are recognized, both fully
 * guarded — an unparseable location contributes nothing but the body's country:
 *
 *  - `"Festsaal, Rathaus, Limmatquai 55, 8001 Zürich"` — a 4-digit postal code +
 *    locality tail (CH/LI share the format), street = what precedes it.
 *  - `"14 juin 2021 :: Commune de Collombey-Muraz :: Valais :: Suisse"` — the
 *    `::`-separated OpenParlData form, read right-to-left (country, region,
 *    locality) and only when the tail is a country we know.
 *
 * Returns `undefined` when nothing at all could be resolved.
 */
function postalAddress(
    location: string | null | undefined,
    body: BodyLookup | undefined,
): Record<string, unknown> | undefined {
    const addr: Record<string, unknown> = {};

    const loc = location?.trim() ?? "";
    if (loc.includes("::")) {
        const parts = loc.split("::").map((p) => p.trim()).filter(Boolean);
        const country = parts.length >= 2 ? countryFromWord(parts[parts.length - 1]) : undefined;
        if (country) {
            addr.addressCountry = country;
            if (parts.length >= 3) addr.addressRegion = parts[parts.length - 2];
            if (parts.length >= 4) addr.addressLocality = parts[parts.length - 3];
        }
    } else {
        // "… , 8001 Zürich" — postal code + locality tail.
        const m = /^(.*?)[,\s]*\b(\d{4})\s+([^,\d]{2,40})$/.exec(loc);
        if (m) {
            const street = m[1].trim();
            if (street) addr.streetAddress = street;
            addr.postalCode = m[2];
            addr.addressLocality = m[3].trim();
        }
    }

    const country = countryCode(body?.country_key);
    if (country && !addr.addressCountry) addr.addressCountry = country;
    if (body?.canton_key && !addr.addressRegion) addr.addressRegion = body.canton_key;

    if (!Object.keys(addr).length) return undefined;
    return { "@type": "PostalAddress", ...addr };
}

/**
 * Event node for a meeting page (`@id` = `…/meetings/:id#identity`). Returns
 * `[]` when the record has no name.
 */
export function meetingNode(
    data: MeetingNodeData,
    _lang: MetaLang,
    _path: string | undefined,
): object[] {
    const m = data?.meeting;
    if (!m || m.id == null) return [];
    const name = m.name ?? m.abbreviation ?? null;
    if (!name) return [];

    const node: Record<string, unknown> = {
        "@type": "Event",
        "@id": meetingNodeId(m.id),
        name,
        url: meetingPageUrl(m.id),
    };
    const description = plainText(m.description);
    if (description) node.description = description;

    const start = isoOf(m.begin_date);
    if (start) node.startDate = start;
    const end = isoOf(m.end_date);
    if (end) node.endDate = end;

    const status = eventStatus(m.state);
    if (status) node.eventStatus = status;

    const body = data?.bodies?.items?.find((b) => b?.id != null && b.id === m.body_id) ?? undefined;

    if (m.location) {
        const address = postalAddress(m.location, body);
        node.location = {
            "@type": "Place",
            name: m.location,
            ...(address ? { address } : {}),
        };
    }

    if (m.body_id != null) {
        // The body's own node is NOT part of a meeting page's graph, so the
        // reference carries its type/name/url inline rather than dangling.
        const organizerName = body?.legislative_name ?? body?.name ?? body?.body_key ?? null;
        node.organizer = {
            "@type": "GovernmentOrganization",
            "@id": bodyNodeId(m.body_id),
            ...(organizerName ? { name: organizerName } : {}),
            url: bodyPageUrl(m.body_id),
        };
    }

    const performers = (data?.persons?.items ?? [])
        .filter((p) => p?.fullname)
        .slice(0, MAX_PERFORMERS)
        .map((p) => ({
            "@type": "Person",
            ...(p.id != null ? { "@id": personNodeId(p.id) } : {}),
            name: p.fullname as string,
        }));
    if (performers.length) node.performer = performers;

    return [node];
}
