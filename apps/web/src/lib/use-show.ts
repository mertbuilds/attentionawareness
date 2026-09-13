import { useCallback, useEffect, useRef, useState } from 'react';

/** How long one hour of the show holds before the next one prints. */
const STEP_MS = 1600;
/**
 * How long the last hour stands on its own before the till rings it up. The
 * climb stops, the number sits there, and only then is it totalled.
 */
const HOLD_MS = 600;
/** How long the line takes to settle before the bill starts printing under it. */
const ARRIVE_MS = 300;
/** One more line of the bill, every beat. */
const PRINT_MS = 240;
/** How long after the total the reader is left with it before the pitch. */
const PITCH_MS = 400;
/** A reader who asked for less motion is handed the bill, not the show. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** What the reader answered the question with: whole hours, and the rest. */
export type Entered = { hours: number; minutes: number };

/** The bill the run prints: how many lines it has, and which one is the total. */
export type Bill = { lines: number; total: number };

export type Show = {
  /** Whether the scripted run owns the number right now. */
  running: boolean;
  /** Runs the show up to the answer, then prints the bill under it. */
  start: (entered: Entered, bill: Bill) => void;
};

/**
 * The whole first screen, as one script: the day is counted out an hour at a
 * time, the line it lands on settles, and the bill prints itself under it, a
 * line at a time, up to the total the till rings. Nothing skips it, because
 * the point of it is that the reader watches their own day being counted out.
 *
 * `onStep` is given the hour and how many hours the run holds, so the caller
 * can pitch the sound against the whole climb. `onArrive` closes the climb: it
 * is told the exact answer, and whether anything moved on the way to it,
 * because a reader who asked for less motion gets the whole bill and no
 * performance. `onPrint` is given each line of the bill in turn, with the bill
 * itself, so the caller rings the till on the line it called the total.
 * `onSettle` is the pitch, which follows the total a beat behind, while the
 * last lines of the bill are still printing.
 *
 * All four are read fresh at every step, so a caller may hand over closures
 * that change between renders.
 */
export function useShow({
  onArrive,
  onPrint,
  onSettle,
  onStep,
}: {
  onArrive: (entered: Entered, shown: boolean) => void;
  onPrint: (line: number, bill: Bill) => void;
  onSettle: () => void;
  onStep: (hours: number, total: number) => void;
}): Show {
  const [running, setRunning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The pitch runs alongside the last lines of the bill, so it keeps its own.
  const pitch = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrive = useRef(onArrive);
  const print = useRef(onPrint);
  const settle = useRef(onSettle);
  const step = useRef(onStep);

  useEffect(() => {
    arrive.current = onArrive;
    print.current = onPrint;
    settle.current = onSettle;
    step.current = onStep;
  }, [onArrive, onPrint, onSettle, onStep]);

  // A run the reader navigated away from must not fire into a dead page.
  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      if (pitch.current !== null) {
        clearTimeout(pitch.current);
      }
    },
    [],
  );

  const start = useCallback((entered: Entered, bill: Bill) => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pitch.current !== null) {
      clearTimeout(pitch.current);
      pitch.current = null;
    }
    const query = (globalThis as { matchMedia?: (media: string) => MediaQueryList }).matchMedia;
    if (query?.(REDUCED_MOTION).matches === true) {
      setRunning(false);
      arrive.current(entered, false);
      settle.current();
      return;
    }
    // Under an hour is one beat: there is no climb to watch.
    const total = Math.max(1, Math.floor(entered.hours));
    let printed = 1;
    let line = 0;
    // The hour that is up holds for a step; the hour the run ends on holds for
    // the shorter beat that the line settles on.
    function queue() {
      const last = printed === total;
      timer.current = setTimeout(last ? land : advance, last ? HOLD_MS : STEP_MS);
    }
    function advance() {
      printed += 1;
      step.current(printed, total);
      queue();
    }
    // The climb is over. The line settles, and the bill mounts empty under it.
    function land() {
      setRunning(false);
      arrive.current(entered, true);
      timer.current = setTimeout(feed, ARRIVE_MS);
    }
    // One more line of the bill, until there is none left to print.
    function feed() {
      line += 1;
      print.current(line, bill);
      if (line === bill.total) {
        pitch.current = setTimeout(() => {
          pitch.current = null;
          settle.current();
        }, PITCH_MS);
      }
      if (line >= bill.lines) {
        timer.current = null;
        return;
      }
      timer.current = setTimeout(feed, PRINT_MS);
    }
    setRunning(true);
    step.current(printed, total);
    queue();
  }, []);

  return { running, start };
}
