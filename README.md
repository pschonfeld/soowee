# soowee

A personal recipe collection. The MVP is one page: a single recipe template modelled on the recipe view of Apple News+ Food, rendered statically with Astro.

## Commands

| Command          | What it does                                                        |
| :--------------- | :------------------------------------------------------------------ |
| `pnpm dev`       | Dev server at `localhost:4321`                                      |
| `pnpm build`     | Production build into `dist/`                                       |
| `pnpm preview`   | Serve the production build                                          |
| `pnpm typecheck` | `tsc --noEmit` for the TypeScript modules                           |
| `pnpm test`      | Build, then Playwright (WebKit + Chromium; phone, tablet, desktop)  |

`pnpm test` also writes full-page screenshots to `screenshots/<device>/` for visual review.
First run needs the browsers: `pnpm exec playwright install chromium webkit`.

## Adding a recipe

1. Put the photo in `src/assets/recipes/`.
2. Add `src/content/recipes/<slug>.md`. It is served at `/<slug>/`; the recipe with `featured: true` is also the home page.

Structured data lives in the frontmatter (validated by `src/content.config.ts`, the build fails with a clear message when something is missing); free-form notes (tips, variations, allergens) go in the Markdown body.

```yaml
title: Lasagna
description: One or two sentences.
image: ../../assets/recipes/lasagna.jpg
imageAlt: What the photo shows
yield: { min: 6, max: 8, unit: servings }
time: { prep: 15, cook: 180, total: 195 } # minutes
ingredients:
  - group: For the meat sauce # optional
    items:
      - { qty: 500, unit: g, name: ground beef } # qty is what gets scaled
      - { name: "Salt and pepper, to taste" }
steps:
  - title: Prepare the meat sauce # optional
    text:
      - Add {25 g} **butter** and the **onion**. Cook for {timer:5-10m} until softened.
      - tip: A callout shown between paragraphs.
```

Inline markup in step text:

- `**bold**` – ingredient mentions.
- `{25 g}`, `{2 tbsp}`, `{1.5}` – the amount used at that point. It scales with the recipe, independently of the ingredient list, so one ingredient can be split across steps.
- `{wait:1h}` – a timer for hands-off time (simmering, baking). The page subtracts these from the total and shows the rest as active time.
- `{chill:6h}` – the minimum time in the fridge before serving (tiramisu, terrines). Plain text, not a timer, and not part of `time.total`: the page shows it separately ("plus 6 hr chilling"), because the dish is finished and only needs to set. Like `{wait:}`, it only counts in step text, not in `tip:` lines.
- `{timer:20m}`, `{timer:1h30m}`, `{timer:5-10m}` – a tappable timer. The label ("5–10 minutes") is generated, so durations read the same everywhere; write the sentence around it ("bake for {timer:10m} more"). A range rings at its lower bound, when it is time to start checking.

A step may also have `heat: Preheat your oven to **180 °C**.` – shown first and highlighted, so the oven or oil is on before it is needed.

Ingredients: `name` is what you shop for (`onion`, `butter`, `extra virgin olive oil`); size, cut or kind go in `note` (`medium, diced into small cubes`) and are shown after the name in a lighter tone. For things counted in pieces, `about: { qty: 150, unit: g }` adds an approximate weight ("1 onion (about 150 g)") that scales with the recipe, which a note would not.

Optional fields: `cuisine`, `byline`, `source`, `imageCredit`, `equipment`, `tint` (hero colour override; by default it is derived from the photo).

## Structure

- `src/components/Recipe.astro` – the page template (hero, ingredients, directions, cook mode)
- `src/styles/global.css` – design tokens and all styles
- `src/scripts/recipe.ts` – the only client JavaScript: scaling, save, share, timers, cook mode
- `src/lib/` – quantity/time formatting, inline step markup, photo-derived tint
