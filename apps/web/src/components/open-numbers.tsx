import { Skeleton } from '@attentionawareness/ui';
import { colors, radius } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clientEnv } from '../lib/env.ts';
import { layout } from '../lib/layout.ts';
import { subscribeTheme } from '../lib/theme.ts';
import { m } from '../paraglide/messages.js';

/** How long the frame may stay silent before the page says it did not load. */
const PATIENCE = 10_000;
/** The room the block holds until the frame says how tall it is. */
const HOLD = 480;
/** The frame's own line, top and bottom, which its height has to hold as well. */
const EDGES = 2;
/** The block's width on a wide window, past the dashboard's two-column mark. */
const WIDE = '1100px';
const LIGHT = '(prefers-color-scheme: light)';
/** Where the link stands in the sentence, as the footer does it. */
const LINK_SLOT = '\u0000';

type Theme = 'dark' | 'light';
type Status = 'late' | 'loading' | 'ready';

const styles = create({
  // Wider than the page's column where the window has the room: from 1024px
  // the dashboard sets its tiles side by side, under that one per row.
  block: {
    display: 'flex',
    flexDirection: 'column',
    marginInline: {
      '@media (min-width: 1200px)': `calc((100% - ${WIDE}) / 2)`,
      default: 0,
    },
    position: 'relative',
  },
  frame: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'block',
    width: '100%',
  },
  // The dashboard follows the reader's system theme, and a frame takes that
  // from the colour scheme of the element that holds it. So the page's own
  // theme, forced or not, is handed down here.
  frameDark: {
    colorScheme: 'dark',
  },
  frameLight: {
    colorScheme: 'light',
  },
  // Loaded and measured out of sight, so the frame can still say it is there.
  frameWaiting: {
    inset: 0,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
  },
  hold: {
    height: HOLD,
    opacity: 0.2,
    width: '100%',
  },
  line: {
    margin: 0,
  },
});

function subscribeScheme(onChange: () => void): () => void {
  const system = window.matchMedia(LIGHT);
  const unsubscribe = subscribeTheme(onChange);
  system.addEventListener('change', onChange);
  return () => {
    unsubscribe();
    system.removeEventListener('change', onChange);
  };
}

/** The theme the page is drawn in: the forced one, else the system's, else dark. */
function pageTheme(): Theme {
  const forced = document.documentElement.dataset['theme'];
  if (forced === 'dark' || forced === 'light') {
    return forced;
  }
  return window.matchMedia(LIGHT).matches ? 'light' : 'dark';
}

/** The server draws no frame: it cannot know the theme. */
function noTheme(): null {
  return null;
}

/** The height a PostHog frame reports for its own content, if this is that message. */
function reportedHeight(data: unknown): number | undefined {
  if (typeof data !== 'object' || data === null || !('event' in data) || !('height' in data)) {
    return undefined;
  }
  const { event, height } = data;
  return event === 'posthog:dimensions' && typeof height === 'number' && height > 0
    ? height
    : undefined;
}

/**
 * The numbers themselves: a shared PostHog dashboard in a frame, in the page's
 * own theme and as tall as its content. The frame is another site's, so a
 * blocker may stop it; the dashboard says it is there by reporting its height,
 * and a frame that stays silent gives way to a line with a link. Without a
 * dashboard address the block says the numbers are not public yet. The page
 * around it knows nothing of PostHog, so another source can take this place.
 * Why: `docs/adr/0007-open-numbers.md`.
 */
export function OpenNumbers() {
  const dashboard = clientEnv.VITE_OPEN_DASHBOARD_URL;
  const theme = useSyncExternalStore<Theme | null>(subscribeScheme, pageTheme, noTheme);
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [height, setHeight] = useState(HOLD);

  useEffect(() => {
    if (!dashboard) {
      return;
    }
    const origin = new URL(dashboard).origin;
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) {
        return;
      }
      const reported = reportedHeight(event.data);
      if (reported !== undefined) {
        setHeight(Math.ceil(reported));
        setStatus('ready');
      }
    };
    const patience = window.setTimeout(() => {
      setStatus((now) => (now === 'loading' ? 'late' : now));
    }, PATIENCE);
    window.addEventListener('message', onMessage);
    return () => {
      window.clearTimeout(patience);
      window.removeEventListener('message', onMessage);
    };
  }, [dashboard]);

  if (!dashboard) {
    return <p {...props(layout.muted, styles.line)}>{m.open_numbers_empty()}</p>;
  }

  const [failedBefore, failedAfter] = m
    .open_numbers_failed({ dashboard: LINK_SLOT })
    .split(LINK_SLOT);

  return (
    <div {...props(styles.block)}>
      {status === 'loading' && (
        <div aria-label={m.open_numbers_loading()} role="status">
          <Skeleton style={styles.hold} />
        </div>
      )}
      {status === 'late' && (
        <p {...props(layout.muted, styles.line)}>
          {failedBefore}
          <a href={dashboard.replace('/embedded/', '/shared/')} rel="noreferrer" target="_blank">
            {m.open_numbers_failed_link()}
          </a>
          {failedAfter}
        </p>
      )}
      {theme && (
        <iframe
          height={height + EDGES}
          ref={frame}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups"
          src={dashboard}
          title={m.open_numbers_frame()}
          {...props(
            styles.frame,
            theme === 'dark' ? styles.frameDark : styles.frameLight,
            status !== 'ready' && styles.frameWaiting,
          )}
        />
      )}
    </div>
  );
}
