import { cloudflare } from '@cloudflare/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { unplugin as stylex } from '@stylexjs/unplugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // VITE_* vars live in the repo-root .env (single env file for the whole monorepo).
  envDir: '../..',
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    react({ compiler: true }),
    // debug:false — StyleX's dev `data-style-src` attribute embeds file:line, and the
    // React Compiler (client-only) shifts line numbers vs the SSR transform, causing a
    // hydration attribute mismatch that detaches React's event tree (dead forms).
    stylex.vite({ debug: false, useCSSLayers: true }),
    paraglideVitePlugin({
      cookieName: 'PARAGLIDE_LOCALE',
      outdir: './src/paraglide',
      project: './project.inlang',
      strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
    }),
  ],
  server: {
    // Vite ignores PORT by default; portless assigns one when proxying https://keepyourattention.localhost.
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
  },
});
