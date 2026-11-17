# soowee

A personal cookbook, shared with friends and family by link. It may go public later, so don't block growth, but build only for today.

Priorities, in order: **design, performance, UX, consistency**. Every recipe has the same shape so readers learn the page once and find their way around without thinking.

## Commands

- `pnpm test`: unit tests, build, then Playwright on WebKit and Chromium. It also writes screenshots to `screenshots/<device>/`.
- `pnpm typecheck`
- Dev server: run `astro dev --background`, then manage it with `astro dev stop | status | logs`.

This is Astro 7. When unsure about an API, check <https://docs.astro.build> rather than relying on memory.

## Decisions

Everything below is binding. If a task conflicts with any of it, stop and say so; never work around it silently.

1. **Static site, no backend.** No server, database or accounts. Everything is built at build time. *Why:* simplest thing that is fast and free to host. A backend may come later; it is not for an agent to start.
2. **Recipes are Markdown; the schema is the contract.** `src/content.config.ts` defines a recipe and [docs/recipe-model.md](docs/recipe-model.md) explains it. Invalid data fails the build. *Why:* consistency for the reader.
3. **Each fact is written once.** Only `time.total` is written by hand. Work time, hands-off time, waits and scaled amounts are derived from the step markup (`{simmer:20m}`, `{25 g}`). Never add a field that repeats derived data, such as a prep time. *Why:* the summary can never contradict the method.
4. **No UI framework.** Plain Astro components. Client JS is `src/scripts/recipe.ts` (recipe page), `src/scripts/home.ts` (home page search, Saved badge and the logo's eyes following the mouse) and `src/scripts/theme.ts` (the footer appearance switch), plus a tiny inline theme script that prevents a flash of the wrong theme. *Why:* performance and simplicity.
5. **Design follows Apple News+ Food's recipe view.** Aim for an iOS-native feel and high, consistent quality. Where the owner hasn't specified something, follow that reference: screenshots are in [docs/design-reference/](docs/design-reference/). The owner's explicit instructions override it. Use our own assets and design tokens (`src/styles/global.css`), never Apple's. *Revisit before going public:* copying another product's look closely is fine for a personal site, riskier for a public one.
6. **English now, Czech later.** Don't build i18n yet.

## Rules

- **Don't build ahead.** Besides what the decisions above rule out, no unrequested features. The home page grows in place, one zone at a time, when there is content for it; [docs/home-page-plan.md](docs/home-page-plan.md) has the order (a Saved row first, then cuisine filters).
- **Don't edit recipe content** (`src/content/recipes/`) unless asked. It is curated by hand.
- **Schema changes travel together:** schema, [docs/recipe-model.md](docs/recipe-model.md) and every affected recipe change in the same commit. `src/lib/docs.test.ts` enforces part of this.
- Before writing or editing a recipe, read [docs/recipe-model.md](docs/recipe-model.md), including its writing conventions.
- **Buttons come from one system:** `.btn` + one shape + one surface, and `.segmented` for a choice between options. The spec is the Buttons section of `src/styles/global.css`; read it before adding or restyling a control. Components set layout only, never a button's surface, radius, size or states. A new kind of button extends that section. `tests/buttons.spec.ts` enforces the classes and the 44px hit area.
