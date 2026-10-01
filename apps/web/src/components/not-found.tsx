import { Button } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';
import { GridTexture } from './grid-texture.tsx';
import { SiteFooter } from './site-footer.tsx';

const styles = create({
  // The footer's column, the same width every other page sets it in.
  foot: {
    maxWidth: 760,
    width: '100%',
  },
  // The line and the way home, in the middle of what the footer leaves.
  message: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: spacing.s6,
    justifyContent: 'center',
    textAlign: 'center',
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    // The padding counts inside the window's height, so the footer stands at
    // its foot rather than a scroll below it.
    boxSizing: 'border-box',
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    // The stacking context that keeps the grid layer above the page's own
    // background instead of behind it.
    isolation: 'isolate',
    minHeight: `calc(100vh - ${wip.height})`,
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s12,
    },
    paddingInline: spacing.s4,
    // The containing block the grid layer measures itself against.
    position: 'relative',
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
 * What a path the site does not have answers with. The server still sends it
 * as a 404, so it is a page for the reader and nothing for a crawler to keep.
 */
export function NotFound() {
  return (
    <main {...props(styles.page)}>
      <GridTexture />
      <div {...props(styles.message)}>
        <h1 {...props(styles.title)}>{m.not_found_title()}</h1>
        <Button render={<a href="/" />} variant="outline">
          {m.not_found_home()}
        </Button>
      </div>
      <div {...props(styles.foot)}>
        <SiteFooter />
      </div>
    </main>
  );
}
