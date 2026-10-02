import { defineConsts } from '@stylexjs/stylex';

/**
 * The motion scale every transition on the page is cut from, the one
 * transitions.dev keeps, with only the steps in use. A token is picked by what
 * the motion does, not by how close its number is: a text swap is quick, a
 * crossfade slow, a text reveal very slow.
 */
export const duration = defineConsts({
  // An answer opening or closing under its question, and its chevron turning.
  fast: '250ms',
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
  // Swapped text, a crossfade, an answer coming into focus.
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
 * The grid of what else the hours could have been brings its six on one
 * after another, `gridStagger` apart and the first that long after its line,
 * and each, once risen, plays once over its own time and stands on its end.
 * The drawings kept in `deck/` draw over `deck`, the instruments over twice
 * that, a scene at a time. Once every drawing up has played, the grid stands
 * `gridShuffle` before one of its cells trades its fact for another, and as
 * long after each fact swapped in has played. Further down, the way out's
 * three steps play over `stepPlug`, `stepChoose` and `stepStays`, one after
 * another.
 */
export const drawing = defineConsts({
  deck: 4,
  delay: 0.54,
  earth: 4.2,
  gridShuffle: 4.5,
  gridStagger: 0.33,
  instruments: 8,
  moon: 3.8,
  stepChoose: 3.2,
  stepPlug: 3.4,
  stepStays: 3,
  weekends: 4.5,
  weeks: 3.4,
});
