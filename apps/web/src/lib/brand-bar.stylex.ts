import { defineConsts } from '@stylexjs/stylex';

/**
 * The strip at the top of the window that keeps the name and the links: the
 * mark and the room above and below it. A page that starts under the strip
 * clears it by this much, so its first line is never under the name.
 */
export const brandBar = defineConsts({
  height: '56px',
});
