# soowee

A personal recipe collection. The MVP is one page: a single recipe template modelled on the recipe view of Apple News+ Food, rendered statically with Astro.

## Commands

| Command          | What it does                                                        |
| :--------------- | :------------------------------------------------------------------ |
| `pnpm dev`       | Dev server at `localhost:4321`                                      |
| `pnpm build`     | Production build into `dist/`                                       |
| `pnpm preview`   | Serve the production build                                          |
| `pnpm typecheck` | `tsc --noEmit` for the TypeScript modules                           |
| `pnpm test`      | Unit tests, build, then Playwright (WebKit + Chromium; phone, tablet, desktop) |

`pnpm test` also writes full-page screenshots to `screenshots/<device>/` for visual review.
First run needs the browsers: `pnpm exec playwright install chromium webkit`.

## Adding a recipe

1. Put the photo in `src/assets/recipes/`.
2. Add `src/content/recipes/<slug>.md`. It is served at `/<slug>/`; the recipe with `featured: true` is also the home page.
3. Check it against **[the recipe model](docs/recipe-model.md)**: every field, what is required, the inline step markup (`{25 g}`, `{timer:}`, `{wait:}`, `{chill:}`), how time and scaling are derived, and the writing conventions. The build fails with a clear message when something required is missing or malformed.

## Structure

- `src/components/Recipe.astro` – the page template (hero, ingredients, directions, cook mode)
- `src/styles/global.css` – design tokens and all styles
- `src/scripts/recipe.ts` – the only client JavaScript: scaling, save, share, timers, cook mode
- `src/lib/` – quantity/time formatting, inline step markup, photo-derived tint
- `docs/recipe-model.md` – the recipe data model, kept in step with the schema by `src/lib/docs.test.ts`
