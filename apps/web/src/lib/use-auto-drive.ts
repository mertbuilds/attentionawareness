import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** How long one whole hour of the opening drive holds before the next. */
const STEP_MS = 700;
/** How much of the section has to be on screen before the dial moves itself. */
const VISIBLE = 0.4;
/** A reader who asked for less motion is shown the rest, not the drive. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export type AutoDrive = {
  /** Stops the drive where it stands, for the rest of the session. */
  cancel: () => void;
  /** The section whose arrival on screen starts the drive. */
  ref: RefObject<HTMLElement | null>;
};

/**
 * The dial turning itself once, from `from` to `to`, so the reader watches the
 * bill being run up before they touch anything. It waits until the section is
 * on screen, because a drive nobody sees is only a number that moved; a
 * browser with no observer to ask, or a reader who asked for less motion, is
 * left at the resting value the page rendered.
 *
 * `onStep` is read fresh on every step, so the caller may hand over a closure
 * that changes between renders; `from` and `to` are read once, at mount.
 */
export function useAutoDrive({
  from,
  onStep,
  to,
}: {
  from: number;
  onStep: (hours: number) => void;
  to: number;
}): AutoDrive {
  const ref = useRef<HTMLElement | null>(null);
  const stopped = useRef(false);
  const step = useRef(onStep);

  useEffect(() => {
    step.current = onStep;
  }, [onStep]);

  useEffect(() => {
    const node = ref.current;
    if (node === null || stopped.current || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const query = (globalThis as { matchMedia?: (media: string) => MediaQueryList }).matchMedia;
    if (query?.(REDUCED_MOTION).matches === true) {
      return;
    }
    // The drive owns the dial from here, so it takes it back to its start
    // before the section is anywhere near the screen.
    step.current(from);
    let hours = from;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function advance() {
      if (stopped.current) {
        return;
      }
      hours += 1;
      step.current(hours);
      if (hours < to) {
        timer = setTimeout(advance, STEP_MS);
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.intersectionRatio >= VISIBLE)) {
          return;
        }
        // One drive per session: the dial is the reader's after this.
        observer.disconnect();
        timer = setTimeout(advance, STEP_MS);
      },
      { threshold: VISIBLE },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [from, to]);

  const cancel = useCallback(() => {
    stopped.current = true;
  }, []);

  return { cancel, ref };
}
