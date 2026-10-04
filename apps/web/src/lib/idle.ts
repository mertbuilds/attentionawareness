import { useEffect, useState } from 'react';

/** How long the page may stay busy before a task waiting for a quiet moment runs anyway, in milliseconds. */
const IDLE_TIMEOUT_MS = 2000;

/**
 * Runs `task` once the page has loaded and the browser has a quiet moment,
 * for code no page needs to draw. Returns a function that calls it off.
 */
export function whenIdle(task: () => void): () => void {
  let cancel: (() => void) | undefined;
  const idle = () => {
    // Safari has had no idle callback for most of its life: there, the next turn.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(task, 0);
      cancel = () => window.clearTimeout(id);
    }
  };
  if (document.readyState === 'complete') {
    idle();
  } else {
    window.addEventListener('load', idle, { once: true });
    cancel = () => window.removeEventListener('load', idle);
  }
  return () => cancel?.();
}

/** Whether the page has loaded and had a quiet moment. Never on the server or the first render. */
export function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => whenIdle(() => setIdle(true)), []);
  return idle;
}
