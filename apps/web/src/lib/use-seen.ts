import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { WIDE_QUERY } from './wide.ts';

/**
 * The part of the window something has to reach before its motion starts,
 * as the margins a watch takes off the window: a tenth off its top, where
 * the header lies over the page, and three tenths off its foot. Scrolling
 * down, motion starts once the top of its element is seven tenths of the way
 * down the window, so a tile or a drawing is in full view as it starts, not
 * coming up over the edge.
 *
 * On a phone every drawing that starts as it comes on screen starts by this
 * one line. Motion that starts at the window's foot has played before the
 * reader looks there: on a phone that is where the thumb and the browser's
 * bar are. The line is a share of the window, not of the element. A share of
 * the element is met by a small one while it is still at the foot, and never
 * by one taller than the window, and what is taller than a phone's window is
 * not on a desktop.
 */
export const SEEN = '-10% 0px -30% 0px';

/**
 * Where a drawing starts on a wide window, when it is not by `SEEN`: once
 * `amount` of it is in the window, any of it when that is left out, with the
 * window cut by `margin`, the whole of it when that is left out.
 *
 * A wide window has no thumb and no bar at its foot, and the drawings that
 * were on the page before `SEEN` started well there, each by a rule of its
 * own. They keep that rule on a wide window and pass it in here, so `SEEN`
 * moves them on a phone only. What was built since was built on `SEEN`, and
 * keeps it at every width.
 */
export type WideLine = {
  amount?: number | undefined;
  margin?: string | undefined;
};

/**
 * What a watch is made with in the window as it is now: `wide`'s rule on a
 * wide window when there is one, `SEEN` otherwise.
 */
export function seenLine(wide?: WideLine): { rootMargin: string; threshold: number } {
  if (wide !== undefined && window.matchMedia(WIDE_QUERY).matches) {
    return { rootMargin: wide.margin ?? '0px', threshold: wide.amount ?? 0 };
  }
  return { rootMargin: SEEN, threshold: 0 };
}

/**
 * Starts `watch` and starts it over each time the window crosses the phone's
 * width, so a watch made with `seenLine` follows a window that is resized.
 * `watch` returns what stops it, and so does this.
 */
export function watchByWidth(watch: () => () => void): () => void {
  const wide = window.matchMedia(WIDE_QUERY);
  let stop = watch();
  const again = () => {
    stop();
    stop = watch();
  };
  wide.addEventListener('change', again);
  return () => {
    wide.removeEventListener('change', again);
    stop();
  };
}

/**
 * Whether the element in `ref` is in view, for motion that plays as it comes
 * on screen. It turns on once the element reaches the part of the window
 * `SEEN` leaves, or on a wide window meets the rule passed as `desktop`. It
 * turns off only once the element has left the window altogether, so nothing
 * stops or starts over while it is still in sight. In a window so tall that
 * the page ends before the element gets that far, it turns on once the page
 * can scroll no further with the element in the window. It also turns on
 * when the keyboard's focus comes into the element, which a key can do
 * before the reader has scrolled that far: what waits out of sight for this
 * never keeps a focused link out of sight. With `once` it stays on from the
 * first time.
 */
export function useSeen(
  ref: RefObject<Element | null>,
  { desktop, once = false }: { desktop?: WideLine; once?: boolean } = {},
): boolean {
  const [seen, setSeen] = useState(false);
  const ruled = desktop !== undefined;
  const amount = desktop?.amount;
  const margin = desktop?.margin;

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    // With `once`, whether the first time has been.
    let done = false;
    const stopEntering = watchByWidth(() => {
      if (done) {
        return () => {};
      }
      const line = seenLine(ruled ? { amount, margin } : undefined);
      const entering = new IntersectionObserver((entries) => {
        if (
          entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= line.threshold)
        ) {
          setSeen(true);
          if (once) {
            done = true;
            entering.disconnect();
          }
        }
      }, line);
      entering.observe(element);
      return () => entering.disconnect();
    });
    // At the page's end the element is as far up the window as it will get.
    const atEnd = () => {
      if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 1) {
        return;
      }
      const { bottom, top } = element.getBoundingClientRect();
      if (bottom > 0 && top < window.innerHeight) {
        setSeen(true);
      }
    };
    window.addEventListener('scroll', atEnd, { passive: true });
    atEnd();
    const onFocus = () => setSeen(true);
    element.addEventListener('focusin', onFocus);
    if (once) {
      return () => {
        stopEntering();
        window.removeEventListener('scroll', atEnd);
        element.removeEventListener('focusin', onFocus);
      };
    }
    const leaving = new IntersectionObserver((entries) => {
      if (entries.at(-1)?.isIntersecting === false) {
        setSeen(false);
      }
    });
    leaving.observe(element);
    return () => {
      stopEntering();
      leaving.disconnect();
      window.removeEventListener('scroll', atEnd);
      element.removeEventListener('focusin', onFocus);
    };
  }, [amount, margin, once, ref, ruled]);

  return seen;
}
