import { defineConfig } from 'oxfmt';

export default defineConfig({
  experimentalSortImports: { newlinesBetween: false },
  experimentalSortPackageJson: { sortScripts: true },
  ignorePatterns: [
    'node_modules',
    'dist',
    '.output',
    '.turbo',
    'storybook-static',
    'packages/db/generated',
    'apps/web/src/paraglide',
    'apps/web/src/routeTree.gen.ts',
    '.wrangler',
    'pnpm-lock.yaml',
    '.claude/skills',
  ],
  singleQuote: true,
});
