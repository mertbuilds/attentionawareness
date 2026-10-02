import { spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { footPaper } from '../lib/foot-paper.stylex.ts';
import { layout } from '../lib/layout.ts';
import { m } from '../paraglide/messages.js';
import { GridTexture } from './grid-texture.tsx';
import { ThemeSwitch } from './preferences.tsx';

/** Every link to one of Mert's own sites carries utm tags, so the visit is traced to this site. */
const BUILDER_URL =
  'https://mertbuilds.com/?utm_source=attentionawareness.com&utm_medium=referral&utm_campaign=footer';
/**
 * Where a link stands inside a sentence. The message is written with the link
 * as a placeholder and split on it, so the words around it keep their own
 * order and spacing in every language instead of being stitched from pieces.
 */
const LINK_SLOT = '\u0000';
/**
 * Ruled at the window's sides and clear in the middle, where the footer's words
 * stand. On a phone the words run nearly edge to edge, so the sides stay faint.
 */
const PAPER_SIDES = 'linear-gradient(to right, black, transparent 35%, transparent 65%, black)';
const PAPER_SIDES_NARROW =
  'linear-gradient(to right, rgb(0 0 0 / 0.4), transparent 25%, transparent 75%, rgb(0 0 0 / 0.4))';
/** No hard line where the paper starts: it comes in out of nothing at its top. */
const PAPER_TOP = `linear-gradient(to bottom, transparent, black ${footPaper.fadeIn})`;

const styles = create({
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  // The last line and the theme control share a row, centred on each other, so
  // the toggle sits on the text's own line. A phone wraps the control under it.
  last: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s4,
    justifyContent: 'space-between',
  },
  line: {
    margin: 0,
  },
  // The graph paper, under the foot of the page. The footer is not
  // positioned, so the paper hangs from the page root every page positions:
  // the window's whole width without pushing it sideways, standing on the
  // page's bottom edge. The two masks are both applied, the sides and the top.
  paper: {
    height: footPaper.height,
    insetBlockEnd: 0,
    insetBlockStart: 'auto',
    maskComposite: 'intersect',
    maskImage: {
      '@media (min-width: 640px)': `${PAPER_SIDES}, ${PAPER_TOP}`,
      default: `${PAPER_SIDES_NARROW}, ${PAPER_TOP}`,
    },
    WebkitMaskComposite: 'source-in',
    WebkitMaskImage: {
      '@media (min-width: 640px)': `${PAPER_SIDES}, ${PAPER_TOP}`,
      default: `${PAPER_SIDES_NARROW}, ${PAPER_TOP}`,
    },
  },
});

/**
 * The same footer on every page: what this is, who made it, and the theme
 * control. A page with one more line of its own passes it in, and it sits above
 * the shared row.
 */
export function SiteFooter({ children }: { children?: ReactNode | undefined }) {
  const [appleBefore, appleAfter] = m.gen_footer_not_apple({ builder: LINK_SLOT }).split(LINK_SLOT);

  return (
    <footer {...props(styles.footer)}>
      <GridTexture style={styles.paper} />
      {children}
      <div {...props(styles.last)}>
        <p {...props(layout.muted, styles.line)}>
          {appleBefore}
          <a href={BUILDER_URL} rel="noreferrer" target="_blank">
            {m.gen_footer_builder()}
          </a>
          {appleAfter}
        </p>
        <ThemeSwitch />
      </div>
    </footer>
  );
}
