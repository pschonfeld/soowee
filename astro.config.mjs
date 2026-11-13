// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // One small stylesheet: inlining it removes the only render-blocking request.
  build: { inlineStylesheets: 'always' },
});
