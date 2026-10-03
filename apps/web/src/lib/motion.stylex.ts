import { defineConsts } from '@stylexjs/stylex';

/**
 * The motion scale every transition on the page is cut from, the one
 * transitions.dev keeps, with only the steps in use. A token is picked by what
 * the motion does, not by how close its number is: a tooltip is quick, an
 * answer opening fast.
 */
export const duration = defineConsts({
  // An answer opening or closing under its question, and its chevron turning.
  fast: '250ms',
  // The wait before a tooltip appears.
  micro: '80ms',
  // The header gathering into its pill and opening back out, the same both
  // ways.
  medium: '350ms',
  // A tooltip appearing, a quiet fade out.
  quick: '150ms',
  // A tile rising into place.
  verySlow: '500ms',
});

export const easing = defineConsts({
  // A tooltip.
  out: 'ease-out',
  // Anything that opens, closes, crossfades or moves into place.
  smoothOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
});

export const blur = defineConsts({
  // A tile coming into focus as it rises.
  medium: '3px',
  // An answer coming into focus.
  small: '2px',
});

export const distance = defineConsts({
  // How far a tile rises into place.
  medium: '12px',
});

export const scale = defineConsts({
  // A tooltip opening.
  small: 0.98,
});

/**
 * The page's drawings, in seconds. They tell rather than respond, so no token
 * above fits them; they are kept together here so they can be slowed or
 * quickened at once. The way out's three steps play over `stepPlug`,
 * `stepChoose` and `stepStays`, one after another, and at the foot of the
 * story its signature writes itself over `signature`.
 */
export const drawing = defineConsts({
  signature: 3,
  stepChoose: 3.2,
  stepPlug: 3.4,
  stepStays: 3,
});
