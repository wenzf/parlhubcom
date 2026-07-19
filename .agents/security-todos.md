# Security todos (pre open-source)

Work an agent can finish end-to-end. Each item lists the files, the fix, and how to
prove it worked. Each step is sized for a single session; where a step must precede
another, it says so under **Order**.

From a security review on 2026-07-17 done before making the repo public. The full
review covered SQL injection, path traversal, SSRF, CSP and headers, and rich-text
XSS, all of which came back clean (see "Checked and clean" at the bottom). The items
below are the exceptions. Two of them (steps 1 and 4) are hard blockers on flipping
the GitHub repo public; steps 2, 3, 5 are fixes that do not block publishing.

House rule for any copy touched here: no em-dashes. Use commas, colons, full stops.
Any `public/locales/**` edit must sync the [`/localization`](../localization/) mirror
in the same change, and `npm run verify:metas` must stay green.

**The one ordering rule that matters: do step 1 (rotate the secret) before step 4
(scrub history).** Rewriting history while the leaked secret is still live in
production would purge the evidence without closing the hole.

---

## 1. Rotate and relocate the cookie signing secret: BLOCKER

The cookie signing key is committed in a tracked file and used to sign the
`__settings` cookie. Publishing the repo publishes the key. It only signs a
cosmetic UI-preferences cookie (`httpOnly`, `secure`, `sameSite=lax`, no auth data),
so the blast radius is cookie tampering, not account takeover, but it is a live
secret and must be rotated and moved out of tracked source.

**Files:**
- [`sst-secrets.ts`](../sst-secrets.ts) (tracked; holds the cookie signing secret and `AWS_PROFILE`)
- [`app/server/sessions/settings.server.ts`](../app/server/sessions/settings.server.ts) (reads the secret at line 9)
- [`sst.config.ts`](../sst.config.ts) (imports `AWS_PROFILE` at line 3)
- [`.dockerignore`](../.dockerignore) (does not currently exclude `sst-secrets.ts`)

Delivery model, since it caused a question: the secret must arrive as a runtime
environment variable, NOT bundled into source. The app reads plain `process.env` and
does not import the `sst` `Resource` object (confirmed), and its deploy config
(`DB_S3_BUCKET`, `DB_PATH`, `DUCKDB_*`, `ANALYTICS_SUMMARY_URL`) already arrives that
way through the Service `environment` block. An SST Secret is stored in SSM and
injected into the ECS task definition at deploy time; it is never baked into the Docker
image (the image only carries `build/`). So "the app lives inside Docker" is not a
blocker: the value reaches the container the same way `DB_S3_BUCKET` does today.

**Fix:**
1. Generate a fresh random secret (for example `openssl rand -base64 32`). Do not
   reuse the old value.
2. Deliver it as an env var, matching the existing pattern. In `sst.config.ts` add
   `const cookieSecret = new sst.Secret("CookieSecret")` and put
   `COOKIE_SECRET: cookieSecret.value` in the Web service `environment` block (no
   `link`/`Resource` needed, since the app reads `process.env`). Set the value out of
   band: `npx sst secret set CookieSecret <value> --stage production`. Lighter
   alternative if you would rather not use SST Secret at all:
   `COOKIE_SECRET: process.env.COOKIE_SECRET` and export it in the deploy shell / CI.
3. In `settings.server.ts`, read `process.env.COOKIE_SECRET` instead of importing
   `SST_SECRETS`. Keep the `secrets: [...]` array shape so rotation stays one line. Add
   a dev fallback: `npm run dev` does not inject these env vars (only `sst dev` and the
   deployed task do), so when the var is unset and `NODE_ENV !== "production"` use a
   clearly-labelled throwaway default; throw in production if it is missing, so a
   misconfigured deploy fails loud instead of signing with `undefined`.
4. `AWS_PROFILE` is a local dev convenience, not a secret, but it should not stay in
   a tracked file either. Move it to an untracked local config or `.env`; keep the
   `sst.config.ts` read working from that.
