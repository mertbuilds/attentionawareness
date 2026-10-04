import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * The part of the window something has to reach before its motion starts,
 * as the margins a watch takes off the window: a tenth off its top, where
 * the header lies over the page, and three tenths off its foot. Scrolling
 * down, motion starts once the top of its element is seven tenths of the way
 * down the window, so a tile or a drawing is in full view as it starts, not
 * coming up over the edge.
 *
 * Every drawing that starts as it comes on screen starts by this one line.
 * Motion that starts at the window's foot has played before the reader looks
 * there: on a phone that is where the thumb and the browser's bar are. The
 * line is a share of the window, not of the element. A share of the element
 * is met by a small one while it is still at the foot, and never by one
 * taller than the window, and what is taller than a phone's window is not on
 * a desktop.
 */
export const SEEN = '-10% 0px -30% 0px';

/**
 * Whether the element in `ref` is in view, for motion that plays as it comes
 * on screen. It turns on once the element reaches the part of the window
 * `SEEN` leaves, and off only once the element has left the window
 * altogether, so nothing stops or starts over while it is still in sight.
 * In a window so tall that the page ends before the element gets that far, it
 * turns on once the page can scroll no further with the element in the
 * window. With `once` it stays on from the first time.
 */
export function useSeen(
  ref: RefObject<Element | null>,
  { once = false }: { once?: boolean } = {},
): boolean {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const entering = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          if (once) {
            entering.disconnect();
          }
        }
      },
      { rootMargin: SEEN },
    );
    entering.observe(element);
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
    if (once) {
      return () => {
        entering.disconnect();
        window.removeEventListener('scroll', atEnd);
      };
    }
    const leaving = new IntersectionObserver((entries) => {
      if (entries.at(-1)?.isIntersecting === false) {
        setSeen(false);
      }
    });
    leaving.observe(element);
    return () => {
      entering.disconnect();
      leaving.disconnect();
      window.removeEventListener('scroll', atEnd);
    };
  }, [once, ref]);

  return seen;
}
