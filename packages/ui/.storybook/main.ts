import type { StorybookConfig } from '@storybook/react-vite';
import { unplugin as stylex } from '@stylexjs/unplugin';

const config: StorybookConfig = {
  addons: ['@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  previewHead: (head) => `${head ?? ''}<link rel="stylesheet" href="/virtual:stylex.css" />`,
  stories: ['../src/**/*.stories.tsx'],
  viteFinal: (viteConfig) => {
    viteConfig.plugins = [stylex.vite({ useCSSLayers: true }), ...(viteConfig.plugins ?? [])];
    return viteConfig;
  },
};

export default config;
