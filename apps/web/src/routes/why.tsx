import { colors, font, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { layout } from '../lib/layout.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/why')({
  component: WhyPage,
  head: () => ({ meta: [{ title: m.why_head_title() }] }),
});

const HOME_URL = '/';

const styles = create({
  body: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  // The same 760px column as the generator and the guide.
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    maxWidth: 760,
    width: '100%',
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    minHeight: '100vh',
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s12,
    },
    paddingInline: spacing.s4,
  },
  title: {
    fontSize: 'clamp(36px, 6.4vw, 54px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.035em',
    lineHeight: 1.04,
    margin: 0,
  },
});

function WhyPage() {
  return (
    <main {...props(styles.page)}>
      <div {...props(styles.content)}>
        <h1 {...props(styles.title)}>{m.why_title()}</h1>
        <p {...props(styles.body)}>{m.why_body()}</p>
        <p {...props(layout.muted)}>
          <a href={HOME_URL}>{m.why_back()}</a>
        </p>
      </div>
    </main>
  );
}
