# Home page: final plan

Status: **implemented, then revised.** Reached through two drafts, an independent design review, and a clickable mockup (`mockup/`, a throwaway). Revised after the owner reviewed the built page (see "Revision 2" below; it overrides the sections after it where they differ).

## Revision 2: square photos on phones, editorial cards on wide screens, glass search

- **Phones: rows with a square photo** (104px), top-aligned beside the text: cuisine, title, time, description cut at 2 lines.
- **iPad and desktop: editorial cards.** A large 4:3 photo with the same cuisine, title, time and 2-line description under it, two columns from 48rem, three from 64rem. Same content in the same order as the phone rows, just stacked. Photo tiles alone made choosing by photo only, and two columns of rows read as dated; the cards keep the photo large and the decision information visible. Cards are separated by space, not lines; on hover the photo lifts 2px.
- **Separators (phones) start where the text starts**, as in iOS lists, drawn as 0.5px hairlines; the first visible row has none, also while searching.
- **Search is a glass capsule** (Liquid Glass): fully rounded, translucent fill (`--bar-fill`) with backdrop blur, and the same three edge layers as the recipe's glass buttons (light top rim, 0.5px inner hairline, soft lift). It sits under the wordmark and **scrolls away with it**, as iOS search fields do by default (`hidesSearchBarWhenScrolling`); a sticky capsule was tried and dropped because it covered the descriptions being read, on a page short enough to scroll back up (on iPhone, tap the status bar). On iPad and desktop it sits at the top right, beside the wordmark. With Reduce Transparency, or without backdrop-filter support, it turns solid (`--card`).
- **Crisper photos:** a 0.5px inner hairline (`--image-edge`) keeps white plates from melting into the page. Continuous (squircle) corners are used where the browser supports `corner-shape`.
- **Press response:** rows and the featured card give slightly under the finger (scale 0.98).
- **No photo credits on the home page.** Unsplash photos need none. Fish & Chips (CC BY-SA 4.0) is credited in the footer of its recipe page, which its row links to; the license allows attribution "in any reasonable manner", including a link to where the credit is.
- **Clear button:** the browser's own clear control is hidden and replaced by an iOS-style one (filled grey circle, thin cross) on a 44px target. It shows only while there's text.
- **Top spacing on phones:** wordmark, 16px, capsule, 20px, featured card.
- **Featured card uses the recipe hero's background extension:** the photo continues as a mirrored, blurred copy of itself under the text (`backdropFor()`), darkened by the per-photo scrim that keeps every text style at WCAG AA. Same look as the hero, instead of a flat tint.
- **Back button is real glass:** the same blur, light rim and shadow as Cook / Save / Share, tinted `rgb(0 0 0 / 0.34)` so the icon keeps about 3.6:1 on the palest photo.
- **One glass language:** `--glass-edge` / `--glass-shadow` (recipe hero buttons, back button, cook mode) and the home search capsule share the same three layers: light top rim, 0.5px inner hairline, soft lift. Cook / Save / Share are capsules, like the search.
- **Featured card fade:** the photo melts into its blurred mirror with the recipe hero's eased curve over a long run (phones: from 40% of the photo to 1rem above its edge; wide screens: over the first 40% of the photo box), instead of a short linear fade.
- **Testing note:** headless Playwright screenshots never draw backdrop blur (measured in both WebKit and Chromium), so glass looks see-through in `screenshots/`. Real devices blur.
- New tokens in `global.css`: `--image-edge` and `--bar-fill`, each with light and dark values.

Replaces today's redirect from `/` to the featured recipe.

## 1. Goal

Most people arrive on a recipe from a shared link. The home page answers "what else is here?" on one screen, and gets them into a recipe with one tap.

**Reader:** an ambitious home cook, phone first, then iPad and desktop.

**Quality bar:**
- Lighthouse 100 in all four categories on the mobile profile.
- WCAG 2.2 AA (axe, light and dark).
- No layout shift (CLS 0).
- Everything except search works without JavaScript.

## 2. Structure

```
/            Home: search, featured recipe, all recipes
/<slug>/     Recipe (URL unchanged; gains a back button)
```

There's no separate catalog page. The home page is made of zones, and each zone shows only when it has content:

| Zone | Shows when | Who decides |
|---|---|---|
| Search | Always (hidden only when scripting is off) | Owner request |
| Featured | A recipe has `featured: true` | The owner, in Markdown |
| All recipes | Always | The recipe files |

