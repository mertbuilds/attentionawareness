import { cloudflare } from '@cloudflare/vite-plugin';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { unplugin as stylex } from '@stylexjs/unplugin';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
  // The repo-root .env (loaded via envDir below) sets NODE_ENV=development, and Vite
  // applies it whenever NODE_ENV is unset in the environment. `import.meta.env.DEV`
  // follows NODE_ENV, not mode, so a bare `vite build` builds in development even
  // though mode already defaults to production, and ships dev-only code (react-grab,
  // the virtual:stylex dev stylesheet). Pinning NODE_ENV=production in the shell is
  // what stops the .env from winning, so the package script sets it alongside mode
  // and this guard checks both.
  if (command === 'build' && (mode !== 'production' || process.env.NODE_ENV !== 'production')) {
    throw new Error(
      `Refusing to build with mode="${mode}" and NODE_ENV="${process.env.NODE_ENV ?? 'unset'}". ` +
        'Both must be "production": the repo-root .env sets NODE_ENV=development and Vite ' +
        'applies it whenever NODE_ENV is unset, which ships dev-only code (react-grab, the ' +
        'virtual:stylex dev stylesheet) to production. Run `pnpm build` instead of `vite build`.',
    );
  }

  return {
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
      // Vite ignores PORT by default; portless assigns one when proxying https://attentionawareness.localhost.
      port: process.env.PORT ? Number(process.env.PORT) : 3000,
    },
  };
});
