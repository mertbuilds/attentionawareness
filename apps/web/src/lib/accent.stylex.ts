import { defineConsts } from '@stylexjs/stylex';

/**
 * The one chromatic colour on the site. It is not a theme token: the palette's
 * error red is a warning, and this is a loss, so it stays pure in both themes.
 * It marks what the habit costs, and every control the reader ticks.
 */
export const accent = defineConsts({
  base: '#ff4f00',
});
