import { useCallback, useEffect, useRef, useState } from 'react';

/** How long one hour of the show holds before the next one prints. */
const STEP_MS = 1600;
/**
 * How long the last hour stands on its own before the till rings it up. The
 * climb stops, the number sits there, and only then is it totalled.
 */
const HOLD_MS = 600;
/** A reader who asked for less motion is handed the bill, not the show. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** What the reader answered the question with: whole hours, and the rest. */
export type Entered = { hours: number; minutes: number };

export type Show = {
  /** Whether the scripted run owns the number right now. */
  running: boolean;
  /** Runs the show up to the answer, and settles the page on it. */
  start: (entered: Entered) => void;
};

/**
 * The bill being rung up, one hour at a time: it counts to one, then two,
 * then three, up to the hour the reader answered with. That last hour holds on
 * its own for a beat, and only then is the bill totalled. Nothing skips it,
 * because the point of it is that the reader watches their own day being
 * counted out.
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
    // The hour that is up holds for a step; the hour the run ends on holds for
    // the shorter beat that the total lands on.
    function queue() {
      const last = printed === total;
      timer.current = setTimeout(last ? ring : advance, last ? HOLD_MS : STEP_MS);
    }
    function advance() {
      printed += 1;
      step.current(printed, total);
      queue();
    }
    function ring() {
      timer.current = null;
      setRunning(false);
      settle.current(entered, true);
    }
    setRunning(true);
    step.current(printed, total);
    queue();
  }, []);

  return { running, start };
}
