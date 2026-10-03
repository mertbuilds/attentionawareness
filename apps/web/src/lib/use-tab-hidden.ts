import { useSyncExternalStore } from 'react';

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function tabHidden(): boolean {
  return document.visibilityState === 'hidden';
}

function hiddenOnServer(): boolean {
  return false;
}

/**
 * Whether the tab is put away, so a drawing that plays over and over can hold
 * while nobody can see it. The server draws the page as if it were in front.
 */
export function useTabHidden(): boolean {
  return useSyncExternalStore(subscribeVisibility, tabHidden, hiddenOnServer);
}
