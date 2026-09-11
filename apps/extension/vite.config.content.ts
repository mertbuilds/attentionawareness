import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * The content script, on its own.
 *
 * A content script is not a module: the manifest has no `"type": "module"` for
 * it, so it cannot import anything at runtime and has to arrive as one
 * self-contained file. That is an IIFE, and Vite takes one output format per
 * build, which is why this is a second build rather than a third entry in
 * `vite.config.ts`. It runs after that one, so it must not empty the dir.
 */
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/content.ts'),
      fileName: () => 'content.js',
      formats: ['iife'],
      name: 'attentionAwareness',
    },
    outDir: path.resolve(import.meta.dirname, 'dist'),
  },
});