**Growth path (not built now), in this order:**
1. Saved row.
2. Cuisine chips at about 15+ recipes, filtering in place.
3. Rows by cuisine or course at about 30+, with `/?cuisine=…` on the same page.

"Popular" needs a backend, so it's out of scope.

## 3. Layout

### Phone (< 48rem)

```
┌─────────────────────────────────────┐
│ soowee                              │ h1: wordmark (accessible name "soowee"), 22px tall
│ ┌─────────────────────────────────┐ │
│ │ ⌕  Search recipes            ⊗  │ │ 44px, grey fill, radius 12, native clear button
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │ FEATURED: the recipe hero in miniature
│ │           photo 4:3             │ │ the photo fades fully into the photo's tint
│ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │ before any text; text sits only on the tint
│ │ Italian                         │ │ (tintFor already guarantees AA)
│ │ Lasagna                         │ │ title1 bold
│ │ 4 hr 30 min │ 8–10 servings     │ │ the same two facts as the recipe hero: Time and Yield;
│ │ (+ 8 hr chilling)               │ │ a wait, if any, on its own line under the time
│ └─────────────────────────────────┘ │ no description on phones
│                                     │
│ All recipes                         │ h2 title2 bold; result count on the right while searching
│ ┌────────┐ Italian                  │ ONE COLUMN LIST
│ │        │ Bolognese Sauce          │ photo 104px wide, as tall as the text beside it
│ │ photo  │ 4 hr 15 min              │ (at least square); nothing sits under the photo
│ │        │ A long-simmered beef,    │ cuisine: footnote 600, secondary
│ │        │ pork and veal ragù, rich │ title: body 600; time: footnote, secondary
│ └────────┘ with tomato and…         │ description: subhead, secondary, cut at 3 lines
│─────────────────────────────────────│ separator, as in iOS lists
│ ┌────────┐ French                   │
│ │ photo  │ Crêpes                   │ the whole row is one link
│ │        │ 50 min + 1 hr resting    │ time + wait on one line; the wait never breaks mid-phrase
│     …                               │
├─────────────────────────────────────┤
│ soowee   Photos: … ; Unsplash       │ shared footer + Light / Dark / Auto
└─────────────────────────────────────┘
```

**Why a list on phones:**
- A cook chooses by time and effort as much as by the photo, and the description carries exactly that.
- One column is a single straight line for the eye and thumb to follow.
- The featured recipe stays the only large photo, so the page has one clear focal point.
- The list stays easy to scan as the collection grows.

**Measured in the mockup:** rows are 166–189px tall at 320px wide. On an iPhone 15 in Safari (393 × 659 visible), the first row starts above the fold.

### iPad and desktop (≥ 48rem)

```
┌──────────────────────────────────────────────────────────────────────┐
│ soowee                                       ┌────────────────────┐  │
│                                              │ ⌕ Search recipes   │  │
│ ┌───────────────────────────┬──────────────────────────────────────┐ │ FEATURED: text on tint
│ │ Italian                   │                                      │ │ left (5fr), photo right
│ │ Lasagna                   │              photo                   │ │ (7fr), fading in only at
│ │ 4 hr 30 min │ 8–10 serv.  │                                      │ │ its left edge; with the
│ │ description               │                                      │ │ description
│ └───────────────────────────┴──────────────────────────────────────┘ │
│ All recipes                                                          │
│ [photo] [photo] [photo] [photo]   GRID: 3 columns ≥48rem, 4 ≥64rem   │
│ Title   Title   Title   Title     square photo, title, time (+ wait)  │
│ time    time    time    time      (cuisine, yield, description hidden)│
└──────────────────────────────────────────────────────────────────────┘
max width 74rem (same as the recipe page)
```

Wide screens have room for many photos at once, so the grid leads with photos.

### Recipe page: way home

```
┌─────────────────────────────────────┐
│ (‹)                                 │ 48px circle (.round, --tap), --glass-dark fill,
│            hero photo               │ top-left inside the safe area; scrolls with the hero
```

The button is a plain `<a href="/" aria-label="All recipes">`, with no `history.back()`.
- It behaves the same every time and works for visitors who arrived from a shared link.
- Swiping back in Safari already restores the home page's scroll position.

## 4. Behaviour

**Order.** "All recipes" is alphabetical (`localeCompare(…, 'en')`).

