import { Separator } from '@attentionawareness/ui';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { GridTexture } from '../components/grid-texture.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/guides/')({
  component: GuidesIndex,
  head: () => ({
    meta: [
      { title: `${m.guides_head_title()} · ${SITE_NAME}` },
      { content: m.guides_description(), name: 'description' },
      { content: m.guides_title(), property: 'og:title' },
      { content: m.guides_description(), property: 'og:description' },
      { content: PAGE_URL, property: 'og:url' },
    ],
  }),
});

/** The arrow before a back link: a glyph, not a message. */
const BACK_ARROW = '\u2190';
const HOME_URL = '/';
/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
const PAGE_URL = 'https://attentionawareness.com/guides';
const SUPERVISE_GUIDE_URL = '/guides/supervise-iphone-without-erasing';
/** The day the guide below was last gone over, spelled the way a byline reads it. */
const SUPERVISE_GUIDE_UPDATED = '18 September 2026';

const styles = create({
  // The way back, over the title: one quiet line, an arrow and a word.
  back: {
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    display: 'inline-flex',
    fontSize: font.sizeSm,
    gap: spacing.s1,
    textDecorationLine: 'none',
  },
  // One guide, one box. The whole box is the link, so there is nothing on it
  // to aim at: the border lifts on hover and the title follows the pointer.
  card: {
    borderColor: {
      ':hover': colors.fg,
      default: colors.border,
    },
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    padding: spacing.s6,
    textDecorationLine: 'none',
  },
  cardSummary: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  cardTitle: {
    fontSize: font.sizeLg,
    fontWeight: font.weightBold,
    letterSpacing: '-0.01em',
    margin: 0,
    textWrap: 'pretty',
  },
  cardUpdated: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
  },
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
  // Same column as `content`, so the hero and every section share a left edge.
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 760,
    width: '100%',
  },
  heroTitle: {
    fontSize: 'clamp(36px, 6.4vw, 54px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.035em',
    lineHeight: 1.04,
    margin: 0,
    textWrap: 'balance',
  },
  lead: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  // The boxes stack, closer to each other than two sections would be.
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
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
});

/**
 * Every guide the site has, newest first. One entry today; the list is here so
 * the second one costs a row rather than a page.
 */
function GuidesIndex() {
  const guides = [
    {
      href: SUPERVISE_GUIDE_URL,
      summary: m.guides_sup_summary(),
      title: m.guides_sup_title(),
      updated: SUPERVISE_GUIDE_UPDATED,
    },
  ];

  return (
    <main {...props(styles.page)}>
      <GridTexture />
      <header {...props(styles.hero)}>
        <a data-plain="" href={HOME_URL} {...props(styles.back)}>
          <span aria-hidden="true">{BACK_ARROW}</span>
          {m.nav_back_home()}
        </a>
        <h1 {...props(styles.heroTitle)}>{m.guides_title()}</h1>
        <p {...props(styles.lead)}>{m.guides_lead()}</p>
      </header>

      <div {...props(styles.content)}>
        <ul {...props(styles.list)}>
          {guides.map((guide) => (
            <li key={guide.href}>
              <a data-plain="" href={guide.href} {...props(styles.card)}>
                <h2 {...props(styles.cardTitle)}>{guide.title}</h2>
                <p {...props(styles.cardSummary)}>{guide.summary}</p>
                <p {...props(styles.cardUpdated)}>{m.guides_updated({ date: guide.updated })}</p>
              </a>
            </li>
          ))}
        </ul>

        <Separator />

        <SiteFooter />
      </div>
    </main>
  );
}
