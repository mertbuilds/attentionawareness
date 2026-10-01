import { defineConsts } from '@stylexjs/stylex';

/**
 * The motion scale every transition on the page is cut from, the one
 * transitions.dev keeps, with only the steps in use. A token is picked by what
 * the motion does, not by how close its number is: a text swap is quick, a
 * crossfade slow, a text reveal very slow.
 */
export const duration = defineConsts({
  // The wait before a tooltip appears.
  micro: '80ms',
  // A text swap, a tooltip appearing, a quiet fade out.
  quick: '150ms',
  // A panel opening, a crossfade.
  slow: '400ms',
  // The step from one line or part to the next.
  stagger: '40ms',
  // A text reveal.
  verySlow: '500ms',
});

export const easing = defineConsts({
  // A text swap or a text reveal.
  inOut: 'ease-in-out',
  // A tooltip.
  out: 'ease-out',
  // Anything that opens, closes, crossfades or moves into place.
  smoothOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
});

export const distance = defineConsts({
  // How far a revealed line rises.
  medium: '12px',
  // How far swapped text moves.
  micro: '4px',
});

export const blur = defineConsts({
  // A revealed line.
  medium: '3px',
  // Swapped text, a crossfade.
  small: '2px',
});

export const scale = defineConsts({
  // A tooltip opening.
  small: 0.98,
});

/**
 * The story's drawings, in seconds. They tell rather than respond, so no
 * token above fits them; they are kept together here so the whole story can
 * be slowed or quickened at once. Each starts `delay` after its beat comes on,
 * once the sentence has risen into place: `duration.verySlow` and a stagger.
 * An answer to "What else?" stands
 * `deckHold` on its finished drawing before the next takes its place. The
 * instruments take twice an answer's time, a scene at a time.
 */
export const drawing = defineConsts({
  deck: 4,
  deckHold: 1.5,
  delay: 0.54,
  earth: 4.2,
  instruments: 8,
  moon: 3.8,
  weekends: 3.2,
  weeks: 3.4,
});
