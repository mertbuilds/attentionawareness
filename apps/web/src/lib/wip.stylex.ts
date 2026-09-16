import { defineConsts } from '@stylexjs/stylex';

/**
 * How much of the window the work-in-progress strip takes, as the custom
 * property `app.css` holds it: the strip's own height while it stands, and
 * zero once the reader has dismissed it. A screen that fills the window
 * subtracts it, and the fixed chrome starts under it, so both follow the
 * strip in and out without a line of script.
 */
export const wip = defineConsts({
  height: 'var(--aa-wip-height)',
});
