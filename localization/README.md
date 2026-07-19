# localization/ — meta-localization files

One `<namespace>.meta.json` per namespace in `public/locales/<lang>/`. These files are **not
loaded by the app** — they are translation source material: for every UI text fragment they
record *where* it is used and *what it means*, so the namespaces can be translated into a new
language (by a human or an LLM) without guessing context.

## Format

```json
{
  "_meta": { "namespace", "loaded_by", "description", ... },
  "keys": {
    "<dotted.key.path>": {
      "context": "Where the string appears, its UI role (button / heading / tooltip / breadcrumb …), placeholders and their meaning, length or grammar constraints, domain notes.",
      "en": "…", "de": "…", "fr": "…"
    }
  }
}
```

- The dotted key path mirrors the nesting of the namespace JSON; key order matches the source
  files.
- `en`/`de`/`fr` are copied verbatim from `public/locales/` at generation time — they are a
  *reference*, the locale files stay the source of truth. `null` = key missing in that language.
- `context` starting with "Not found in code" marks keys with no usage site found (possibly
  unused, or reached via dynamic key composition — the entry says which).

## Adding a new language

1. Feed a meta file (context + existing translations) to the translator/LLM per namespace.
2. Have it emit only `{ key: translated_text }`, unflatten the dotted paths back into nested
   JSON, and save as `public/locales/<new-lang>/<namespace>.json`.
3. Wire the language into the app (`SITE_LANGS`, `content_langs.config.ts`, and the small
   per-language maps still typed `Record<MetaLang, …>` — `OG_LOCALE` in `metas/core.ts`,
   the 404/error copy in `blocks/not-found.tsx` — which surface a missing language as compile
   errors). SEO `"metas"` copy is no longer a `Record<MetaLang>` table: it lives in the locale
   namespaces and `npm run verify:metas` flags any language missing a key, in all languages
   (including the new one — add it to `LANGS` in `.agents/verify-loc-metas.ts`).

Domain glossary that recurs everywhere: *Fraktion* = parliamentary group, *Geschäft* (affair) =
legislative business item, *Gremium* (body) = council/committee, *Traktandum* = agenda item,
*Interessenbindung* = declared lobbying interest. Swiss High German uses «ss», never «ß».

## Keeping it fresh

Regenerate (or at least re-check) a namespace's meta file whenever its texts in
`public/locales/` change or consuming components move. Generated 2026-07-13 by code-verifying
every key's usage under `app/`.
