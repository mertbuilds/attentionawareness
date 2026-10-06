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
 * How far a step has played, from 0 to 1, over `seconds`, and how much of
 * the drawing shows, from 0 to 1. It plays once from the start each time
 * `play` turns on. When `play` turns off it goes back to the start: at once
 * before it has ever played, and after that with nothing seen to move. The
 * drawing fades out over `drawing.stepFade`, is put at its start while it
 * does not show, and fades back in over the same. It stands at the end, all
 * of it showing, for a reader who asked for less motion, and for a page that
 * has not run its script.
 */
export function usePlayhead(play: boolean, seconds: number): { at: number; opacity: number } {
  const reduced = useLessMotion();
  const clock = useMotionValue(1);
  const veil = useMotionValue(1);
  const [at, setAt] = useState(1);
  const [opacity, setOpacity] = useState(1);
  // Until it has played, it stands at the end only because the server drew
  // it there, and there is nothing to fade away.
  const played = useRef(false);
  useMotionValueEvent(clock, 'change', setAt);
  useMotionValueEvent(veil, 'change', setOpacity);

  // Before the browser paints, so a step put on the page never shows its end
  // for a frame before it starts.
  useLayoutEffect(() => {
    if (reduced) {
      clock.set(1);
      veil.set(1);
      return;
    }
    if (play) {
      played.current = true;
      clock.set(0);
      const shown = animate(veil, 1, { duration: drawing.stepFade, ease: easeInOut });
      const playing = animate(clock, 1, { duration: seconds, ease: 'linear' });
      return () => {
        playing.stop();
        shown.stop();
      };
    }
    if (!played.current) {
      clock.set(0);
      return;
    }
    const fade = { duration: drawing.stepFade, ease: easeInOut };
    let back: ReturnType<typeof animate> | undefined;
    const out = animate(veil, 0, {
      ...fade,
      onComplete: () => {
        clock.set(0);
        back = animate(veil, 1, fade);
      },
    });
    return () => {
      out.stop();
      back?.stop();
    };
  }, [clock, play, reduced, seconds, veil]);

  return reduced ? { at: 1, opacity: 1 } : { at, opacity };
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
