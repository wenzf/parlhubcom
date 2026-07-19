# Security

Headers live in [`csp.server.ts`](../app/lib/security/headers/csp.server.ts), applied
per-response in [`entry.server.tsx`](../app/entry.server.tsx) (`addSecurityHeaders`
+ `sanitizeHeaders`).

- **CSP** — nonce-based, **strict in dev and prod**: `script-src 'strict-dynamic'
  'nonce-…'`, `object-src`/`base-uri`/`frame-ancestors` `'none'`, `self` for
  font/form/manifest, `upgrade-insecure-requests`. A fresh 16-byte nonce is minted
  per request and threaded to `<ServerRouter>` + stream.
- **No `unsafe-eval`** — the client bundle must stay eval-free (typia is build-time
  codegen, zod runs jitless via the `<head>` bootstrap, arktype removed). Verify
  with a build grep before adding runtime schema/JIT libs. See [[csp-strict-no-unsafe-eval]].
- **OWASP header set** — HSTS (preload), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, COEP/COOP/CORP `same-origin`, locked-down
  `Permissions-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Header scrubbing** — `sanitizeHeaders` strips fingerprinting headers listed in
  [`headers_remove.json`](../app/lib/security/headers/headers_remove.json) (OWASP list).