5. `git rm --cached sst-secrets.ts` so it is no longer tracked. Removing the
   `import { SST_SECRETS }` in step 3 is what actually keeps the value out of the
   bundled `build/server`, so it stops reaching the Web image; also add `sst-secrets.ts`
   to [`.dockerignore`](../.dockerignore) as belt-and-suspenders for the update and
   analytics Dockerfiles that `COPY . .`.

Residual exposure, acceptable for a cosmetic cookie key: the resolved value appears in
the ECS task definition in plaintext (readable with `ecs:DescribeTaskDefinition`),
IAM-gated and far better than a committed secret. To keep it never-in-plaintext,
deliver it via ECS native `secrets` / `valueFrom` (pulled from SSM at container start)
through a task-definition transform instead of `environment`.

Note: rotating invalidates every existing `__settings` cookie, so users re-pick their
UI preferences once. That is acceptable for cosmetic settings.

**Prove it:**
- `git ls-files | grep sst-secrets.ts` returns nothing.
- Build the server bundle and grep it: the old literal secret must not appear in
  `build/server/index.js`.
- In dev, change a setting (theme or contrast), reload, and confirm it persists (the
  cookie still signs and verifies with the new key).

---

## 2. Add a URL-scheme allowlist for external links (`safeHref`): fix (DONE 2026-07-17)

Done: helper at [`app/lib/security/safe_href.ts`](../app/lib/security/safe_href.ts),
applied inside all four primitives (disallowed URLs render non-interactive text).
Proven by `npm run verify:safehref` ([`verify-safe-href.ts`](verify-safe-href.ts),
19 hostile inputs blocked, 8 allowed pass through) and a grep sweep: every other
dynamic anchor binds an app-generated path or static config, not source data.

External-link hrefs are bound straight into JSX from OpenParlData fields with no
scheme check. React 19 does not block `javascript:` URLs, so a single hostile URL in
a source field (for example `speech.video_url = "javascript:..."`) executes in the
site origin on click. The rich-text HTML path is already defended by `sanitize()`;
this is the one place data-derived URLs bypass it. The project already treats
OpenParlData rich-text as untrusted (see [`docs/edge-cases.md`](../docs/edge-cases.md)),
so the same posture should cover URLs.

**Files (link primitives, all render `href={href}` unchecked):**
- [`app/components/opd_views/opd_micros.tsx`](../app/components/opd_views/opd_micros.tsx)
  `LinkValue` (line 82), `ExternalAction` (line 106), `LinkedItem` external branch (line 157)
- [`app/components/opd_views/person/PersonImages.tsx`](../app/components/opd_views/person/PersonImages.tsx)
  `LightboxLink` (line 550)

**Fix:**
- Add a `safeHref(url: string | null | undefined): string | undefined` helper (for
  example in `app/lib/security/`). Allow only `http:`, `https:`, `mailto:`, `tel:`.
  Parse defensively (decode entities and trim leading control chars before the scheme
  test, the same way js-xss `safeAttrValue` does). Return `undefined` for anything
  else so the anchor renders without an `href`.
- Apply it inside the four primitives above so every caller is covered at the sink,
  not per call site. When `safeHref` returns `undefined`, render non-interactive text
  rather than a dead link.

**Prove it:**
- Unit test the helper: `javascript:alert(1)`, ` javascript:...` (leading space),
  `java\tscript:...`, `data:text/html,...`, `vbscript:...` all return `undefined`;
  `https://x`, `mailto:a@b`, `tel:+41...` pass through unchanged.
- Grep confirms no remaining anchor binds a data-derived `href` without `safeHref`.

---

## 3. Harden the settings action: fix (DONE 2026-07-17)

Done: the action now returns an explicit 200 with Set-Cookie and no Location header
at all. The redirect_to form field is ignored and no longer sent by callers: the
fetchers revalidate in place, which is what applied the settings all along, so the
open-redirect surface is removed rather than guarded. The payload is sanitized
against SETTINGS_DEFAULT: unknown keys are dropped, theme and content_lang must be
one of the offered values, font_size is clamped to FONT_SIZE_MIN..MAX (constants
moved to site.config.ts, shared with the header stepper), and the flags must be
real booleans. The stored cookie is re-sanitized on every write, so junk in an
existing cookie is healed on the next settings change. Proven against the dev
server: hostile redirect_to values emit no Location, junk keys and a 500-key
payload do not persist (the cookie stays capped at the 7 known keys), a forged
signed cookie carrying junk is cleaned by the next write, and valid changes merge
and persist.

