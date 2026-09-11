import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * The service worker, on its own, for the same reason the content script is:
 * it has to arrive as one self-contained file, that is an IIFE, and Vite takes
 * one output format per build. It runs after the pages build, so it must not
 * empty the dir.
 */
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/background.ts'),
      fileName: () => 'background.js',
      formats: ['iife'],
      name: 'attentionAwarenessBackground',
    },
    outDir: path.resolve(import.meta.dirname, 'dist'),
  },
});
