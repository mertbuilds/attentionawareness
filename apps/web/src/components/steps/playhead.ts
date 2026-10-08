import { create } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import {
  animate,
  clamp,
  cubicBezier,
  easeInOut,
  useMotionValue,
  useMotionValueEvent,
} from 'motion/react';
import type { Ref } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { drawing } from '../../lib/motion.stylex.ts';
import { useLessMotionOnceKnown } from '../../lib/use-less-motion.ts';

/** `easing.smoothOut`, as a function the drawings can ease a stretch by. */
const smoothOut = cubicBezier(0.22, 1, 0.36, 1);

/**
 * The two copies of a step the server draws, and which of them shows. The
 * server cannot know whether the reader asked for less motion or runs the
 * page's script, so it draws the step at its start and at its end, and the
 * browser picks one before the first paint: the start, where the play will
 * set off from, or the end for a reader who asked for less motion and for a
 * browser with scripting off, where nothing would ever play. Once the page
 * has come alive it knows which, and draws that one alone.
 */
export const copies = create({
  end: {
    display: {
      '@media (prefers-reduced-motion: reduce), (scripting: none)': 'block',
      default: 'none',
    },
  },
  start: {
    display: {
      '@media (prefers-reduced-motion: reduce), (scripting: none)': 'none',
      default: 'block',
    },
  },
});

/** What a step's drawing is drawn from: how far it has played, how much of it shows, and which copy it is, if one of two. */
export type FrameProps = {
  at: number;
  opacity: number;
  ref?: Ref<SVGSVGElement> | undefined;
  style?: StyleXStyles | undefined;
};

/**
 * How far a step has played, from 0 to 1, over `seconds`, and how much of
 * the drawing shows, from 0 to 1. It stands at the start until `play` first
 * turns on, which is also how the server draws it, so nothing moves as the
 * page comes alive. It plays once from the start each time `play` turns on.
 * When `play` turns off it goes back to the start with nothing seen to move:
 * the drawing fades out over `drawing.stepFade`, is put at its start while it
 * does not show, and fades back in over the same. It stands at the end, all
 * of it showing, for a reader who asked for less motion. `both` is on while
 * that is not known yet, on the server and in the first draw over its
 * markup: the step is then drawn a second time at its end, see `copies`.
 */
export function usePlayhead(
  play: boolean,
  seconds: number,
): { at: number; both: boolean; opacity: number } {
  const less = useLessMotionOnceKnown();
  const reduced = less === true;
  const clock = useMotionValue(0);
  const veil = useMotionValue(1);
  const [at, setAt] = useState(0);
  const [opacity, setOpacity] = useState(1);
  // Until it has played it shows nothing but its start, and there is nothing
  // to fade away.
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

  return reduced ? { at: 1, both: false, opacity: 1 } : { at, both: less === undefined, opacity };
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