**Time.** The home page says exactly what each recipe's hero says. Both use `heroTime(r.time.total, directionTimes(r.directions))` from `src/lib/time.ts`, so nothing is computed twice and the two can never disagree (AGENTS.md decision 3).
- **Featured card:** Time and Yield, as in the hero, with any wait on its own line under the time.
- **List rows and grid tiles:** the time plus any wait on one line, such as "50 min + 1 hr resting". The wait wraps only as a whole phrase.
- **Rows and tiles leave out yield.** With a wait, time and yield don't fit one line at 320px. The time is what helps someone choose, and yield is on the recipe page.

**Featured.**
- At most one recipe. `index.astro` fails the build if two are featured.
- **A recipe never shows twice.** The featured recipe is in the "All recipes" markup, but hidden until a search matches it; while searching, the card above hides and the recipe shows as a result instead. Revised by the owner: an earlier version showed it in both places to keep the list complete.
- With no featured recipe, the zone isn't rendered and the first two list photos load eagerly.

**Search.**
- Markup: `<search>` containing a visually hidden label "Search recipes" and `<input type="search">`.
  - Attributes: `enterkeyhint="search"`, `autocomplete="off"`, `autocapitalize="none"`, `spellcheck="false"`.
  - Text is 17px (no iOS zoom on focus); the focus ring is 2px.
- **What it searches:** the title, cuisine and ingredient names, normalized at build time into `data-search` on each item.
- **How it matches:** the start of words, every word typed must match, and accents are ignored. "masc" finds Tiramisu, "crepes" finds Crêpes, and "oil" doesn't match "boil".
- Filtering toggles `hidden` on the list items. There's no re-render, fetch or index file.
- The featured card hides while there's a query.
- **Keys:** Enter blurs the field (closes the phone keyboard), and Escape clears it.
- **Result count:** a `role="status"` element, debounced 300 ms, shows "3 recipes" next to the heading. With no results it's for screen readers only, and the visible message reads `No recipes match "pho".` with a `Clear search` button that clears the field and puts the cursor back in it.
- **Without scripting:** `@media (scripting: none)` hides the search field, with no layout shift.
- **Restored pages:** on load and on `pageshow`, the script re-applies whatever is already in the field (form restore after going back, and bfcache).

**Saved badge.**
- On load and on `pageshow`, the script reads `localStorage['soowee:saved']` (written by the existing Save button).
- It shows a small bookmark icon after the meta line, with the visually hidden text "Saved". It's inline, so there's no layout shift.

**Credits.** None on the home page (Revision 2). Each recipe page's footer credits its photo, and every row links there.

**Head.**
- Title "soowee", with the meta description taken from a site-level constant.
- `theme-color` in light and dark versions matching `--bg`.
- The OG image is the featured photo.
- canonical and og:url are added only when `site` is set.

## 5. Visual rules

- Uses only the existing tokens: system font, the iOS type scale, `--bg`, `--card`, `--separator`, `--text-secondary`, the 14/12 radii and the 4pt grid. No new colours.
- **One bold element, the featured card.** Everything else stays quiet: no borders on images, no shadows, no entrance animations, no page transitions.
- **Feedback:** `:active` opacity on touch. On `(hover: hover)` devices, a +6% photo brightness change only, turned off under reduced motion.
- **Safe areas:** gutters use `max(var(--gutter), env(safe-area-inset-*))`.
- **Description cut-off:** `-webkit-line-clamp: 3`, supported in every current browser. The full text is on the recipe page.

## 6. Files

| File | Change |
|---|---|
| `src/components/Page.astro` | NEW shell: `<html>`, head (meta, theme script, icons, OG, `theme-color`), skip link, footer (wordmark, credits, theme switch). Props: title, description, OG data, body style, theme colours, credits. |
| `src/components/Recipe.astro` | Uses Page.astro. Adds the back link in the hero. |
| `src/components/Featured.astro` | NEW. Uses `tintFor`, `heroTime`, `directionTimes` and `formatYield`. |
| `src/components/RecipeItem.astro` | NEW. One `<a>` containing the photo (`alt=""`, since the title is next to it) and a text block: cuisine, title, meta (time and wait from `heroTime`, badge slot) and description. CSS switches it between list row and grid tile. |
| `src/pages/index.astro` | Replaces the redirect. |
| `src/scripts/home.ts` | NEW, about 1 kB: search and Saved badge |
| `src/scripts/theme.ts` | NEW: the footer theme switch, moved unchanged from `recipe.ts`. `recipe.ts` assumes an `article`, so it can't run on the home page. |
| `src/lib/search.ts` + `search.test.ts` | NEW: `normalize()`, `words()`, `matches()`, shared by the build and the browser |
| `src/styles/global.css` | Keeps tokens, base styles, glass, `.round` and the footer |
| `src/styles/recipe.css` | NEW: recipe-only rules moved out of global.css, imported by Recipe.astro |
| `src/styles/home.css` | NEW |
| `tests/home.spec.ts` | NEW |
| `tests/recipe.spec.ts` | Back link test |
| `AGENTS.md` | Decision 4: client JS is `recipe.ts`, `home.ts`, `theme.ts` plus the inline theme script. "Don't build ahead": drop "no search" and the "next planned feature" line. |
| `docs/recipe-model.md` | `featured` now means "shown large on the home page; at most one recipe". The description is shown on the home page cut to 3 lines, so lead with what helps someone choose. |
| `docs/design-reference/README.md` | Note the phone list vs the reference's grid, as an owner decision |

