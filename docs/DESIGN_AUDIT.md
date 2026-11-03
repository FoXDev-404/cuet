# Design audit (Phase 1)

**Date:** 2026-11-01
**Scope:** all public, account, test and admin surfaces of `cuet-astro`
**Method:** static inventory of `src/**/*.{astro,css,ts}` plus computed WCAG contrast ratios. No styles were changed before this document was written.

---

## 1. Current visual system

| Area | Current state | Verdict |
|---|---|---|
| Framework | Tailwind CSS v4 via `@tailwindcss/vite`, one `src/styles/global.css` (127 lines) | Good base, but no token layer. |
| Colour model | Tailwind palette classes (`bg-white`, `dark:bg-neutral-950`, `brand-*`, `accent-*`) with a `.dark` class variant | Two themes exist but the default is wrong and there are no semantic tokens. |
| Brand palette | Violet `#6d5dfc` (`brand-500`) with emerald accents `#10b981` (`accent-500`) | Does not match the required deep-blue primary + amber CTA. |
| Dark surfaces | `ink-950 #05060f`, `neutral-900 #0b0d1d` | Near-black; outside the requested slate system (`#0F172A`). |
| Fonts | `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif` | **Inter is never loaded.** No `@font-face`, no font CDN link, no woff2 files. Every page renders in the OS UI font. Poppins and Noto Sans Devanagari are absent although Hindi content is shipped. |
| Type scale | Ad-hoc Tailwind sizes (`text-[10px]` … `text-5xl`) | No shared scale; several fixed pixel sizes below 14 px. |
| Components | No shared Button/Input/Card/Chip/Dialog components. Every page repeats Tailwind class strings. | Inconsistent states; no single place to enforce 44 px targets or focus rings. |
| Icons | Inline SVGs per page | Fine for weight, duplicated markup. |
| Motion | One global `prefers-reduced-motion` rule that only disables smooth scrolling | Incomplete: transitions/animations are not reduced. |
| Print | No print stylesheet | Test/result pages print poorly. |
| Forced colours | No `forced-colors` rules; focus is mostly `box-shadow`/ring utilities | Focus may disappear in Windows High Contrast. |

---

## 2. Theme engine findings

| Requirement | Current behaviour | File |
|---|---|---|
| Modes | Only light/dark. No `system`. | `BaseLayout.astro`, `AdminLayout.astro` |
| Default | **Dark.** `<html class="dark">` is hard-coded and the script keeps dark when nothing is stored. | `BaseLayout.astro:86` |
| No-flash | Choosing **light** flashes dark first because the server always paints `.dark`; the script runs after the stylesheet. | `BaseLayout.astro:106-116` |
| Storage | `localStorage.theme` = `dark`/`light`, no `system` state, no `storage` listener. | `BaseLayout.astro:371-381` |
| Toggle | A 36×36 px icon-only button with `aria-label="Toggle dark mode"`; no `aria-pressed`, no visible text, below the 44 px target. | `BaseLayout.astro:149-162` |
| Cross-tab | Not synced. | — |
| `theme-color` | One static meta (`#05060f`), updated by JS to `#ffffff` in light. No media-scoped metas. | `BaseLayout.astro:92,113,377` |
| Admin layout | Uses a second script that *does* follow the OS when nothing is stored, so admin and public disagree on first visit. | `AdminLayout.astro:69-77` |
| Attempt screen | `/attempt/[id]` defines its own `<html lang="en">` with no theme script and no theme control. | `attempt/[id].astro:115` |
| Server rendering | Theme-agnostic (good), but the hard-coded class makes HTML theme-specific. | — |
| CSP | No CSP is set, so an inline no-flash script needs no nonce today. | `middleware.ts` |

---

## 3. Hard-coded colour values (colour-leak inventory)

Total: **90** raw colour matches in **8** files. `global.css` accounts for 51; components/pages for 39.

