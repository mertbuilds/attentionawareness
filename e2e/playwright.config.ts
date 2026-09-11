import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 3020;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  forbidOnly: !!process.env.CI,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: '.',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  // The site is static and client-only: the web app is the whole stack.
  webServer: [
    {
      command: `pnpm exec vite dev --port ${WEB_PORT}`,
      cwd: '../apps/web',
      reuseExistingServer: !process.env.CI,
      url: WEB_URL,
    },
  ],
});
