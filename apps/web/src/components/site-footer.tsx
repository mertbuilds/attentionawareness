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
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  // The last line and the controls share a row, centred on each other, so the
  // toggle sits on the text's own line. A phone wraps the controls under it.
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
  lines: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
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
        <p {...props(layout.muted, styles.line)}>
          {openBefore}
          <a href={REPO_URL} rel="noreferrer" target="_blank">
            {m.gen_footer_open_source_link()}
          </a>
          {openAfter}
        </p>
      </div>
      <div {...props(styles.last)}>
        <p {...props(layout.muted, styles.line)}>
          {appleBefore}
          <a href={BUILDER_URL} rel="noreferrer" target="_blank">
            {m.gen_footer_builder()}
          </a>
          {appleAfter}
        </p>
        <PreferencesRow />
      </div>
    </footer>
  );
}