| File | Count | Examples | Action |
|---|---|---|---|
| `src/styles/global.css` | 51 | brand/accent/ink scales, `--page-bg`, hero gradients, selection | Move palette + gradients into `tokens.css`; keep only token references. |
| `src/components/QuestionForm.astro` | 10 | `#d4d4d4`, `#10b981`, `#a7f3d0`, `#404040`, `#0a0a0a`, `#f5f5f5`, `#064e3b`, `#e5e5e5`, `#262626`, `#171717` | Replace with `var(--border-input)`, `var(--focus)`, `var(--surface)`, `var(--ink)`. |
| `src/components/MockForm.astro` | 6 | same form palette | Same. |
| `src/layouts/BaseLayout.astro` | 4 | `#05060f`, `#ffffff`, `rgba(...)` | `var(--bg)` / `var(--surface)`; theme metas from tokens. |
| `src/pages/index.astro` | 3 | decorative `rgba(...)` gradients | Tokenise or move to a named utility class. |
| `src/pages/dashboard.astro` | 2 | `#059669` chart strokes | Read CSS variables at render time. |
| `src/components/BrandLogo.astro` | 1 | `rgba(109,93,252,0.45)` shadow | `var(--shadow-brand)`. |
| `src/pages/login.astro` | 1 | Google logo brand colours (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`) | Allow-list: third-party logo colours are not theme colours. |

**No stylelint or grep gate exists**, so new hex values can be added freely.

---

## 4. Contrast measurements (current tokens)

WCAG 2.2 AA: normal text ≥ 4.5:1, large text ≥ 3:1, UI boundaries/focus ≥ 3:1.

| Pair | Ratio | Result |
|---|---|---|
| `brand-500 #6d5dfc` on white | 4.54 | Passes by 0.04 — fragile. |
| `brand-600 #5a49e8` on white | 5.91 | Pass. |
| `brand-700 #4938c7` on white | 7.85 | Pass. |
| `accent-500 #10b981` on white | **2.54** | **FAIL** for text and for white text on an accent fill. |
| `accent-600 #047857` on white | 5.48 | Pass. |
| `neutral-500 #737373` on white | 4.74 | Pass, but used at 10–12 px. |
| `neutral-400 #a3a3a3` on `#05060f` | 8.01 | Pass. |
| `#f59e0b` on `#1f2937` (proposed CTA) | 6.83 | Pass. |
| `#15803d` on white (correct) | 5.02 | Pass. |
| White on `#05060f` | 20.20 | Pass. |

Additional risks found by inspection:

- `text-white/50` (8 uses) and `text-white/55` on the dark footer composite to roughly `#828287`; around 5:1 on `#05060f`, but they are used at 10 px uppercase, which is hard to read and will fail when the surface lightens.
- `border-white/10` and `border-white/15` are below the 3:1 UI-boundary requirement on dark surfaces.
- `bg-accent-500 text-white` (where used) fails at 2.54:1.
- Many focus states rely on Tailwind `ring`/`shadow`, not `outline`, so forced-colours mode can erase them.

---

## 5. Pages and states lacking dark or theme support

| Surface | Issue |
|---|---|
| `/attempt/[id]` | No `dark` class, no tokens, no toggle, fixed light palette. |
| Print (all) | No print styles; dark tokens would print as heavy backgrounds if added naively. |
| `/dev/styleguide` | Does not exist. |
| Admin dialogs/toasts | No shared dialog component, so no focus trap/return focus. |
| Error/loading states | Ad-hoc per page; no skeleton component. |
| Charts on `/dashboard` | Hard-coded hex strokes do not follow a theme change. |

All other 48 pages import `BaseLayout` (31) or `AdminLayout` (17), so they inherit whichever class the layout sets.

---

## 6. Layout, responsiveness and shift sources

- Containers use `max-w-6xl`/`max-w-7xl` and 16 px mobile padding — close to the 72 rem spec but inconsistent between public and admin.
- Tap targets: icon-only header buttons are `h-9 w-9` (36 px), below 44 px. Table row actions are ~26 px tall.
- `min-w-[760px]` tables rely on horizontal scroll (acceptable) but there is no sticky header.
- Images: OCR assets are served through `/media` with stored width/height in most cases; `LocalPaperCard` and solution images need an explicit `width`/`height` audit to guarantee CLS < 0.05.
- Ad slots: `AdSlot.astro` reserves space, but the ad script itself can shift layout on slow networks.
- Hero gradients are CSS backgrounds (no shift), but the hero's radial gradients are expensive to paint on low-end phones.

---

## 7. Component inconsistencies

| Component | Finding |
|---|---|
| Primary button | Three variants coexist: `bg-brand-600`, `bg-neutral-900`, `bg-accent-*`. Heights vary 32/36/40/44 px. |
| CTA | No single amber CTA; “Start test” is sometimes violet, sometimes dark neutral. |
| Inputs | Admin forms use inline CSS with a third palette; public forms use Tailwind borders. No shared error styling. |
| Chips | Four different pill recipes (`bg-brand-100`, `bg-amber-100`, `bg-neutral-200`, `bg-accent-100`). |
| Cards | `rounded-xl`, `rounded-2xl` and `rounded-3xl` mixed; shadows inconsistent. |
| Links in prose | Underline only on hover in some places, always in others. |
| Dialog/toast | Only `confirm()`/`alert()` in admin. |

---

## 8. What is already good (keep)

- Server-rendered HTML with no theme-dependent markup.
- Semantic landmarks on most public pages and a skip link.
- KaTeX is rendered to HTML; no client-side math bundle.
- Content-first hub pages with FAQ `<details>` and structured data.
- Existing axe suite (100 scans clean) and Playwright coverage give a safety net.
- No heavy animation library.

---

## 9. Migration plan (Phase 2+)

1. Create `src/styles/tokens.css` with the required three-block pattern: base light values, `@media (prefers-color-scheme: dark)` for `:not([data-theme="light"])`, and `:root[data-theme="dark"]` generated from the same source values.
2. Map Tailwind's `brand`, `accent`, `neutral`, `ink` scales to token variables via `@theme inline`; change brand to deep blue and accent to amber.
3. Add a block-form `dark` custom variant that honours both `[data-theme="dark"]` and the OS media query when `[data-theme="light"]` is absent, so existing `dark:` utilities follow System mode without JS.
4. Replace the hard-coded `<html class="dark">` with a no-flash inline script **before** the stylesheet that sets only `data-theme` from storage.
5. Build `ThemeToggle.astro` (System → Light → Dark), 44 px targets, visible text on desktop, `aria-pressed`, storage-event sync, theme-color meta updates.
6. Remove all raw colours outside `tokens.css`; add a grep test that fails the build (allow-list: `tokens.css` and the Google logo in `login.astro`).
7. Add token-parity, contrast-calculator and colour-leak tests; extend Playwright with no-flash/persistence/storage-blocked/JS-disabled cases.
8. Refactor shared components to tokens, add print + forced-colours rules, then apply to public pages, test flow, account and admin.

Target: deep blue `#1E40AF` / amber `#F59E0B`, slate surfaces `#F8FAFC` / `#0F172A`, WCAG 2.2 AA in both themes, no flash, no SEO markup changes.
