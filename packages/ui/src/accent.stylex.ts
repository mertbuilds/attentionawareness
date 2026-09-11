import { defineConsts } from '@stylexjs/stylex';

/**
 * The one chromatic colour in the product, shared by the site and the
 * extension. It is not a theme token: the palette's error red is a warning,
 * and this is a loss, so it stays pure in both themes. It marks what the habit
 * costs, every control the reader ticks, and every switch that is on.
 */
export const accent = defineConsts({
  base: '#ff4f00',
});
