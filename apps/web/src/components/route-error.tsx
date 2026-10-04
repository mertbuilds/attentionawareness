import type { ErrorComponentProps } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { isChunkLoadError, mayReload, reloadOnce } from '../lib/chunk-error.ts';
import { m } from '../paraglide/messages.js';

/**
 * The view's whole look, set on its elements, so it reads well even when the
 * failure took the site's stylesheet with it: the system's colours for the
 * light and the dark theme, and the system's font.
 */
const PLAIN = {
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  body: { lineHeight: 1.5, margin: 0, maxWidth: '40ch', opacity: 0.7 },
  button: {
    background: 'CanvasText',
    border: 0,
    borderRadius: 999,
    color: 'Canvas',
    font: 'inherit',
    padding: '6px 14px',
  },
  link: { color: 'inherit' },
  page: {
    alignItems: 'center',
    background: 'Canvas',
    color: 'CanvasText',
    colorScheme: 'light dark',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
    gap: 16,
    inset: 0,
    justifyContent: 'center',
    padding: '0 16px',
    // Over the whole window, so a header the stylesheet no longer draws is
    // not seen under it.
    position: 'fixed',
    textAlign: 'center',
    zIndex: 100,
  },
  title: { fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 },
} as const;

/**
 * What a page that failed shows. A page opened before the site was put out
 * anew asks for files that are gone; it is loaded again, once, from the
 * server, and lands where the reader was going. Anything else, or the same
 * failure a second time, says so in a sentence, with a reload and the way
 * home, and never a stack.
 */
export function RouteError({ error }: ErrorComponentProps) {
  // Decided once, as the error first shows, so a render cannot ask twice.
  const [reloading] = useState(
    () => typeof window !== 'undefined' && isChunkLoadError(error) && mayReload(),
  );

  useEffect(() => {
    if (reloading) {
      reloadOnce();
    }
  }, [reloading]);

  if (reloading) {
    return null;
  }

  return (
    <main style={PLAIN.page}>
      <h1 style={PLAIN.title}>{m.error_title()}</h1>
      <p style={PLAIN.body}>{m.error_body()}</p>
      <div style={PLAIN.actions}>
        <button onClick={() => window.location.reload()} style={PLAIN.button} type="button">
          {m.error_reload()}
        </button>
        <a href="/" style={PLAIN.link}>
          {m.not_found_home()}
        </a>
      </div>
    </main>
  );
}
