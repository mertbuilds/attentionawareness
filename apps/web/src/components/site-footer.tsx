import { spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { layout } from '../lib/layout.ts';
import { m } from '../paraglide/messages.js';
import { PreferencesRow } from './preferences.tsx';

const REPO_URL = 'https://github.com/mertbuilds/attentionawareness';
const BUILDER_URL = 'https://mertbuilds.com';
/**
 * Where a link stands inside a sentence. The message is written with the link
 * as a placeholder and split on it, so the words around it keep their own
 * order and spacing in every language instead of being stitched from pieces.
 */
const LINK_SLOT = '\u0000';

const styles = create({
  // The lines on one side, the controls on the other. That column is only as
  // wide as the row, which holds it against the right edge, and the row aligns
  // itself to the foot of the text. A phone has no second column, so the row
  // wraps under the text, on its own left edge.
  footer: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      '@media (min-width: 640px)': '1fr auto',
      default: '1fr',
    },
  },
  lines: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
});

/**
 * The same footer on every page: what this is, who made it, and the theme and
 * language controls. A page with one more line of its own passes it in, and it
 * joins the column above the shared three.
 */
export function SiteFooter({ children }: { children?: ReactNode | undefined }) {
  const [openBefore, openAfter] = m.gen_footer_open_source({ source: LINK_SLOT }).split(LINK_SLOT);
  const [appleBefore, appleAfter] = m.gen_footer_not_apple({ builder: LINK_SLOT }).split(LINK_SLOT);

  return (
    <footer {...props(styles.footer)}>
      <div {...props(styles.lines)}>
        {children}
        <p {...props(layout.muted)}>{m.footer_tagline()}</p>
        <p {...props(layout.muted)}>
          {openBefore}
          <a href={REPO_URL} rel="noreferrer" target="_blank">
            {m.gen_footer_open_source_link()}
          </a>
          {openAfter}
        </p>
        <p {...props(layout.muted)}>
          {appleBefore}
          <a href={BUILDER_URL} rel="noreferrer" target="_blank">
            {m.gen_footer_builder()}
          </a>
          {appleAfter}
        </p>
      </div>
      <PreferencesRow />
    </footer>
  );
}
