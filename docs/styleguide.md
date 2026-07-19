# parlhub Style Guide — WCAG 2.2 AAA, monochrome

**WCAG 2.2 AAA** is the standard every screen is designed to, not a tested result: the rules
below are the contract, and conformance itself is claimed only at
[`/project/accessibility`](../app/routes/pages/project/accessibility/accessibility.tsx)
("partially conforms", self-assessed). The aesthetic is **calm and monochrome**: quiet type,
subtle borders, generous space, 44px targets. Visual weight stays low, nothing shouts.

Tokens: [`app/app.css`](../app/app.css). Recipes: [`app/components/ui/`](../app/components/ui/).
Reference implementations — grouped list: the header **Settings** menu
([`blocks/header/index.tsx`](../app/components/blocks/header/index.tsx)); filter bar:
**DimensionControls** ([`controls/DimensionControls.tsx`](../app/components/opd_views/controls/DimensionControls.tsx)).

---

## 1. Principles

- **AAA is a floor** — never trade accessibility for looks.
- **Monochrome** — no brand accent; hierarchy from weight/size/space/surface. Color is only
  for *data* (charts, votes) and *state* (destructive).
- **Quiet** — body 350, headings 550 (never bold). Prefer `ghost`/`outline`; one solid action per view.
- **Space is the main tool** — consistent rhythm reads as "designed."

---

## 2. Accessibility (non-negotiable)

| Concern | Rule (AAA) | SC |
| --- | --- | --- |
| Text contrast | **≥ 7:1** (≥ 4.5:1 for ≥ 24px / ≥ 19px-bold) | 1.4.6 |
| UI / boundary contrast | **≥ 3:1** for anything identifying a control (field border, ring, meaningful icon) | 1.4.11 |
| Target size | **44 × 44px for EVERY control**, no exceptions beyond literal 2.5.5 carve-outs: checkbox/switch **glyph** ~20px *iff* hit area expanded to 44px via `::after`; **inline** prose links; native controls | 2.5.5 |
| Focus visible | Ring on every focusable element, ≥ 3:1 | 2.4.7 / 2.4.13 |
| Not color alone | Links **underline** | 1.4.1 |
| Keyboard | Everything operable, visible focus order | 2.1.1 |
| Motion | Respect `prefers-reduced-motion` (neutralized in [`base.css`](../app/css/base.css)) | 2.3.3 |

