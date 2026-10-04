import { defineConsts, defineVars } from '@stylexjs/stylex';

/**
 * The motion scale every transition on the page is cut from, the one
 * transitions.dev keeps, with only the steps in use. A token is picked by what
 * the motion does, not by how close its number is: a tooltip is quick, an
 * answer opening fast.
 */
export const duration = defineConsts({
  // An answer opening or closing under its question, and its chevron turning.
  // A dialog or a menu opening.
  fast: '250ms',
  // The wait before a tooltip appears.
  micro: '80ms',
  // A tooltip appearing, a quiet fade out, a word going or coming. A dialog
  // or a menu closing.
  quick: '150ms',
  // The header opening back out of its pill.
  slow: '400ms',
  // Each of the header's items after the one before it, as they gather, and
  // each item of its menu as they come in.
  stagger: '40ms',
  // A tile rising into place, the header gathering into its pill, a heart's
  // one beat.
  verySlow: '500ms',
});

export const easing = defineConsts({
  // Something small popping past its size and settling back.
  bounce: 'cubic-bezier(0.34, 1.36, 0.64, 1)',
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
  // How far a menu comes down from its button, and its items rise.
  base: '8px',
  // How far a tile or a dialog rises into place.
  medium: '12px',
});

export const scale = defineConsts({
  // A dialog opening or closing.
  large: 0.96,
  // A menu opening.
  medium: 0.97,
  // A tooltip opening.
  small: 0.98,
  // A menu closing.
  tiny: 0.99,
});

/**
 * The page's drawings, in seconds. They tell rather than respond, so no token
 * above fits them; they are kept together here so they can be slowed or
 * quickened at once. The way out's three steps play over `stepPlug`,
 * `stepChoose` and `stepStays`, one after another, stand finished for
 * `stepRest`, go back to their start over `stepBack` and play again. At the
 * foot of the story its signature writes itself over `signature`. In the
 * uses, a loss's icon moves and the loss is struck through over `loss`.
 */
export const drawing = defineConsts({
  loss: 2.4,
  signature: 3,
  stepBack: 0.4,
  stepChoose: 3.2,
  stepPlug: 3.4,
  stepRest: 1.8,
  stepStays: 3,
});

/**
 * The clock a drawing in the uses keeps. Its parts all read the same values,
 * so they keep time with each other: how long the drawing waits before it
 * first plays and, for one that plays over and over, how long a turn takes
 * and whether it runs. The drawing's tile sets the times and the grid says
 * whether it runs; left alone, a drawing that plays over and over is held.
 */
export const clock = defineVars({
  delay: '0ms',
  every: '3.5s',
  state: 'paused',
});
