// /app/lib/seo/jsonld/ids.ts
//
// Canonical `@id` + page-URL builders — the single source of node identity for
// the whole structured-data graph. Every JSON-LD node and every cross-reference
// (`about`, `author`, `memberOf`, …) resolves through one of these, so an
// entity's node id is defined in exactly one place.
//
// The scheme is `${SITE_URL}/<segment>/<id>#identity`, where `<segment>` comes
// from `URL_PATH_SEGMENTS` (site.config) — the SAME map the router uses to build
// the public paths. Deriving the segment here (rather than hardcoding it) keeps
// the node id, the canonical link and the breadcrumb `item` in lockstep: when a
// section moves (e.g. bodies → `/parliaments`), the graph follows automatically.
// Domain comes from SITE_URL — never hardcode it.

import { URL_PATH_SEGMENTS as SEG } from "~/configs/site.config";
// Leaf import (metas/core, not the metas barrel) so ids.ts stays OUT of the
// metas ⇄ jsonld init cycle — the entity node-id fns are captured at module
// init by makeDatasets(); a barrel import leaves them undefined under Vite SSR.
import { SITE_URL } from "~/lib/seo/metas/core";

const nodeId = (segment: string, id: number | string): string =>
    `${SITE_URL}/${segment}/${id}#identity`;
const pageUrl = (segment: string, id: number | string): string =>
    `${SITE_URL}/${segment}/${id}`;

/** `${SITE_URL}/people/:id#identity` — the person's schema.org node. */
export const personNodeId = (id: number | string): string => nodeId(SEG.PEOPLE, id);
/** The person's canonical page URL (no `#identity` anchor). */
export const personPageUrl = (id: number | string): string => pageUrl(SEG.PEOPLE, id);

/** `${SITE_URL}/parliaments/:id#identity` — a council / committee (body) node. */
export const bodyNodeId = (id: number | string): string => nodeId(SEG.BODIES, id);
export const bodyPageUrl = (id: number | string): string => pageUrl(SEG.BODIES, id);

/** `${SITE_URL}/groups/:id#identity` — a party / fraction node. */
export const groupNodeId = (id: number | string): string => nodeId(SEG.GROUPS, id);
export const groupPageUrl = (id: number | string): string => pageUrl(SEG.GROUPS, id);

/** `${SITE_URL}/affairs/:id#identity` — a legislative-business node. */
export const affairNodeId = (id: number | string): string => nodeId(SEG.AFFAIRS, id);
export const affairPageUrl = (id: number | string): string => pageUrl(SEG.AFFAIRS, id);

/** `${SITE_URL}/meetings/:id#identity` — a meeting / session node. */
export const meetingNodeId = (id: number | string): string => nodeId(SEG.MEETINGS, id);
export const meetingPageUrl = (id: number | string): string => pageUrl(SEG.MEETINGS, id);

/** `${SITE_URL}/interests/:id#identity` — a lobbying-interest node. */
export const interestNodeId = (id: number | string): string => nodeId(SEG.INTERESTS, id);
export const interestPageUrl = (id: number | string): string => pageUrl(SEG.INTERESTS, id);

/** `${SITE_URL}/organizations/:key#identity` — an organization node. Keyed by a
 *  string `key` (not a numeric id), URL-encoded to match the router path. */
export const orgNodeId = (key: string): string => nodeId(SEG.ORGANIZATIONS, encodeURIComponent(key));
export const orgPageUrl = (key: string): string => pageUrl(SEG.ORGANIZATIONS, encodeURIComponent(key));

/** `${SITE_URL}/speeches/:id#identity` — a speech CreativeWork node. */
export const speechNodeId = (id: number | string): string => nodeId(SEG.SPEECHES, id);
export const speechPageUrl = (id: number | string): string => pageUrl(SEG.SPEECHES, id);

/** `${SITE_URL}/texts/:id#identity` — a text CreativeWork node. */
export const textNodeId = (id: number | string): string => nodeId(SEG.TEXTS, id);
export const textPageUrl = (id: number | string): string => pageUrl(SEG.TEXTS, id);

/** `${SITE_URL}/docs/:id#identity` — a document DigitalDocument node. */
export const docNodeId = (id: number | string): string => nodeId(SEG.DOCS, id);
export const docPageUrl = (id: number | string): string => pageUrl(SEG.DOCS, id);
