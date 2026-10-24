// playwright.nillion.config.mjs

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/nillion',
  testMatch: 'payouts.spec.mjs',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/nillion',
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});