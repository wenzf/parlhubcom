# How to work

- All UI must meet WCAG 2.2 level AAA: text/UI contrast ≥7:1 (≥4.5:1 for large text), interactive target size ≥44×44px, visible focus indicators, and keyboard operability.
- Follow docs/styleguide.md for design tokens, type scale, and component recipes — it is the source of truth for the monochrome AAA style; keep it in sync when changing tokens in app/app.css.
- Localization: see [docs/localize.md](../docs/localize.md) for how new languages are added. If a component introduces, changes, or removes localized texts (`public/locales/**`), update the mirrored `/localization/*.meta.json` files in the same change.

## Dev server (`npm run dev`)

- **One owner:** only the main session launches the app. Never have a subagent
  boot the dev server — it stacks duplicate processes.
- **Reuse, don't restart:** before `npm run dev`, check whether one is already up
  (`curl -s localhost:5555`); if it answers, use it. The port is pinned with
  `strictPort` (vite.config.ts), so a second start now fails loudly ("port in
  use") — reuse the running server or kill it first, don't work around it.
- **Match verification to task size:** trivial UI/config edits stop at typecheck;
  don't boot the server to "prove" a change. The app opens `data.duckdb`
  READ-ONLY, so it's launch clutter — not data risk — that concurrency creates.
