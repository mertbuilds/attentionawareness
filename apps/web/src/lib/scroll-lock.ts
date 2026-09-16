import { useEffect } from 'react';

/** Every key a browser scrolls the page with, space included. */
const SCROLL_KEYS = new Set([
  ' ',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
]);

/**
 * Whether the key belongs to what it was pressed on rather than to the page:
 * a field is typed into and its caret moved with the same keys, and a button
 * or a link is pressed with the space bar.
 */
function ownsKey(target: EventTarget | null, key: string): boolean {
  const element = target as HTMLElement | null;
  const tag = element?.tagName;
  if (
    element?.isContentEditable === true ||
    tag === 'INPUT' ||
    tag === 'SELECT' ||
    tag === 'TEXTAREA'
  ) {
    return true;
  }
  return key === ' ' && (tag === 'A' || tag === 'BUTTON' || tag === 'SUMMARY');
}

/**
 * While this is on, the page owns its own scroll: the reader cannot move it
 * with the wheel, a finger, or the keyboard, and the window keeps its rubber
 * band to itself. Only the reader is stopped - `scrollTo`, `scrollBy` and
 * `scrollIntoView` still move the page, so whatever is driving it keeps
 * working - and nothing else is touched, so every button stays pressable.
 *
 * The overflow of the document is deliberately left alone: hiding it would
 * stop programmatic scrolling too, and take the scrollbar's width out of the
 * layout with it.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    function block(event: Event) {
      event.preventDefault();
    }
    function blockKey(event: KeyboardEvent) {
      if (SCROLL_KEYS.has(event.key) && !ownsKey(event.target, event.key)) {
        event.preventDefault();
      }
    }
    // Both have to be non-passive, or the browser ignores the preventDefault.
    window.addEventListener('wheel', block, { passive: false });
    window.addEventListener('touchmove', block, { passive: false });
    window.addEventListener('keydown', blockKey);
    const root = document.documentElement;
    root.style.overscrollBehavior = 'none';
    return () => {
      window.removeEventListener('wheel', block);
      window.removeEventListener('touchmove', block);
      window.removeEventListener('keydown', blockKey);
      root.style.overscrollBehavior = '';
    };
  }, [active]);
}
