import { defineConfig } from 'vitest/config';

// Two projects: fast stub-db unit tests (*.test.ts) and Testcontainers-backed
// integration tests (*.int.test.ts) that boot a real Postgres once per run.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          environment: 'node',
          exclude: ['**/node_modules/**', '**/*.int.test.ts'],
          include: ['src/**/*.test.ts'],
          name: 'unit',
        },
      },
      {
        test: {
          environment: 'node',
          globalSetup: ['src/test/global-setup.ts'],
          include: ['src/**/*.int.test.ts'],
          name: 'integration',
          // Container start + migrate can be slow on cold Docker caches.
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
