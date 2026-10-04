import { Separator } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { brandBar } from '../lib/brand-bar.stylex.ts';
import { wip } from '../lib/wip.stylex.ts';
import { GridTexture } from './grid-texture.tsx';
import { SiteFooter } from './site-footer.tsx';

const styles = create({
  // The guide's column, so a post and the guide share a left edge.
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    maxWidth: 760,
    width: '100%',
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 760,
    width: '100%',
  },
  heroTitle: {
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
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: {
      '@media (min-width: 640px)': spacing.s12,
      default: spacing.s8,
    },
    // The stacking context that keeps the grid layer above the page's own
    // background instead of behind it.
    isolation: 'isolate',
    minHeight: `calc(100vh - ${wip.height})`,
    paddingBlockEnd: spacing.s16,
    // The header strip stands over the top of the page, so the first line
    // starts clear of it.
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: `calc(${brandBar.height} + ${spacing.s6})`,
    },
    paddingInline: spacing.s4,
    // The containing block the grid layer measures itself against.
    position: 'relative',
  },
});

/**
 * The page every blog route stands on, the guide's own: the graph paper behind
 * the first screen, the title with what goes over and under it, the column,
 * and the footer under a rule.
 */
export function BlogPage({
  above,
  below,
  children,
  heading,
}: {
  above?: ReactNode;
  below?: ReactNode;
  children: ReactNode;
  heading: string;
}) {
  return (
    <main {...props(styles.page)}>
      <GridTexture />
      <header {...props(styles.hero)}>
        {above}
        <h1 {...props(styles.heroTitle)}>{heading}</h1>
        {below}
      </header>
      <div {...props(styles.content)}>
        {children}
        <Separator />
        <SiteFooter />
      </div>
    </main>
  );
}
