import { unplugin as stylex } from '@stylexjs/unplugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Two environments, split by file name. The library is plain functions —
 * settings, host matching, the string that comes out of them — and runs in
 * node. The pages are React, and run in jsdom with the same StyleX transform
 * the build uses, because a component that does not compile is not a component
 * that can be rendered.
 *
 * `content.test.ts` is the exception: it is not React, so it belongs to the
 * node project, and it asks for jsdom and a host of its own through the
 * `@vitest-environment` docblock at the top of the file. The rest of the
 * content script's DOM work is covered by the Playwright smoke test against a
 * real unpacked build.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // Vitest stubs CSS imports to nothing by default, and the rule files
          // reach the content script as CSS imported `?raw`. Without this they
          // are empty strings here and the whole point of the rule tests goes
          // with them.
          css: true,
          environment: 'node',
          include: ['src/**/*.test.ts'],
          name: 'lib',
        },
      },
      {
        plugins: [react(), stylex.vite({ useCSSLayers: true })],
        test: {
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          name: 'popup',
          setupFiles: ['./src/test/setup.ts'],
        },
      },
    ],
  },
});
