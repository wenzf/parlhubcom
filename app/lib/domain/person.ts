// /app/lib/domain/person.ts
//
// Shared helpers for <PersonBase /> and <PersonFull />.
//
// - resolveEffectivePerson(): merges the queried `persons` record with the
//   primary person_identity (is_primary === true wins, persons fills gaps).
//   Fields that only exist on `persons` (function_latest, parliament_sector,
//   parliament_seat, image_url_oparl, *_external_id) are always kept from
//   `persons`. If no identity is flagged primary, `persons` is used as-is.
// - body lookup + label helpers (body_key -> bodies.id).
// - date / birthday / age / wikidata formatting.
//
// Adjust the import path below to wherever your generated types live.

import type { PersonClient, IdentityClient, BodyClient } from "@/types/opd_db";

/* -------------------------------------------------------------------------- */
/* Effective person (persons + primary identity)                              */
/* -------------------------------------------------------------------------- */

/** Merged view consumed by the components. Same shape as PersonClient. */
export type EffectivePerson = PersonClient;

export interface ResolvedPerson {
    /** persons + primary identity, coalesced field-by-field. */
    person: EffectivePerson;
    /** The identity flagged is_primary, or null when none / no identities. */
    primaryIdentity: IdentityClient | null;
    /** All identities except the primary one (drives the "Also active in" list). */
    otherIdentities: IdentityClient[];
}

/**
 * Coalesce: primary identity wins where it has a value, persons fills the gaps.
 * Only fields present on BOTH schemas are overridden; persons-only fields are
 * left untouched.
 */
export function resolveEffectivePerson(
    persons: PersonClient,
    identities: IdentityClient[] = [],
): ResolvedPerson {
    const primaryIdentity = identities.find((i) => i.is_primary === true) ?? null;
    const otherIdentities = identities.filter((i) => i !== primaryIdentity);

    if (!primaryIdentity) {
        return { person: persons, primaryIdentity: null, otherIdentities };
    }

    const id = primaryIdentity; // shorthand
    const person: EffectivePerson = {
        ...persons,
        // identity wins, persons fills gaps — id of the record stays the persons id.
        firstname: id.firstname ?? persons.firstname,
        lastname: id.lastname ?? persons.lastname,
        fullname: id.fullname ?? persons.fullname,
        title: id.title ?? persons.title,
        birthday: id.birthday ?? persons.birthday,
        birthday_format: id.birthday_format ?? persons.birthday_format,
        deathday: id.deathday ?? persons.deathday,
        gender: id.gender ?? persons.gender,
        email: id.email ?? persons.email,
        phone: id.phone ?? persons.phone,
        street: id.street ?? persons.street,
        postal_code: id.postal_code ?? persons.postal_code,
        city: id.city ?? persons.city,
        website_personal: id.website_personal ?? persons.website_personal,
        language: id.language ?? persons.language,
        active: id.active ?? persons.active,
        wikidata_id: id.wikidata_id ?? persons.wikidata_id,
        party_harmonized_wikidata_id:
            id.party_harmonized_wikidata_id ?? persons.party_harmonized_wikidata_id,
        image_url_external: id.image_url_external ?? persons.image_url_external,
        body_id: id.body_id ?? persons.body_id,
        body_key: id.body_key ?? persons.body_key,
        party: id.party ?? persons.party,
        party_harmonized: id.party_harmonized ?? persons.party_harmonized,
        occupation: id.occupation ?? persons.occupation,
        marital_status: id.marital_status ?? persons.marital_status,
        electoral_district: id.electoral_district ?? persons.electoral_district,
        parliamentary_group_name:
            id.parliamentary_group_name ?? persons.parliamentary_group_name,
        website_parliament_url:
            id.website_parliament_url ?? persons.website_parliament_url,
    } as PersonClient;

    return { person, primaryIdentity, otherIdentities };
}

/* -------------------------------------------------------------------------- */
/* Bodies (body_key -> body)                                                  */
/* -------------------------------------------------------------------------- */

export function buildBodyLookup(
    bodies: BodyClient[] = [],
): Map<string, BodyClient> {
    return new Map(bodies.map((b) => [b.body_key, b]));
}

/**
 * Human label for a parliament/body. Prefers the legislative (parliament) name.
 * With `opts.canton`, appends the canton abbreviation when present, e.g.
 * "Grosser Rat (BE)" — disambiguates cantonal bodies that share a type name.
 * National councils and Liechtenstein bodies have no `canton_key`, so they get
 * no suffix.
 */
export function bodyLabel(
    bodyKey: string | null | undefined,
    lookup: Map<string, BodyClient>,
    opts?: { canton?: boolean },
): string | null {
    if (!bodyKey) return null;
    const b = lookup.get(bodyKey);
    if (!b) return bodyKey; // fall back to the raw key if the body isn't loaded
    const label = b.legislative_name ?? b.name ?? b.type_name ?? b.body_key;
    if (opts?.canton && b.canton_key) return `${label} (${b.canton_key})`;
    return label;
}

