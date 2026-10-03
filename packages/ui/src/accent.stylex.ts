import { defineConsts } from '@stylexjs/stylex';

/**
 * The one chromatic colour in the product, shared by the site and the
 * extension. It is not a theme token: the palette's error red is a warning,
 * and this is a loss, so it stays pure in both themes. It marks what the habit
 * costs, every control the reader ticks, and every switch that is on.
 */
export const accent = defineConsts({
  base: '#ff4f00',
  // The base lifted and softened, for the ring around whatever holds keyboard
  // focus. Full strength there would fight the one control on the row that is
  // meant to be the loudest. Matches the Mac app's focus ring.
  soft: '#ff8a51',
});

/**
 * The three hues the site's drawings carry beside the accent, each for the
 * thing it is the colour of: the sun and the moon, a call that went through
 * and a tree's leaves, the sky. They are for drawings only, never for words
 * or controls. Each wraps a CSS custom property in `src/theme.css`, deeper on
 * the white page and lighter on the black one, so a thin line of it shows on
 * both.
 */
export const tint = defineConsts({
  gold: 'var(--kya-tint-gold)',
  green: 'var(--kya-tint-green)',
  sky: 'var(--kya-tint-sky)',
});
