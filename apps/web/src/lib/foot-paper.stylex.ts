import { defineConsts } from '@stylexjs/stylex';

/**
 * The strip of graph paper at the foot of every page: the footer and the room
 * around it. It comes in out of nothing at its top and is at full strength
 * `fadeIn` below it. Six squares tall, so its ruling lines up with a page's own
 * graph paper ruled up from the same foot, and that paper hands over to the
 * strip across the fade instead of drawing a second grid over it.
 */
export const footPaper = defineConsts({
  fadeIn: '144px',
  height: '240px',
});