[`site_set_settings.tsx`](../app/routes/actions_and_loaders/site_set_settings.tsx) is
the only state-mutating action in the app (route `actions/cu-settings`). Two gaps. The
cookie holds only cosmetic UI preferences (`SETTINGS_DEFAULT`: theme, font size,
contrast, grayscale, content-lang, two hint flags), read only by
[`mw_settings.ts`](../app/server/middleware/mw_settings.ts) to render chrome, never for
an authorization decision.

CSRF protection is deliberately NOT on this list. With the cookie carrying only cosmetic
prefs, a forced cross-site POST could at most flip a tricked victim's own settings
(reversible at any time), and `sameSite=lax` already stops the endpoint from acting as
the victim, so a token buys nothing here. Revisit only if `__settings` ever carries
something read for authorization or entitlement.

**Files:**
- [`app/routes/actions_and_loaders/site_set_settings.tsx`](../app/routes/actions_and_loaders/site_set_settings.tsx)
- callers pass `redirect_to = currentURL` (a same-origin path) and revalidate in place:
  [`app/components/blocks/header/index.tsx`](../app/components/blocks/header/index.tsx) (lines 146, 201),
  [`app/components/blocks/site-intro/index.tsx`](../app/components/blocks/site-intro/index.tsx) (line 111)

**Fix:**
1. **Open-redirect guard (line 16).** `startsWith('/')` lets protocol-relative
   `//evil.com` and backslash `/\evil.com` through. It is currently inert only because
   the response is `status: 200` (a 200 with a `Location` header is not followed), but
   that is accidental safety. Reject anything that is not a single-slash same-origin
   path: accept only when it matches `/^\/(?!\/|\\)/`, else fall back to `/`. The
   callers pass same-origin paths, so this keeps the feature working.
2. **Response status (line 30).** Decide the redirect intent explicitly. The callers
   are fetchers that revalidate on completion, so a plain `200` already applies the
   settings. If a real navigation is wanted, use `303` and keep the guard from step 1
   in the same change (never ship a live redirect with the weak guard).
3. **Payload validation (line 24).** `parseJSON(formData.get('payload'))` is
   spread-merged with no schema, so arbitrary keys land in the cookie. Two reasons to
   fix: it drops junk keys, and it caps the cookie so a hostile oversized payload cannot
   push it past the ~4KB browser limit (which would drop the cookie or bloat every
   request header for that victim). Keep only keys present in `SETTINGS_DEFAULT` and
   coerce values to their expected type before `session.set`. Values are React-escaped
   on read, so this is not an XSS fix.

**Prove it:**
- A cross-site-style POST with `redirect_to=//evil.com` never emits
  `Location: //evil.com` (guard rejects it, or the status is not a redirect).
- A POST with an unknown `payload` key does not persist that key.
- In dev, the normal settings menu still applies and persists a change (feature intact).

---

## 4. Scrub git history and publish clean: BLOCKER, destructive, do last (DONE 2026-07-17)

Done via the fresh-history option: the entire prior history was discarded and replaced
by a single root commit carrying the sanitized HEAD tree, then force-pushed to origin.
Step 1's code changes were verified in place first (the app reads the env var,
`sst.config.ts` wires an SST Secret, the secrets file is untracked and git-ignored).
Before the rewrite, HEAD was swept for every leak item; the only hit was this file,
which quoted the AWS account id and the old secret variable name verbatim, so it was
sanitized in the same change.

**What was in the old history (now erased):**
- The old cookie secret value in the tracked secrets file.
- The AWS account id and the real S3 bucket name, in an agent plan doc.
- A deleted cpuprofile embedding the local OS username in absolute paths.

**Proven:**
- `git log --all -S` sweeps for the old secret value, the AWS account id, and the real
  bucket name return nothing; the cpuprofile appears in no commit.
