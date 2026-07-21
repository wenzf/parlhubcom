# Localization — adding languages & keeping meta files in sync

Two related asset trees:

- `public/locales/<lang>/<namespace>.json` — the **runtime** UI strings the app loads
  (`getStaticData`, looked up with `t()`). See [conventions.md](conventions.md) for the three
  language axes (UI / content / export) and how namespaces are wired to routes.
- `/localization/<namespace>.meta.json` — **translation source material**, NOT loaded by the app.
  For every key it records `context` (where the string renders, its UI role, placeholders, length
  and grammar constraints, Swiss/Liechtenstein parliamentary domain notes) plus the current de/en/fr
  texts as reference (a few namespaces also carry it/es). See [/localization/README.md](../localization/README.md) for the full format.

## Adding a new language

1. For each namespace, feed the matching `/localization/<namespace>.meta.json` (context + existing
   translations) to a translator or LLM.
2. Have it emit `{ key: translated_text }` only; unflatten the dotted paths back into the nested
   shape and save as `public/locales/<new-lang>/<namespace>.json`.
3. Wire the language into the app: the `lang_code` union in [`types/site.ts`](../types/site.ts)
   (omitting it fails `tsc`), `SITE_LANGS`, `app/configs/content_langs.config.ts`, and the
   `LANGS` array in [`.agents/verify-loc-metas.ts`](../.agents/verify-loc-metas.ts) (so the new
   language's `"metas"` blocks are checked too). SEO meta-tag copy is **not** inline in
   `app/lib/seo/metas/` any more — it lives in the `"metas"` block of the locale namespaces
   (entity pages → `loc_data_dashboard`, incl. the bulk-export `Dataset` JSON-LD description
   `dataset.desc`/`dataset.descNoScope`; one-offs → their own / `loc_main`), so it comes along in
   step 2 like every other namespace. `npm run verify:metas` then flags any `"metas"` key missing
   in the new language (the guard that replaced the old `Record<MetaLang, …>` compile check). A
   few small non-`"metas"` maps are still typed `Record<MetaLang, …>` and surface a missing
   language as a **compile error** — `OG_LOCALE` ([`metas/core.ts`](../app/lib/seo/metas/core.ts))
   and the 404/error copy ([`blocks/not-found.tsx`](../app/components/blocks/not-found.tsx)); `tsc`
   lists what's owed. Keep tokens (`{name}`/`{ctx}`/`{count}`/`{q}`/`{site}`/`{label}`/`{scope}`)
   verbatim when translating.

Glossary that recurs everywhere: *Fraktion* = parliamentary group, *Geschäft* (affair) =
legislative business item, *Gremium* (body) = council/committee, *Traktandum* = agenda item,
*Interessenbindung* = declared lobbying interest. Swiss High German uses «ss», never «ß».

## Keeping `/localization` in sync (IMPORTANT)

The meta files are only useful if they mirror the runtime locales. **Whenever a component introduces,
renames, or removes a localized text** — i.e. any change to `public/locales/**` — update the
corresponding `/localization/<namespace>.meta.json` in the same change:

- **New key** → add its entry with a real `context` (where it renders + role + any placeholders)
  and the de/en/fr texts.
- **Changed text** → update the mirrored de/en/fr value (and `context` if the usage changed).
- **Removed/renamed key** → drop or rename the meta entry.

Keep key order and the de/en/fr values byte-identical to the locale files. A meta entry whose usage
site cannot be found should say so (`"context": "Not found in code …"`) rather than invent a
reference — and is a hint the key may be dead and removable from `public/locales` too.
