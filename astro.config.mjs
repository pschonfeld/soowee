// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Production origin, e.g. SITE_URL=https://soowee.example. Unset (hosting not decided yet) means no
  // canonical / og:url / og:image tags are emitted, rather than ones pointing at localhost.
  // (Read via globalThis: the project has no Node type definitions.)
  site: /** @type {any} */ (globalThis).process?.env?.SITE_URL || undefined,
  // One small stylesheet: inlining it removes the only render-blocking request.
  build: { inlineStylesheets: 'always' },
});
