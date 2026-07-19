// hrefs.ts                           → ~/lib/urls/hrefs.ts
//
// Typed helpers for building localized links to entity detail pages. These wrap
// `localizedPath(lang, "NS_<X>_OVERVIEW", { id })` so call sites read as
// `peopleHref(lang, id)` instead of repeating the namespace + `String(id)`
// boilerplate ~35 times — and so raw, unlocalized `/people/${id}` template
// strings (which drop the language prefix) can be replaced with a single
// localization-aware helper. Organizations keep their own encoder in org_id.ts
// (their id is a base64url key, not a numeric id) — see `localizedOrgPath`.

import type { Params, Path } from "react-router";
import { localizedPath } from "../lang";

type Id = string | number;
const detail = (
    lang: Params["lang"],
    ns: Parameters<typeof localizedPath>[1],
    id: Id,
): Path["pathname"] => localizedPath(lang, ns, { id: String(id) });

export const peopleHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_PEOPLE_OVERVIEW", id);
export const bodyHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_BODIES_OVERVIEW", id);
export const affairHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_AFFAIRS_OVERVIEW", id);
export const groupHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_GROUPS_OVERVIEW", id);
export const meetingHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_MEETINGS_OVERVIEW", id);
export const votingHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_VOTINGS_OVERVIEW", id);
export const interestHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_INTERESTS_OVERVIEW", id);
export const speechHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_SPEECHES_OVERVIEW", id);
export const textHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_TEXTS_OVERVIEW", id);
export const docHref = (lang: Params["lang"], id: Id) => detail(lang, "NS_DOCS_OVERVIEW", id);
