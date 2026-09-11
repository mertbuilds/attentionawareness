import { cp } from 'node:fs/promises';
import path from 'node:path';
import { unplugin as stylex } from '@stylexjs/unplugin';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const src = path.resolve(import.meta.dirname, 'src');
const dist = path.resolve(import.meta.dirname, 'dist');

/**
 * The manifest and the icons are not modules: they ship byte for byte, and a
 * build that rewrote them would be a build that could break them. crxjs and
 * wxt both do this for you, and both lag Vite by a major; this is the whole of
 * what they would be here.
 */
function copyStatic(): Plugin {
  return {
    apply: 'build',
    async closeBundle() {
      await cp(path.join(src, 'manifest.json'), path.join(dist, 'manifest.json'));
      await cp(path.join(src, 'icons'), path.join(dist, 'icons'), { recursive: true });
    },
    name: 'attentionawareness:copy-static',
  };
}

/**
 * The two extension pages. The content script is a second build
 * (`vite.config.content.ts`) because it needs a different output format.
 *
 * The pages are React and StyleX, the same versions and the same unplugin the
 * web app runs: the popup draws the shared tokens, the shared theme and the
 * licensed Suisse woff2, so it has to compile them the same way. StyleX
 * appends its CSS to the first stylesheet the build emits, which is the one
 * the popup entry imports.
 */
export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: dist,
    rollupOptions: {
      input: {
        options: path.join(src, 'options.html'),
        popup: path.join(src, 'popup.html'),
      },
    },
  },
  plugins: [react(), stylex.vite({ useCSSLayers: true }), copyStatic()],
  // Nothing is served as-is; `copyStatic` places the few files that are.
  publicDir: false,
  // So the pages land at `dist/popup.html`, which is what the manifest names.
  root: src,
});
