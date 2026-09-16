import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';

/** Where the dismissal is kept, and the stamp the head script reads it into. */
const DISMISSED_KEY = 'aa-wip-dismissed';
const DISMISSED_STAMP = 'data-aa-wip-off';
/** The width of the close button, and the room the sentence keeps clear of it. */
const CLOSE_WIDTH = 32;
/** The strip's own ground: the page's foreground, thinned until it is a shade. */
const SURFACE = `color-mix(in srgb, ${colors.fg} 6%, transparent)`;

const styles = create({
  // The strip itself: the window's width, one line's height, and the sentence
  // centred in it whatever else stands at its end.
  bar: {
    alignItems: 'center',
    backgroundColor: SURFACE,
    boxSizing: 'border-box',
    // The strip says the site is unfinished, which is a warning, so it is
    // written in the one colour the site keeps for what a habit costs. The
    // ground under it stays a shade of the page, so the orange word in the
    // hero under it is still the loudest thing on the screen.
    color: accent.base,
    display: 'flex',
    height: wip.height,
    justifyContent: 'center',
    paddingInline: CLOSE_WIDTH,
    position: 'relative',
    width: '100%',
  },
  // Put away for good, at the end of the line it closes.
  dismiss: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: 16,
    height: wip.height,
    insetBlockStart: 0,
    insetInlineEnd: 0,
    justifyContent: 'center',
    lineHeight: 1,
    opacity: {
      ':hover': 1,
      default: 0.7,
    },
    padding: 0,
    position: 'absolute',
    width: CLOSE_WIDTH,
  },
  // A step smaller on a phone, where the sentence has half the room: two
  // lines of it still stand inside the strip rather than growing it.
  line: {
    fontSize: {
      '@media (max-width: 639px)': 12,
      default: 13,
    },
    lineHeight: 1.2,
    margin: 0,
    textAlign: 'center',
    textWrap: 'pretty',
  },
});

/** Keeps the strip off this browser, and takes it off the page at once. */
function dismiss() {
  try {
    globalThis.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Private mode or a full store: the strip goes for this page and comes
    // back on the next one.
  }
  document.documentElement.setAttribute(DISMISSED_STAMP, '');
}

/**
 * What the site is: unfinished, and changing under the reader. It stands above
 * everything on every page, at the top of the document rather than fixed to
 * the window, so the page simply starts under it.
 *
 * It is rendered whether or not it has been dismissed, and the stamp the head
 * script puts on the root before first paint is what hides it: the server and
 * the browser draw the same thing, so nothing is left to hydrate around.
 */
export function WipBanner() {
  return (
    <div data-aa-wip="" {...props(styles.bar)}>
      <span {...props(styles.line)}>{m.site_wip()}</span>
      <button
        aria-label={m.site_wip_dismiss()}
        onClick={dismiss}
        type="button"
        {...props(styles.dismiss)}
      >
        ×
      </button>
    </div>
  );
}
