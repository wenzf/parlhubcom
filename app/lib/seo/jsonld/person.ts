// /app/lib/seo/jsonld/person.ts
//
// ProfilePage + Person graph fragment for a /people/:id page — the head JSON-LD
// replacing the visible-DOM microdata that <PersonBase />/<PersonFull /> and the
// people layout used to emit. Wired into `personMeta`/`personDimensionMeta`
// (metas/person.ts) so every person route gets it for free.

import type { MetaLang } from "~/lib/seo/metas/core";
import type { PersonClient, IdentityClient, BodyClient } from "@/types/opd_db";
import {
    resolveEffectivePerson,
    displayName,
    isoDateTime,
    wikidataUrl,
} from "~/lib/domain/person";
import { personNodeId, personPageUrl, bodyNodeId } from "./ids";

/** The person base block every /people/:id* loader carries (same shape the meta
 *  facts resolver reads). Fields are optional so the metas data type assigns. */
type PersonNodeData =
    | {
        persons?: PersonClient | null;
        person_identities?: { items?: IdentityClient[] };
        bodies?: { items?: BodyClient[] };
    }
    | null
    | undefined;

/**
 * ProfilePage → Person graph nodes for a person page. Returns `[]` when the
 * record (or its name) is absent — the leaf `meta()` then emits nothing for the
 * entity. `@id` is the canonical `…/people/:id#identity` anchor (ids.ts), so the
 * Dataset `about` refs on the same page resolve to this node.
 */
export function personNode(
    data: PersonNodeData,
    lang: MetaLang,
    _path: string | undefined,
): object[] {
    const persons = data?.persons;
    if (!persons) return [];
    const { person } = resolveEffectivePerson(persons, data?.person_identities?.items ?? []);
    if (person.id == null) return [];
    const name = displayName(person);
    if (!name) return [];

    const nodeId = personNodeId(person.id);
    const url = personPageUrl(person.id);
    const image = person.image_url_oparl ?? person.image_url_external ?? undefined;

    const node: Record<string, unknown> = { "@type": "Person", "@id": nodeId, name, url };
    if (person.firstname) node.givenName = person.firstname;
    if (person.lastname) node.familyName = person.lastname;
    if (person.title) node.honorificPrefix = person.title;
    if (image) node.image = image;
    if (person.function_latest) node.jobTitle = person.function_latest;
    if (person.gender) node.gender = person.gender;
    if (person.email) node.email = person.email;
    if (person.phone) node.telephone = person.phone;

    const birthDate = isoDateTime(person.birthday);
    if (birthDate) node.birthDate = birthDate;
    const deathDate = isoDateTime(person.deathday);
    if (deathDate) node.deathDate = deathDate;

    // memberOf: harmonized party + parliamentary group (name-only orgs) and the
    // mandating body (by @id, so the graph links to the body node on its pages).
    const memberOf: object[] = [];
    const party = person.party_harmonized ?? person.party ?? null;
    if (party) memberOf.push({ "@type": "Organization", name: party });
    if (person.parliamentary_group_name)
        memberOf.push({ "@type": "Organization", name: person.parliamentary_group_name });
    if (person.body_id != null) memberOf.push({ "@id": bodyNodeId(person.body_id) });
    if (memberOf.length) node.memberOf = memberOf;

    if (person.street || person.postal_code || person.city) {
        node.address = {
            "@type": "PostalAddress",
            ...(person.street ? { streetAddress: person.street } : {}),
            ...(person.postal_code ? { postalCode: person.postal_code } : {}),
            ...(person.city ? { addressLocality: person.city } : {}),
        };
    }

    const sameAs = [wikidataUrl(person.wikidata_id), person.website_parliament_url ?? null].filter(
        (s): s is string => !!s,
    );
    if (sameAs.length) node.sameAs = sameAs;

    return [
        {
            "@type": "ProfilePage",
            "@id": `${url}#profilepage`,
            url,
            name,
            inLanguage: lang,
            mainEntity: { "@id": nodeId },
        },
        node,
    ];
}