- A fresh clone from origin contains exactly one commit and none of those identifiers.
- Local reflogs were expired and unreachable objects pruned. GitHub may retain
  unreachable objects server-side for a while; the secret is rotated and the repo stays
  private until the flip, so that residual is acceptable.

**Remaining before flipping visibility:**
- Confirm the production secret value was actually rotated out of band
  (`npx sst secret set CookieSecret <fresh value> --stage production`).
- Confirm the author identity on the root commit is intended to be public.

---

## 5. Low-severity hardening and cleanup: optional, one session

Group these into a single pass. None block publishing.

- **Ingest decompression cap.** [`ingest/remoteimport.ts`](../ingest/remoteimport.ts):
  `zlib.createGunzip()` has no `maxOutputLength`, and the `readline` reader has no
  line-length cap, so a decompression bomb with no newline could OOM. Offline,
  maintainer-run, trusted bucket, so low. Add a size guard.
- **Ingest redirect target.** Same file: the shard fetch follows redirects by default,
  so host pinning only covers the initial request. Re-validate the final host, or set
  `redirect: "manual"` and reject off-host redirects.
- **Unbounded OFFSET.** [`app/lib/urls/params.ts`](../app/lib/urls/params.ts) (line 8)
  and the export route accept an arbitrarily large offset (slow-scan pressure, bounded
  by table size). Cap it at a sane maximum.
- **`.gitignore` typo.** The `./identity` line looks like it was meant to be
  `.identity/`. Harmless now, worth fixing.
- **Untracked `INTERNAL.md`.** Holds real infra identifiers, verified never committed.
  Keep it untracked; consider moving it outside the repo before inviting contributors.

---

## Checked and clean (2026-07-17)

Recorded so a later session does not re-audit these from scratch:

- **SQL injection.** Parameter-bound end to end via the single runner
  ([`app/server/db/core/runner.ts`](../app/server/db/core/runner.ts)). The only
  templated SQL fragment, `/* __ORDER_BY__ */`, is an exact-match (`===`) allowlist in
  `resolveOrderBy` ([`app/lib/dimensions/filters.ts`](../app/lib/dimensions/filters.ts)):
  the raw sort key never reaches SQL, only the descriptor's own `sqlExpr` literal.
  LIMIT and OFFSET are coerced and range-checked. Search terms are `escapeRegExp`'d and
  run on DuckDB RE2 (no ReDoS). Every interpolated table or column name is a hardcoded
  constant. No `read_csv`/`read_json`/`httpfs`/`ATTACH`/`INSTALL` sinks; DB opened
  READ-ONLY.
- **Path traversal.** Sitemap shards use an enum registry plus a strict filename regex;
  locale loading resolves `lang` through `langByParam` (never raw `params.lang`) and the
  namespace is always a hardcoded literal; exports are serialized from DB queries with
  whitelisted segments. No fs sink takes a request-derived path.
- **SSRF (running app).** Every outbound `fetch` uses an env-pinned, hardcoded, or
  same-origin URL. The ingest "rebuild on the fetched host" design genuinely resists
  host override (hostile `filename` values become path, not authority).
- **CSP and headers.** Per-request 128-bit nonce; `script-src` is `strict-dynamic` +
  nonce with no `unsafe-inline`/`unsafe-eval`/host wildcard; `object-src`/`base-uri`/
  `frame-ancestors` are `none`. JSON-LD is a nonce-free data block, escaped against
  `</script>` breakout. Response header values are static literals (no header
  injection). Host header is not trusted for canonical/OG/sitemap URLs (build constant).
- **Rich-text XSS.** All `dangerouslySetInnerHTML` goes through
  [`app/lib/security/sanitize.ts`](../app/lib/security/sanitize.ts) (js-xss allowlist +
  `balanceTags`); `javascript:` is stripped by js-xss `safeAttrValue`. The only gap is
  data-bound anchor hrefs, which is step 2.
- **Infra config.** [`sst.config.ts`](../sst.config.ts) IAM is least-privilege, the
  public S3 policy is pinned to the single `analytics/summary.json` key, and raw
  user-agent daily files stay private. No `.env`, key, or PEM was ever committed.
