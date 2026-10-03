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
  // A tooltip appearing, a quiet fade out, a word going or coming.
  quick: '150ms',
  // The header opening back out of its pill.
  slow: '400ms',
  // Each of the header's items after the one before it, as they gather.
  stagger: '40ms',
  // A tile rising into place, the header gathering into its pill.
  verySlow: '500ms',
});

export const easing = defineConsts({
  // A word fading out or in where it stands.
  inOut: 'ease-in-out',
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
 * story its signature writes itself over `signature`. In the uses, a loss is
 * struck through over `strike` and the side project's bar fills over
 * `progress`.
 */
export const drawing = defineConsts({
  progress: 1.2,
  signature: 3,
  stepChoose: 3.2,
  stepPlug: 3.4,
  stepStays: 3,
  strike: 0.7,
});
