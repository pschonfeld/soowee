// @ts-check
import { defineConfig } from 'astro/config';

/** @type {Record<string, string | undefined>} Read via globalThis: the project has no Node type definitions. */
const env = /** @type {any} */ (globalThis).process?.env ?? {};

export default defineConfig({
  // Production origin, e.g. SITE_URL=https://pschonfeld.github.io (set by .github/workflows/deploy.yml). Unset
  // means no canonical / og:url / og:image tags are emitted, rather than ones pointing at localhost.
  site: env.SITE_URL || undefined,
  // The path the site is served under: BASE_PATH=/soowee on GitHub Pages, the root locally and in tests.
  // Internal links go through sitePath() in src/lib/url.ts so they follow it.
  base: env.BASE_PATH || undefined,
  // One small stylesheet: inlining it removes the only render-blocking request.
  build: { inlineStylesheets: 'always' },
  // Czech at the root, English under /en/ (docs: AGENTS.md, decision 6). Keep in step with LOCALES in src/lib/i18n.ts.
  i18n: { locales: ['cs', 'en'], defaultLocale: 'cs', routing: { prefixDefaultLocale: false } },
});
