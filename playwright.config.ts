import { createHash } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// One port per checkout. With a fixed port, a git worktree's run would reuse a preview server still running from
// another checkout and silently test that checkout's build.
const PORT = 4400 + (createHash('sha256').update(import.meta.dirname).digest().readUInt16BE(0) % 500);

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}` },
  // Tests run against the production build (`pnpm test` builds first), the same thing Lighthouse measures.
  webServer: {
    command: `pnpm preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'ipad-webkit', use: { ...devices['iPad Pro 11 landscape'] } },
    { name: 'mac-webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
