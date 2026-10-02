import { useSyncExternalStore } from 'react';

/** The media query a reader who asked for less motion matches. */
const LESS_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeLessMotion(onChange: () => void): () => void {
  const query = window.matchMedia(LESS_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function prefersLessMotion(): boolean {
  return window.matchMedia(LESS_MOTION).matches;
}

function lessMotionOnServer(): boolean {
  return false;
}

/**
 * Whether the reader asked for less motion. The server cannot know, so the
 * page is first drawn the way the server drew it and changes once it has come
 * alive, rather than drawing on top of markup the server never sent.
 */
export function useLessMotion(): boolean {
  return useSyncExternalStore(subscribeLessMotion, prefersLessMotion, lessMotionOnServer);
}