**Focus ring** (verbatim on new controls):
`outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
Against a clipping frame (edge of an `overflow-hidden` card) swap to
`focus-visible:ring-inset focus-visible:ring-offset-0`.

**Cursor.** Pointer on every clickable control, restored globally in [`app.css`](../app/app.css)
(`button/[role=button]:not(:disabled)`) — Tailwind v4 defaults buttons to the arrow. Don't
re-add per component; disabled stays `not-allowed`, menu items stay `default`. (Not a WCAG rule.)

---

## 3. Color tokens

Neutral OKLCH. Edit only in `app/app.css`, keeping `:root`, `.dark`, and the
`@media (prefers-color-scheme: dark) .system {}` mirror in sync.

| Token | Light / Dark | Role |
| --- | --- | --- |
| `--foreground` | `0.145` / `0.985` | body, headings (~17:1) |
| `--muted-foreground` | `0.40` / `0.78` | secondary text, labels (≥ 7:1 everywhere) |
| `--background`·`--card`·`--popover` | | page / cards / overlays |
| `--muted`·`--secondary`·`--accent` | `0.97` / `0.269` | subtle fills, hover |
| `--primary` | `0.205` / `0.922` | the one solid action |
| `--input` | `0.58` / `0.55` | **field** borders (3:1) |
| `--ring` | `0.45` / `0.72` | focus ring (~7:1) |
| `--border` | `0.90` / `1 0 0 /12%` | decorative dividers only |

`border-input` on anything operable; `border`/`Separator` for decoration only — never delineate
a control with `--border`. Modes: `.contrast` pushes beyond AAA; `html.grayscale` desaturates all.

---

## 4. Typography

Inter Variable. Body 350; headings 550, `-0.01em`, `text-wrap: balance`, never `font-bold`.

| Class | Size | Use |
| --- | --- | --- |
| `text-xs` | 12px | dense meta (foreground/muted only) |
| `text-sm` | 14px | **default UI**: controls, menus, labels |
| `text-base` | 16px | prose |
| `text-lg`/`text-xl` | 18/20px | card / section titles |
| `text-2xl` | 24px | page titles (`font-semibold tracking-tight`) |

---

## 5. Spacing & radius

- Page: `p-4 pt-0`, `flex flex-col gap-4`. Fluid width, no max-width container.
- Radius `--radius: 0.625rem`: cards `rounded-lg`, panels `rounded-xl`, controls `rounded-md`.
  **Concentric** — child radius ≤ parent.
- 44px controls need air: `gap-2`/`gap-3`, roomy menu padding.

---

## 6. Alignment

- **One left gutter** — everything aligns to the container's padding; no arbitrary indents.
- **Label left, control right, shared right edge** — never let a narrow control float against
  the panel edge (ragged column = the main "unstyled" tell).
- **Even rhythm** — equal 44px rows, one gap per group, `items-center`.
- **Group with a label, divide with a line** — whitespace groups, a rule divides.
- **Two columns not three**; left-align text, right-align numbers with `tabular-nums`.

---

## 7. Control layouts — two patterns, no third

**A. Grouped list** (`ControlGroup`/`ControlRow`, [`ui/control-group.tsx`](../app/components/ui/control-group.tsx))
— default for settings and feature controls. Reference: the Settings menu.
- One inset card per group: `overflow-hidden rounded-lg border border-border bg-card`, rows
  `divide-y divide-border` (dividers, not whitespace).
- **Ghost controls inside** — the card is the boundary, so controls drop their box: Select →
  `ghostSelectTrigger`, date → `ghostDateField`, on/off → **Switch**, stepper → `ghost` buttons.
- **Trailing control bleeds to the frame** (`<ControlRow bleed>`): `pr-0` row + `rounded-r-none`
  control, clipped flush; edge controls use the inset ring (§2).
- Quiet section label above each card; rows stay 44px (hit area = row / `::after`).

**B. Filter bar** (`DimensionControls`) — horizontal row of standalone controls above a list.
- `rounded-lg border bg-muted/30 p-3`, `flex flex-wrap items-end gap-3`, each control capped by `Labeled`.
- **Bordered here** (`border-input`, `h-11`) — each stands alone, keeps its box (opposite of A);
  standard offset ring.

---

## 8. Component recipes

- **Buttons** ([`ui/button.tsx`](../app/components/ui/button.tsx)) — every size 44px (`sm`/`xs`/`icon-*`
  only trim padding). `default` (one primary) · `outline` · `ghost` · `secondary` · `destructive`.
- **Inputs / Select** — 44px, `border-input`, `text-sm` (ghost inside grouped lists, §7A).
- **Switch** — immediate on/off. **Checkbox** — selection/confirmation only; 20px in a `min-h-11` label.
- **Segmented** ([`ui/segmented.tsx`](../app/components/ui/segmented.tsx)) — single-select over named
  options (Log/Linear); Switch for boolean, Segmented when both are named.
- **Links** — underline on hover, `text-primary`, focus ring; never color-only (`INTERNAL_LINK_CLASS`).
- **Tables** — `text-sm`, muted headers, `border-border/50` rules, `tabular-nums`.
- **Cards / popovers** — `bg-card`/`bg-popover` + `ring-1 ring-foreground/10` + soft shadow; shadow for floating panels only.

---

## 9. References

Apple HIG Settings (grouped rows) · Vercel Web Interface Guidelines (border-first, concentric
radii) · Radix Colors (token scale) · W3C ARIA APG Switch · WCAG 2.2 (SC 1.4.6, 2.5.5, 2.4.13).
