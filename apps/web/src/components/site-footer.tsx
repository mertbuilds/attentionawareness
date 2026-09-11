import { spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { layout } from '../lib/layout.ts';
import { m } from '../paraglide/messages.js';
import { LanguageSwitch, ThemeSwitch } from './preferences.tsx';

const REPO_URL = 'https://github.com/mertbuilds/keepyourattention';
const BUILDER_URL = 'https://mertbuilds.com';
const STARTER_URL = 'https://cleanstarter.dev';
/**
 * Where a link stands inside a sentence. The message is written with the link
 * as a placeholder and split on it, so the words around it keep their own
 * order and spacing in every language instead of being stitched from pieces.
 */
const LINK_SLOT = '\u0000';

const styles = create({
  // The lines on one side, the two controls on the other, stacked on a phone.
  // `stretch` gives the controls the height of the lines to spread over.
  footer: {
    alignItems: 'stretch',
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
  // Language on the first line, theme on the last. A phone has no second
  // column, so both sit under the text, on its own left edge.
  prefs: {
    alignItems: {
      '@media (min-width: 640px)': 'flex-end',
      default: 'flex-start',
    },
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    justifyContent: 'space-between',
  },
});

/**
 * The same footer on every page: what this is, who made it, and the theme and
 * language controls. A page with one more line of its own passes it in, and it
 * joins the column above the shared three.
 */
export function SiteFooter({ children }: { children?: ReactNode | undefined }) {
  const [openBefore, openAfter] = m.gen_footer_open_source({ source: LINK_SLOT }).split(LINK_SLOT);
  const [createdBefore, createdBetween, createdAfter] = m
    .gen_footer_created({ builder: LINK_SLOT, starter: LINK_SLOT })
    .split(LINK_SLOT);

  return (
    <footer {...props(styles.footer)}>
      <div {...props(styles.lines)}>
        {children}
        <p {...props(layout.muted)}>
          {openBefore}
          <a href={REPO_URL} rel="noreferrer" target="_blank">
            {m.gen_footer_open_source_link()}
          </a>
          {openAfter}
        </p>
        <p {...props(layout.muted)}>
          {createdBefore}
          <a href={STARTER_URL} rel="noreferrer" target="_blank">
            {m.gen_footer_starter()}
          </a>
          {createdBetween}
          <a href={BUILDER_URL} rel="noreferrer" target="_blank">
            {m.gen_footer_builder()}
          </a>
          {createdAfter}
        </p>
        <p {...props(layout.muted)}>{m.gen_footer_not_apple()}</p>
      </div>
      <div {...props(styles.prefs)}>
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
    </footer>
  );
}
