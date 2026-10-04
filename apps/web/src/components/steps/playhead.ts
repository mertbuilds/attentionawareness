import {
  animate,
  clamp,
  cubicBezier,
  easeInOut,
  useMotionValue,
  useMotionValueEvent,
} from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { drawing } from '../../lib/motion.stylex.ts';
import { useLessMotion } from '../../lib/use-less-motion.ts';

/** `easing.smoothOut`, as a function the drawings can ease a stretch by. */
const smoothOut = cubicBezier(0.22, 1, 0.36, 1);

/**
 * How far a step has played, from 0 to 1, over `seconds`. It plays once from
 * the start each time `play` turns on. When `play` turns off it goes back to
 * the start: at once before it has ever played, and wound back over
 * `drawing.stepBack` after, so a drawing that plays again is seen to be
 * undone first. It stands at the end for a reader who asked for less motion,
 * and for a page that has not run its script.
 */
export function usePlayhead(play: boolean, seconds: number): number {
  const reduced = useLessMotion();
  const clock = useMotionValue(1);
  const [at, setAt] = useState(1);
  // Until it has played, it stands at the end only because the server drew
  // it there, and there is nothing to wind back.
  const played = useRef(false);
  useMotionValueEvent(clock, 'change', setAt);

  // Before the browser paints, so a step put on the page never shows its end
  // for a frame before it starts.
  useLayoutEffect(() => {
    if (reduced) {
      clock.set(1);
      return;
    }
    if (play) {
      played.current = true;
      clock.set(0);
      const playing = animate(clock, 1, { duration: seconds, ease: 'linear' });
      return () => playing.stop();
    }
    if (!played.current) {
      clock.set(0);
      return;
    }
    const back = animate(clock, 0, { duration: drawing.stepBack, ease: easeInOut });
    return () => back.stop();
  }, [clock, play, reduced, seconds]);

  return reduced ? 1 : at;
}

/**
 * How far into the part of the play between `from` and `to` the playhead
 * `at` has got, eased smooth out unless told otherwise: nothing before it,
 * all of it after.
 */
export function stretch(
  at: number,
  from: number,
  to: number,
  ease: (share: number) => number = smoothOut,
): number {
  return ease(clamp(0, 1, (at - from) / (to - from)));
}
