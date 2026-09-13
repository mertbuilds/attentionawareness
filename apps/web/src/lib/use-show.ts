import { useCallback, useEffect, useRef, useState } from 'react';

/** How long one hour of the show stands before the next one lands under it. */
const STEP_MS = 2200;
/**
 * How long the last hour stands on its own before the day is totalled. The
 * climb stops, the number sits there, and only then is it added up.
 */
const TOTAL_MS = 600;
/** How long the total stands alone before the row that itemizes it. */
const METRICS_MS = 400;
/** How long that row is left to read before the pitch follows it. */
const SETTLE_MS = 400;
/** A reader who asked for less motion is handed the total, not the show. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** What the reader answered the question with: whole hours, and nothing finer. */
export type Entered = { hours: number };

export type Show = {
  /** Whether the scripted run owns the number right now. */
  running: boolean;
  /** Runs the show up to the answer, then totals it and sells past it. */
  start: (entered: Entered) => void;
};

/**
 * The whole first screen, as one script: the day is counted out an hour at a
 * time, each hour landing under the one before it, and the last of them is
 * totalled into the one line the screen adds up to, with what that total cost
 * under it and the pitch under that. Nothing skips it, because the point of it
 * is that the reader watches their own day being counted out.
 *
 * `onStep` is given the hour and how many hours the run holds, so the caller
 * can pitch the sound against the whole climb. `onArrive` closes the climb a
 * beat later: it is told the exact answer, and whether anything moved on the
 * way to it, because a reader who asked for less motion gets the whole screen
 * and no performance. `onMetrics` follows the total with what it cost, and
 * `onSettle` is the pitch, a beat behind that.
 *
 * All four are read fresh at every step, so a caller may hand over closures
 * that change between renders.
 */
export function useShow({
  onArrive,
  onMetrics,
  onSettle,
  onStep,
}: {
  onArrive: (entered: Entered, shown: boolean) => void;
  onMetrics: () => void;
  onSettle: () => void;
  onStep: (hours: number, total: number) => void;
}): Show {
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrive = useRef(onArrive);
  const metrics = useRef(onMetrics);
  const settle = useRef(onSettle);
  const step = useRef(onStep);

  useEffect(() => {
    arrive.current = onArrive;
    metrics.current = onMetrics;
    settle.current = onSettle;
    step.current = onStep;
  }, [onArrive, onMetrics, onSettle, onStep]);

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
      arrive.current(entered, false);
      metrics.current();
      settle.current();
      return;
    }
    // Under an hour is one beat: there is no climb to watch.
    const total = Math.max(1, Math.floor(entered.hours));
    let printed = 1;
    // The hour that is up holds for a step; the hour the run ends on holds for
    // the shorter beat the stack is totalled after.
    function queue() {
      const last = printed === total;
      timer.current = setTimeout(last ? land : advance, last ? TOTAL_MS : STEP_MS);
    }
    function advance() {
      printed += 1;
      step.current(printed, total);
      queue();
    }
    // The climb is over, and the day it counted out is rung up.
    function land() {
      setRunning(false);
      arrive.current(entered, true);
      timer.current = setTimeout(itemize, METRICS_MS);
    }
    // What the total cost, under the total, and the pitch a beat behind it.
    function itemize() {
      metrics.current();
      timer.current = setTimeout(() => {
        timer.current = null;
        settle.current();
      }, SETTLE_MS);
    }
    setRunning(true);
    step.current(printed, total);
    queue();
  }, []);

  return { running, start };
}
