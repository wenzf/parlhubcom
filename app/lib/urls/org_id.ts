// org_id.ts                       → ~/lib/urls/org_id.ts
//
// Organizations are derived from interests (grouped by the normalized org name),
// not a real table with a numeric id — so the "id" in /organizations/:id is the
// normalized org KEY (lower-cased display name), URL-encoded with base64url so it
// survives slashes / unicode / spaces in a single path segment. Universal
// (browser + Node ≥18): uses TextEncoder/TextDecoder + btoa/atob.

import type { Params, Path } from "react-router";
import { localizedPath } from "~/lib/lang";

export function encodeOrgId(orgKey: string): string {
    const bytes = new TextEncoder().encode(orgKey);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeOrgId(id: string): string {
    const b64 = id.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

/**
 * Localized internal link to an organization detail page (/organizations/:id)
 * from its normalized org KEY (lower-cased display name). Resolves through the
 * PAGE_CONFIG absolute_path + the active `:lang?` prefix, so links stay on the
 * current language. Replaces the old (unlocalized) `orgPath`.
 */
export function localizedOrgPath(
    lang: Params["lang"],
    orgKey: string,
): Path["pathname"] {
    return localizedPath(lang, "NS_ORGANIZATIONS_OVERVIEW", {
        id: encodeOrgId(orgKey),
    });
}