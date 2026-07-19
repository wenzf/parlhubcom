# Edge cases

Known data-shape gotchas that break otherwise-correct analytics. Prefer fixing
in SQL/loaders (graceful fallback) over special-casing a country.

## Liechtenstein: no harmonized party / no vote-time group snapshot

Liechtenstein bodies (e.g. body 130, the Landtag) carry raw party names
(`persons.party_de` = VU/FBP/DPL/FL) but **not** the harmonized fields Swiss data
has. Symptoms and fixes:

- `party_harmonized_wikidata_id` is NULL → party-keyed features drop everyone.
  Fix: key on `COALESCE(party_harmonized_wikidata_id, <localized party name>)`
  (matches `buildColorMap`, which already keys `party_key ?? party`).
  Seen in [`body_alignment_by_id.sql`](../app/server/db/sql/bodies/body_alignment_by_id.sql)
  (empty heatmap).
- `votes.person_parliamentary_group_name_*` (vote-time group snapshot) is 100%
  NULL — also true for some other bodies (e.g. 270 fully, 42 ~half). Group-keyed
  features find no groups. Fix: `COALESCE(snapshot, persons.party_*)` so vote-time
  correctness is kept where the snapshot exists and only gaps fall back.
  Seen in [`body_loyalty_by_id.sql`](../app/server/db/sql/bodies/body_loyalty_by_id.sql)
  ("No votes meet the thresholds").

Rule of thumb: any feature that groups by party/parliamentary group must tolerate
a missing harmonized id or missing vote-time snapshot.

## Classical MDS on non-Euclidean distances (alignment scatter)

Agreement distances aren't guaranteed Euclidean, so the double-centered matrix B
can have a large **negative** eigenvalue (common in small/lopsided windows).
Power iteration returns the largest-**magnitude** eigenvalue — possibly that
negative one — and `√max(λ,0)` then collapsed an axis to 0, drawing every dot on
one straight line. Fix in [`body_alignment.ts`](../app/server/db/analytics/body_alignment.ts):
shift `B → B + σI` (σ = Gershgorin max-abs-row-sum) so it's PSD, extract the two
**most-positive** eigenvalues, subtract σ back.

## Unbalanced source rich-text HTML → SSR hydration mismatch (React #418)

OpenParlData rich-text fields (`texts.text`, speech transcripts, group
descriptions) can be **malformed** — e.g. a `<p` that lost its `<` (renders as
literal `p>` text) followed by a run of stray `</div>`/`</li>`/`</ul>` closers
with no matching open. `xss` (js-xss) whitelists those tags and filters
tag-by-tag **without pairing them**, so the orphan closers survive sanitization.

Why it only breaks in SSR: injected as client-side `innerHTML` the string is
parsed as a **fragment**, where orphan end tags are silently ignored and stay
contained. But the SSR string is concatenated into the **full document**, so the
full-document parser lets a stray `</div>`/`</main>`/`</article>` close the
`opd-richtext` container's *ancestors* and reparent the rest of the page. The
server DOM then differs from what React re-renders on the client → a thrown,
uncaught hydration mismatch (**#418**, "…server rendered HTML didn't match…").
Seen on `/affairs/176287` (affair text closed `</main></article>`, tearing open
the page's main wrapper). `suppressHydrationWarning` does **not** help — the
mismatch is in the *surrounding* tree, not inside the injected div.

Fix in [`sanitize.ts`](../app/lib/security/sanitize.ts): a `balanceTags` pass
runs after `xss` — it drops orphan closing tags and auto-closes any still-open
elements, so the fragment is a well-formed tree that stays contained in **both**
parsing contexts. No-op for well-formed input; dependency-free and eval-free
(keeps the bundle CSP-safe — see [[csp-strict-no-unsafe-eval]]). Rule of thumb:
anything rendered via `dangerouslySetInnerHTML` from source data must go through
`sanitize()` (which now guarantees balance) — never hand a raw/`xss`-only string
to SSR.
