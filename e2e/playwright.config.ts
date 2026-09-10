import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3021;
const WEB_PORT = 3020;
const EMULATE_PORT = 4000;

const API_URL = `http://localhost:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

// Requires the compose Postgres (host port 5433) to be running: `docker compose up -d`.
const DATABASE_URL =
  'postgresql://keepyourattention:keepyourattention@localhost:5433/keepyourattention';

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
  webServer: [
    {
      command: 'pnpm exec emulate --service stripe --seed emulate.config.yaml',
      cwd: '..',
      reuseExistingServer: !process.env.CI,
      url: `http://localhost:${EMULATE_PORT}/v1/customers`,
    },
    {
      command: 'node --env-file-if-exists=../../.env src/index.ts',
      cwd: '../apps/api',
      env: {
        API_PORT: String(API_PORT),
        BETTER_AUTH_SECRET: 'e2e-secret',
        BETTER_AUTH_URL: API_URL,
        DATABASE_URL,
        NODE_ENV: 'development',
        STRIPE_API_BASE: `http://localhost:${EMULATE_PORT}`,
        STRIPE_SECRET_KEY: 'sk_test_dummy',
        STRIPE_WEBHOOK_SECRET: 'whsec_local_emulate',
        WEB_URL,
      },
      reuseExistingServer: !process.env.CI,
      url: `${API_URL}/health`,
    },
    {
      command: `pnpm exec vite dev --port ${WEB_PORT}`,
      cwd: '../apps/web',
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: !process.env.CI,
      url: WEB_URL,
    },
  ],
});
