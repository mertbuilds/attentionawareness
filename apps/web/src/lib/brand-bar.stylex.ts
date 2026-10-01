import { defineConsts } from '@stylexjs/stylex';

/**
 * The strip a phone keeps the name in at the top of the window: the mark and
 * the room above and below it. A page that starts under the strip clears it
 * by this much on a phone, so its first line is never under the name.
 */
export const brandBar = defineConsts({
  height: '56px',
});
