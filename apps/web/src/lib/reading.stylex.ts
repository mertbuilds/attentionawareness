import { defineConsts } from '@stylexjs/stylex';

/**
 * The inks long text is set in, mixed from the theme's own ink and ground so
 * they follow the theme the reader chose. The same mix as the prose rules in
 * `app.css`.
 */
export const ink = defineConsts({
  // The words under a title: quieter than the text, clearer than muted gray.
  lead: 'color-mix(in srgb, var(--kya-fg) 68%, var(--kya-bg))',
  // Running text: a step under the full ink, easier on the eye.
  text: 'color-mix(in srgb, var(--kya-fg) 80%, var(--kya-bg))',
});
