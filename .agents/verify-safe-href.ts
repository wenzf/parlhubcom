// .agents/verify-safe-href.ts
//
// Unit test for the URL-scheme allowlist (app/lib/security/safe_href.ts), the
// guard behind the shared external-link primitives (LinkValue, ExternalAction,
// LinkedItem, LightboxLink). Hostile schemes, including entity-encoded and
// whitespace-mangled forms, must come back `undefined`; allowlisted URLs must
// pass through unchanged.
//
// A manual, dev-only authoring check — NOT wired into build / deploy / CI. Run
// it from the repo root:
//   npx tsx .agents/verify-safe-href.ts    (wired as `npm run verify:safehref`)

import { safeHref } from "../app/lib/security/safe_href";

const BLOCKED: (string | null | undefined)[] = [
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)", // leading space
    "\u0001javascript:alert(1)", // leading control char
    "java\tscript:alert(1)", // tab inside the scheme
    "java\nscript:alert(1)", // newline inside the scheme
    "java\u0000script:alert(1)", // NUL inside the scheme
    "jav&#x09;ascript:alert(1)", // hex-entity tab
    "jav&#9;ascript:alert(1)", // decimal-entity tab
    "&#106;avascript:alert(1)", // entity-encoded scheme letter
    "javascript&colon;alert(1)", // entity-encoded colon
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "blob:https://example.com/x",
    "",
    null,
    undefined,
];

const ALLOWED = [
    "https://x",
    "https://www.parlament.ch/de/geschaeft?id=1",
    "http://example.com/path#frag",
    "mailto:a@b",
    "tel:+41791234567",
    "HTTPS://EXAMPLE.COM", // scheme test is case-insensitive
    "/people/42/votes", // scheme-less: no scheme, no payload
    "//static.example.com/a.pdf",
];

let failed = false;

for (const url of BLOCKED) {
    const got = safeHref(url);
    if (got !== undefined) {
        console.error(`FAIL blocked: ${JSON.stringify(url)} -> ${JSON.stringify(got)}, expected undefined`);
        failed = true;
    }
}

for (const url of ALLOWED) {
    const got = safeHref(url);
    if (got !== url) {
        console.error(`FAIL allowed: ${JSON.stringify(url)} -> ${JSON.stringify(got)}, expected pass-through unchanged`);
        failed = true;
    }
}

if (failed) {
    process.exit(1);
}
console.log(`safe_href OK: ${BLOCKED.length} hostile inputs blocked, ${ALLOWED.length} allowed URLs pass through unchanged.`);
