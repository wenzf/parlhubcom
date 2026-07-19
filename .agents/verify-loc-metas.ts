// .agents/verify-loc-metas.ts
//
// Parity guard for the SEO copy (see app/lib/seo/metas/keys.ts). Asserts that
// every language's `metas` block holds EXACTLY the keys in META_KEYS — no missing
// (would ship a raw key into <title>), no extra (dead copy). This replaces the
// compile-time exhaustiveness the old `Record<MetaLang, …>` copy tables gave us.
//
// A manual, dev-only authoring check — NOT wired into build / deploy / CI. Run it
// (and re-run after any public/locales `metas` change) from the repo root:
//   npx tsx .agents/verify-loc-metas.ts    (wired as `npm run verify:metas`)

import { readFileSync } from "node:fs";
import { META_KEYS } from "../app/lib/seo/metas/keys";

/** Namespaces (relative to public/locales/<lang>/) that carry a `metas` block.
 *  Entity SEO copy lives in loc_data_dashboard; the bespoke one-off pages carry
 *  theirs in their own namespace (project/experiments have no own loader, so
 *  their copy rides in loc_main). The union of all `metas` blocks must equal
 *  META_KEYS exactly, with no key duplicated across namespaces. */
const NAMESPACES = [
    "loc_data_dashboard",
    "loc_home",
    "loc_about",
    "loc_faq",
    "loc_sustainability",
    "loc_traffic_stats",
    "loc_accessibility",
    "loc_data_map",
    "loc_start",
    "loc_guide",
    "loc_methodology",
    "loc_imprint",
    "loc_experiments",
    "loc_main",
];
const LANGS = ["en", "de", "fr", "it", "es", "pt", "rm"];

const expected = new Set<string>(META_KEYS);
let failed = false;

const fail = (msg: string) => {
    console.error(`✗ ${msg}`);
    failed = true;
};

for (const lang of LANGS) {
    const found = new Set<string>();
    for (const ns of NAMESPACES) {
        const path = `public/locales/${lang}/${ns}.json`;
        let json: Record<string, unknown>;
        try {
            json = JSON.parse(readFileSync(path, "utf8"));
        } catch (e) {
            fail(`${path}: cannot read/parse (${(e as Error).message})`);
            continue;
        }
        const metas = (json.metas ?? {}) as Record<string, string>;
        for (const k of Object.keys(metas)) {
            if (found.has(k)) fail(`${lang}: duplicate key across namespaces: ${k}`);
            found.add(k);
        }
    }
    for (const k of expected) if (!found.has(k)) fail(`${lang}: MISSING key: ${k}`);
    for (const k of found) if (!expected.has(k)) fail(`${lang}: EXTRA key (not in META_KEYS): ${k}`);
}

if (failed) {
    console.error(`\nloc_metas parity FAILED (${META_KEYS.length} expected keys × ${LANGS.length} langs).`);
    process.exit(1);
}
console.log(`✓ loc_metas parity OK: ${META_KEYS.length} keys × ${LANGS.length} langs.`);
