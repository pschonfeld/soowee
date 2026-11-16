---
name: web-guidelines
description: Review soowee's UI code (Astro components, CSS, client scripts) against a pinned, Astro-adapted copy of the Web Interface Guidelines — accessibility, focus, motion, typography, images, touch, theming, copy. Use when asked to "review the UI", "audit the page", "check against web guidelines", "check a11y/UX details" or before finishing a UI change.
argument-hint: <file-or-pattern>
---

# Web Interface Guidelines (soowee)

Adapted from [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) `command.md` at commit `4ecfb9fb8d1d3b7009674869b3aaee2f904042e1` (2026-10-05), MIT licence, © Vercel.
This is a **pinned local copy**: never fetch the upstream file at runtime. To update, diff upstream by hand and edit this file.

Changes from upstream:
- Removed React/Next/Tailwind-only rules (hydration, controlled inputs, `<Link>`, `nuqs`, `useState`, `focus-visible:ring-*`, `priority` prop, `.map()` virtualization).
- Removed Locale & i18n (AGENTS.md decision 6: no i18n yet).
- Removed form rules for forms this static site doesn't have (submit spinners, unsaved-changes guards, error focus).
- Copy: **sentence case**, not Title Case (project convention and the Apple News+ reference, AGENTS.md decision 5).
- Added (not upstream): dialog focus handling, 44 px tap targets, `@media (hover: hover)`, design tokens, `srcset`/`sizes`, `text-wrap: pretty`, `enterkeyhint`, and recipe-specific examples.

## How to review

1. Files: use the argument; if none, review `src/components/`, `src/pages/`, `src/styles/`, `src/scripts/`.
2. Read `AGENTS.md`. Its decisions override these rules. If a rule conflicts with one, don't flag it.
3. Check each file against the rules below. Flag only real violations in the code, not hypothetical ones.
4. Output in the format at the end.

## Rules

### Accessibility
- Icon-only buttons need `aria-label`
- Form controls need `<label>` or `aria-label`
- `<button>` for actions, `<a>` for navigation, never `<div>`/`<span>` with click handlers
- Custom interactive widgets need keyboard support equivalent to the pointer path
- Images need `alt` (`alt=""` if decorative); decorative icons/SVGs need `aria-hidden="true"`
- Async updates (timers finishing, search result counts, toasts) need `aria-live="polite"`
- Semantic HTML before ARIA
- Headings hierarchical `<h1>`–`<h6>`; skip link to main content
- `scroll-margin-top` on heading anchors / anchor targets (sticky headers)

### Focus states
- Every interactive element has a visible focus style
- Never `outline: none` without a focus replacement
- `:focus-visible` over `:focus`
- `:focus-within` for compound controls
- Sticky headers/footers/overlays must not cover the focused element
- Overlays/dialogs (e.g. cook mode): focus moves in on open, is contained, and returns to the trigger on close; `Escape` closes

### Inputs
- Meaningful `name`; correct `type` and `inputmode`; `enterkeyhint` where useful
- Never block paste
- Labels clickable (`for` or wrapping the control)
- `spellcheck="false"` / `autocapitalize="none"` where text isn't prose (search, codes)
- Checkboxes/radios: label and control share one hit target
- Placeholders end with `…`

### Animation
- Honour `prefers-reduced-motion` (reduced variant or none)
- Animate `transform`/`opacity` only
- Never `transition: all`; list properties
- Correct `transform-origin`; SVG transforms on a `<g>` with `transform-box: fill-box`
- Animations interruptible
- Autoplaying motion > 5 s needs pause/stop/hide; decorative loops stop under reduced motion

### Typography
- `…` not `...`
- Curly quotes `“ ” ‘ ’` in visible text, not straight quotes
- Non-breaking space between number and unit: `25&nbsp;g`, `20&nbsp;min`
- Loading states end with `…`
- `font-variant-numeric: tabular-nums` where numbers line up or change in place (amounts, scaled quantities, timers)
- `text-wrap: balance` on headings, `text-wrap: pretty` on body text

### Content handling
- Text containers survive long content (long recipe titles, long ingredient names): `overflow-wrap`, `line-clamp`, truncation
- Flex/grid children need `min-width: 0` to allow truncation
- Empty states handled (no notes, no saved recipes, no search results), never a broken layout

### Images
- `<img>` has explicit `width` and `height` (or `aspect-ratio`) to prevent CLS
- Below the fold: `loading="lazy"`
- Above the fold (hero): `fetchpriority="high"`, not lazy
- Responsive `srcset`/`sizes` so phones don't download desktop images

### Performance
- Long lists: `content-visibility: auto` where it helps
- No layout reads in hot paths (`getBoundingClientRect`, `offsetHeight`, `scrollTop`); batch reads before writes
- `<link rel="preconnect">` for external asset domains
- Critical fonts: `<link rel="preload" as="font">`, `font-display: swap`
- Prefer `<video autoplay muted loop playsinline>` over animated GIF

### Navigation & state
- URL reflects shareable state (search query, filters) where it's useful to share or reload
- Links are real `<a>` (Cmd/Ctrl-click, middle-click work)
- Destructive actions (e.g. clearing saved recipes) need confirmation or undo

### Touch & interaction
- `touch-action: manipulation` on tap targets
- `-webkit-tap-highlight-color` set intentionally
- `overscroll-behavior: contain` in modals, sheets, cook mode
- Gesture-only actions (swipe between steps) need tap/click and keyboard alternatives
- Tap targets at least 44×44 px
- `autofocus` only with clear justification; avoid on mobile

### Safe areas & layout
- Full-bleed layouts and fixed bars use `env(safe-area-inset-*)`
- No unwanted horizontal scroll; fix overflow at the source
- Layout with flex/grid, not JS measurement

### Theming
- `color-scheme` set for light and dark so scrollbars and controls match
- `<meta name="theme-color">` matches the page background in both themes
- Colours come from tokens in `src/styles/global.css`, not hard-coded values
- Native `<select>`: explicit `background-color` and `color`

### Hover & interactive states
- Links/buttons have hover feedback, gated by `@media (hover: hover)` so it doesn't stick on touch
- Hover/active/focus states read more clearly than rest

### Copy
- Sentence case for headings, buttons and labels (“All recipes”, “Scale recipe”)
- Active voice; second person; no first person
- Numerals for counts
- Specific button labels, not “Continue” / “OK”
- Error and empty-state messages say what to do next

### Anti-patterns (always flag)
- `user-scalable=no` or `maximum-scale=1`
- `onpaste` with `preventDefault`
- `transition: all`
- `outline: none` without a focus replacement
- `<div>`/`<span>` with click handlers
- Images without dimensions
- Form inputs without labels
- Icon buttons without `aria-label`
- Gesture-only actions
- Animated GIFs

## Output format

Group by file. `file:line` (clickable). Terse: issue → fix. No preamble. Explain only when the fix isn't obvious.

```text
## src/components/Recipe.astro

src/components/Recipe.astro:42 - icon button missing aria-label
src/components/Recipe.astro:88 - "..." → "…"

## src/styles/recipe.css

src/styles/recipe.css:120 - transition: all → list properties

## src/scripts/theme.ts

✓ pass
```
