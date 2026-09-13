import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** How long one key of the opening demonstration holds before the next. */
const STEP_MS = 450;
/** How much of the section has to be on screen before the keys press themselves. */
const VISIBLE = 0.4;
/** A reader who asked for less motion is shown the rest, not the demonstration. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export type AutoDemo = {
  /** Stops the demonstration where it stands, for the rest of the session. */
  cancel: () => void;
  /** The section whose arrival on screen starts the demonstration. */
  ref: RefObject<HTMLElement | null>;
};

/**
 * The register keying itself in once, so the reader watches the bill being run
 * up before they touch anything. It waits until the section is on screen,
 * because a demonstration nobody sees is only a number that moved; a browser
 * with no observer to ask, or a reader who asked for less motion, is left at
 * the resting number the page rendered.
 *
 * `onKey` and `onClear` are read fresh on every press, so the caller may hand
 * over closures that change between renders. `keys` is read at mount, so it
 * has to be the same array every render: a module-level constant.
 */
export function useAutoDemo({
  keys,
  onClear,
  onKey,
}: {
  keys: ReadonlyArray<string>;
  onClear: () => void;
  onKey: (key: string) => void;
}): AutoDemo {
  const ref = useRef<HTMLElement | null>(null);
  const stopped = useRef(false);
  const clear = useRef(onClear);
  const press = useRef(onKey);

  useEffect(() => {
    clear.current = onClear;
    press.current = onKey;
  }, [onClear, onKey]);

  useEffect(() => {
    const node = ref.current;
    if (node === null || stopped.current || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const query = (globalThis as { matchMedia?: (media: string) => MediaQueryList }).matchMedia;
    if (query?.(REDUCED_MOTION).matches === true) {
      return;
    }
    // The demonstration owns the register from here, so it empties it before
    // the section is anywhere near the screen.
    clear.current();
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function type() {
      const key = keys[index];
      if (stopped.current || key === undefined) {
        return;
      }
      index += 1;
      press.current(key);
      if (index < keys.length) {
        timer = setTimeout(type, STEP_MS);
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.intersectionRatio >= VISIBLE)) {
          return;
        }
        // One demonstration per session: the register is the reader's after this.
        observer.disconnect();
        timer = setTimeout(type, STEP_MS);
      },
      { threshold: VISIBLE },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [keys]);

  const cancel = useCallback(() => {
    stopped.current = true;
  }, []);

  return { cancel, ref };
}
