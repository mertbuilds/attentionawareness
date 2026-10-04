import { Button } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { isChunkLoadError, mayReload, reloadOnce } from '../lib/chunk-error.ts';
import { m } from '../paraglide/messages.js';

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
    justifyContent: 'center',
  },
  body: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '40ch',
    textWrap: 'pretty',
  },
  // The words and the two ways on, in the middle of the window.
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    boxSizing: 'border-box',
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: spacing.s6,
    justifyContent: 'center',
    minHeight: '100vh',
    paddingInline: spacing.s4,
    textAlign: 'center',
  },
  title: {
    fontSize: {
      '@media (min-width: 640px)': 36,
      default: 28,
    },
    fontWeight: font.weightRegular,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    margin: 0,
    textWrap: 'balance',
  },
});

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
    <main {...props(styles.page)}>
      <h1 {...props(styles.title)}>{m.error_title()}</h1>
      <p {...props(styles.body)}>{m.error_body()}</p>
      <div {...props(styles.actions)}>
        <Button onClick={() => window.location.reload()}>{m.error_reload()}</Button>
        <Button render={<a href="/" />} variant="outline">
          {m.not_found_home()}
        </Button>
      </div>
    </main>
  );
}
