import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { unplugin as stylex } from '@stylexjs/unplugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          stylex.vite({ useCSSLayers: true }),
          storybookTest({
            configDir: path.join(import.meta.dirname, '.storybook'),
            storybookScript: 'pnpm storybook --no-open',
          }),
        ],
        test: {
          browser: {
            enabled: true,
            headless: true,
            instances: [{ browser: 'chromium' }],
            provider: playwright(),
          },
          name: 'storybook',
        },
      },
    ],
  },
});