No schema change and no recipe edits.

## 7. Performance

- **Largest paint (LCP)** is the featured photo: `<Picture>` in AVIF and WebP, eager, `fetchpriority="high"`, `sizes="(min-width: 48rem) 58vw, 100vw"`.
- **List and grid photos:**
  - Lazy, `decoding="async"`, AVIF and WebP.
  - `sizes="(min-width: 64rem) 14rem, (min-width: 48rem) 12.5rem, 10rem"`, widths 160–640. This is the width the photo is drawn at, not the box width: the ~1.5:1 photo covers a square box, so it's drawn about 1.5× wider than the box.
  - A fixed box with the tint as background while loading, so there's no shift.
- **CSS** is inlined (already configured) and split per page, so the home page doesn't carry the recipe rules.
- **JS:** about 1 kB plus the theme switch. No framework, prefetch or fonts.

## 8. Implementation order

1. `Page.astro` shell + `theme.ts`, and refactor Recipe.astro onto them. Existing tests must stay green.
2. CSS split (`recipe.css`). Existing screenshots must look unchanged.
3. `search.ts` + unit tests.
4. `Featured`, `RecipeItem`, `index.astro`, `home.css`.
5. `home.ts`.
6. Back link on the recipe page.
7. Tests: `home.spec.ts` and the recipe back-link test.
8. Docs: AGENTS.md, recipe-model.md, design-reference README.
9. Verify:
   - `pnpm typecheck`, `pnpm test` (all 5 devices, axe light and dark, screenshots).
   - A mobile Lighthouse run on the production build.
   - A fresh-subagent review of the diff.
   - Delete `mockup/` and `.claude/launch.json`.

## 9. Tests

- **Unit:** `normalize` (accents, case), `matches` (word starts, several words, no match inside a word).
- **`home.spec.ts`:**
  - Every recipe appears once in the list and links to its page.
  - Each item's time matches its recipe hero (for example Crêpes "50 min" and "+ 1 hr resting"); the test compares the two pages rather than hard-coding values.
  - The featured recipe appears at the top and not in the list, until a search matches it.
  - Search filters correctly, ignores accents and handles several words.
  - The no-results message and Clear search work; Escape clears.
  - The filter is re-applied after going back.
  - The badge appears after saving on a recipe page.
  - Phones show a list (photo beside the text) and iPad/desktop show a grid.
  - No horizontal overflow.
  - axe passes in light and dark.
  - Screenshots `home-light`/`home-dark` and `home-search` on every device.
- **`recipe.spec.ts`:** the back link is named "All recipes" and goes to `/`.

## 10. Not now (each cut for a reason)

| Cut | Reason |
|---|---|
| Saved row | Not needed at 6 recipes; it's first in line later. |
| Photo morph between pages (view transition) | Its effect on the hero's fade is unproven. |
| Astro prefetch | A script on every page for about 100 ms on a tiny HTML file. |
| `history.back()` on the back link | Unpredictable. |
| JSON-LD ItemList | No search-engine goal and no `site` origin yet. |
| Web app manifest / offline | Needs offline and icon decisions first. |
| Separate short-description field | Would repeat the description. The 3-line cut-off is used instead. |
| Also not now | Chips, filters, sort, pagination, "Popular", accounts, search in the URL, prev/next between recipes, Czech. |

## 11. Decisions taken

1. AGENTS.md decision 4 changes to allow `home.ts` and `theme.ts`, and the "no search" rule is lifted. Approved by the owner.
2. A Saved badge in v1. Approved.
3. The featured card uses text on a solid tint, matching the recipe hero. Approved.
4. A one-column list on phones and a grid on iPad and desktop. Owner's decision after the mockup.
5. Photo as tall as the text beside it, with the description in the right column and nothing under the photo. Owner's decision.
