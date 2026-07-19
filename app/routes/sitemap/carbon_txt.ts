// app/routes/sitemap/carbon_txt.ts
//
// GET /carbon.txt — the Green Web Foundation's sustainability disclosure format.
// Registered at the site root (OUTSIDE the ':lang?' prefix, like robots.txt) because
// the spec mandates exactly one file, discoverable at the domain root.
//
// Format: TOML, syntax version 0.5 (https://carbontxt.org/syntax).
//   • `version` + `org.disclosures` are REQUIRED — a valid file needs at least one
//     publicly fetchable disclosure document. Ours is /project/sustainability; the
//     validator follows that URL, so the page must stay reachable and public.
//   • `upstream.services` is the "connect not collect" half: rather than restating
//     AWS's energy claims as if they were parlhub's, we name AWS as the provider and
//     let readers follow the chain to AWS's own disclosures.
//   • `service_type` is omitted deliberately. It is optional, and the spec publishes
//     no authoritative slug list — the syntax page's own example shows a bare
//     `{ domain = "aws.amazon.com" }`. Better absent than guessed.
//
// URLs are derived from SITE_DEPLOYMENT via the sitemap URL helpers, so the domain
// and the disclosure path can never drift from the real routes.

import { SITE_LANGS } from "~/configs/site.config";
import { absoluteLocalizedUrl, SITE_ORIGIN } from "~/lib/seo/sitemap/urls";

/** The canonical (prefix-less) locale — the disclosure is linked in one language. */
const DEFAULT_LANG = SITE_LANGS.find((l) => l.default) ?? SITE_LANGS[0];

/** Bare host, no protocol/path — the shape `domain` fields want. */
const SITE_DOMAIN = new URL(SITE_ORIGIN).host;

const DISCLOSURE_URL = absoluteLocalizedUrl(DEFAULT_LANG.lang_param, "NS_SUSTAINABILITY");

// Hand-maintained: the date the DISCLOSURE last changed, not the date this file was
// served. Deriving it from `new Date()` would claim a fresh review every request.
const LAST_UPDATED = "2026-07-15";

const BODY = `# parlhub sustainability disclosure — https://carbontxt.org
version = "0.5"
last_updated = ${LAST_UPDATED}

[org]
disclosures = [
    { doc_type = "sustainability-page", url = "${DISCLOSURE_URL}", domain = "${SITE_DOMAIN}", title = "How parlhub is hosted, and what it does not measure" }
]

[upstream]
services = [
    { domain = "aws.amazon.com" }
]
`;

export function loader(): Response {
    return new Response(BODY, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
    });
}
