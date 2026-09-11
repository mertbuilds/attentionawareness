import { defineConfig } from 'vitest/config';

// The logic under test is plain functions: settings, host matching, and the
// string that comes out of them. The DOM work lives in `content.ts` and is
// covered by the Playwright smoke test against a real unpacked build.
export default defineConfig({
  test: {
    // Vitest stubs CSS imports to nothing by default, and the rule files reach
    // the content script as CSS imported `?raw`. Without this they are empty
    // strings here and the whole point of the rule tests goes with them.
    css: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
