import { defineConfig } from '@playwright/test';

// The smoke spec launches its own persistent context with the unpacked build
// loaded, so there is no shared browser and no web server to start.
export default defineConfig({
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: './e2e',
});
