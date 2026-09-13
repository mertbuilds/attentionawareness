import { useCallback, useEffect, useRef } from 'react';

/**
 * How long the question stands on its own before it is answered. The screen
 * holds still for a beat, and only then is the day totalled.
 */
const TOTAL_MS = 600;
/** How long the total stands alone before the list that itemizes it. */
const METRICS_MS = 400;
/** How long that list is left to read before the hour is named out loud. */
const FACT_MS = 400;
/** How long that line stands before the pitch follows it. */
const SETTLE_MS = 400;
/** A reader who asked for less motion is handed the total, not the show. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** What the reader answered the question with: whole hours, and nothing finer. */
export type Entered = { hours: number };

export type Show = {
  /** Totals the answer, itemizes it, names the hour, then sells past it. */
  start: (entered: Entered) => void;
};

/**
 * The whole first screen, as one script: the day the reader answered with is
 * totalled into the one line the screen adds up to, then what the same hours
 * would have bought, then the one sentence that hour has coming to it, and the
 * pitch under all of it. Nothing skips it, because the point of it is that the
 * reader watches their own day being priced.
 *
 * `onArrive` opens it: it is told the exact answer, and whether anything moved
 * on the way to it, because a reader who asked for less motion gets the whole
 * screen and no performance. `onMetrics` follows the total with what it cost,
 * `onFact` says the hour out loud a beat behind that, and `onSettle` is the
 * pitch, a beat behind that.
 *
 * All four are read fresh at every beat, so a caller may hand over closures
 * that change between renders.
 */
export function useShow({
  onArrive,
  onFact,
  onMetrics,
  onSettle,
}: {
  onArrive: (entered: Entered, shown: boolean) => void;
  onFact: (hours: number) => void;
  onMetrics: () => void;
  onSettle: () => void;
}): Show {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrive = useRef(onArrive);
  const fact = useRef(onFact);
  const metrics = useRef(onMetrics);
  const settle = useRef(onSettle);

  useEffect(() => {
    arrive.current = onArrive;
    fact.current = onFact;
    metrics.current = onMetrics;
    settle.current = onSettle;
  }, [onArrive, onFact, onMetrics, onSettle]);

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
    // The dial stops on whole hours, and a day under one is still one line.
    const hours = Math.max(1, Math.floor(entered.hours));
    const query = (globalThis as { matchMedia?: (media: string) => MediaQueryList }).matchMedia;
    if (query?.(REDUCED_MOTION).matches === true) {
      arrive.current(entered, false);
      metrics.current();
      fact.current(hours);
      settle.current();
      return;
    }
    // The day is rung up.
    function land() {
      arrive.current(entered, true);
      timer.current = setTimeout(itemize, METRICS_MS);
    }
    // What the same hours would have bought, under the total.
    function itemize() {
      metrics.current();
      timer.current = setTimeout(say, FACT_MS);
    }
    // The hour itself, said out loud, and the pitch a beat behind it.
    function say() {
      fact.current(hours);
      timer.current = setTimeout(() => {
        timer.current = null;
        settle.current();
      }, SETTLE_MS);
    }
    timer.current = setTimeout(land, TOTAL_MS);
  }, []);

  return { start };
}
