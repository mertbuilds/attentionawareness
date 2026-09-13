import { useCallback, useEffect, useRef, useState } from 'react';

/** How long one hour of the show holds before the next one prints. */
const STEP_MS = 900;
/** A reader who asked for less motion is handed the bill, not the show. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** What the reader answered the question with: whole hours, and the rest. */
export type Entered = { hours: number; minutes: number };

export type Show = {
  /** Whether the scripted run owns the dial right now. */
  running: boolean;
  /** Runs the show up to the answer, and settles the page on it. */
  start: (entered: Entered) => void;
};

/**
 * The bill being rung up, one hour at a time: the dial goes to one, then two,
 * then three, up to the hour the reader answered with, and only then does the
 * page hand the dial over. Nothing skips it, because the point of it is that
 * the reader watches their own day being counted out.
 *
 * `onStep` is given the hour and how many hours the run holds, so the caller
 * can pitch the sound against the whole climb. `onSettle` closes the run: it is
 * told the exact answer, and whether anything moved on the way to it, because
 * a reader who asked for less motion gets the answer and no performance.
 *
 * Both are read fresh at every step, so a caller may hand over closures that
 * change between renders.
 */
export function useShow({
  onSettle,
  onStep,
}: {
  onSettle: (entered: Entered, shown: boolean) => void;
  onStep: (hours: number, total: number) => void;
}): Show {
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useRef(onSettle);
  const step = useRef(onStep);

  useEffect(() => {
    settle.current = onSettle;
    step.current = onStep;
  }, [onSettle, onStep]);

  // A run the reader navigated away from must not fire into a dead page.
  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const start = useCallback((entered: Entered) => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const query = (globalThis as { matchMedia?: (media: string) => MediaQueryList }).matchMedia;
    if (query?.(REDUCED_MOTION).matches === true) {
      setRunning(false);
      settle.current(entered, false);
      return;
    }
    // Under an hour is one beat: there is no climb to watch.
    const total = Math.max(1, Math.floor(entered.hours));
    let printed = 1;
    setRunning(true);
    step.current(printed, total);
    function advance() {
      if (printed < total) {
        printed += 1;
        step.current(printed, total);
        timer.current = setTimeout(advance, STEP_MS);
        return;
      }
      timer.current = null;
      setRunning(false);
      settle.current(entered, true);
    }
    timer.current = setTimeout(advance, STEP_MS);
  }, []);

  return { running, start };
}