export function bodyFlagUrl(
    bodyKey: string | null | undefined,
    lookup: Map<string, BodyClient>,
): string | null {
    if (!bodyKey) return null;
    const b = lookup.get(bodyKey);
    return b?.flag_image_url ?? b?.flag_image_oparl_url ?? null;
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** Date precision inferred from the raw string shape (handles partial dates). */
type DatePrecision = "year" | "month" | "day" | "unknown";

function precisionOf(raw: string): DatePrecision {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return "day";
    if (/^\d{4}-\d{2}$/.test(raw)) return "month";
    if (/^\d{4}$/.test(raw)) return "year";
    return "unknown";
}

/**
 * Format a (possibly partial) ISO date. `birthday_format` is accepted as an
 * optional precision hint but the string shape takes precedence, so unknown
 * format codes never break rendering.
 */
export function formatDate(
    raw: string | number | null | undefined,
    locale = "de-CH",
    hint?: string | null,
): string | null {
    if (raw == null) return null;
    // Epoch-millis dates (e.g. deathday) — format as a full UTC day so they
    // render the same as a day-precision birthday string.
    if (typeof raw === "number") {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return null;
        return new Intl.DateTimeFormat(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC",
        }).format(d);
    }
    if (raw === "") return null;
    const precision =
        hint === "year" || hint === "month" || hint === "day"
            ? (hint as DatePrecision)
            : precisionOf(raw);

    // Year needs no Date at all.
    if (precision === "year") return /^\d{4}/.test(raw) ? raw.slice(0, 4) : raw;
    if (precision === "unknown") return raw;

    // Build an *explicit* UTC instant. Constructing from the raw string risks a
    // local-time parse for date-time values without an offset, which would shift
    // the calendar day between a UTC server and a local-zone browser.
    const isoUtc =
        precision === "month"
            ? `${raw.slice(0, 7)}-01T00:00:00Z`
            : `${raw.slice(0, 10)}T00:00:00Z`;
    const d = new Date(isoUtc);
    if (Number.isNaN(d.getTime())) return raw; // unparseable -> show as-is

    return new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "long",
        ...(precision === "day" ? { day: "numeric" as const } : {}),
        timeZone: "UTC",
    }).format(d);
}

/** Valid value for a <time dateTime> attribute, or undefined if not ISO-like. */
export function isoDateTime(
    raw: string | number | null | undefined,
): string | undefined {
    if (raw == null) return undefined;
    if (typeof raw === "number") {
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
    }
    if (!raw) return undefined;
    return precisionOf(raw) === "unknown" ? undefined : raw.slice(0, 10);
}

/**
 * Age in whole years — only when a full birth date is known.
 * `now` is passed in explicitly so this never reads the clock during render
 * (which would differ between SSR and hydration). For a deceased person the
 * result is fully deterministic and `now` is ignored.
 */
export function ageOf(
    birthday: string | null | undefined,
    deathday: string | number | null | undefined,
    now: Date = new Date(),
): number | null {
    if (!birthday || precisionOf(birthday) !== "day") return null;
    const start = new Date(`${birthday.slice(0, 10)}T00:00:00Z`);
    const end =
        deathday == null
            ? now
            : typeof deathday === "number"
                ? new Date(deathday)
                : new Date(`${deathday.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    let age = end.getUTCFullYear() - start.getUTCFullYear();
    const m = end.getUTCMonth() - start.getUTCMonth();
    if (m < 0 || (m === 0 && end.getUTCDate() < start.getUTCDate())) age--;
    return age >= 0 && age < 130 ? age : null;
}

/** True once a deceased person's age is fixed and safe to render on the server. */
export function isDeterministicAge(
    birthday: string | null | undefined,
    deathday: string | number | null | undefined,
): boolean {
    return deathday != null && !!birthday && precisionOf(birthday) === "day";
}

/**
 * Epoch millis (created_at / updated_at / updated_external_at) -> short date.
 * `timeZone` is explicit so a UTC server and a local-zone browser format the
 * same instant identically (no hydration mismatch). Defaults to Swiss time.
 */
export function formatEpoch(
    ms: number | null | undefined,
    locale = "de-CH",
    timeZone = "Europe/Zurich",
): string | null {
    if (ms == null) return null;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(d);
}

export function wikidataUrl(id: string | null | undefined): string | null {
    return id ? `https://www.wikidata.org/wiki/${id}` : null;
}

/** fullname, falling back to "firstname lastname". */
export function displayName(p: {
    fullname?: string | null;
    firstname?: string | null;
    lastname?: string | null;
}): string {
    if (p.fullname) return p.fullname;
    return [p.firstname, p.lastname].filter(Boolean).join(" ").trim();
}

/** Initials for the avatar fallback. */
export function initials(p: {
    firstname?: string | null;
    lastname?: string | null;
    fullname?: string | null;
}): string {
    const first = p.firstname?.[0];
    const last = p.lastname?.[0];
    if (first || last) return `${first ?? ""}${last ?? ""}`.toUpperCase();
    const fn = p.fullname?.trim().split(/\s+/) ?? [];
    return (fn[0]?.[0] ?? "") + (fn[1]?.[0] ?? "");
}