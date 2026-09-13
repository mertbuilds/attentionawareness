import { Button, Separator } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute, useRouterState } from '@tanstack/react-router';
import { GridTexture } from '../components/grid-texture.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { AVERAGE_DAY, formatYears } from '../lib/attention-math.ts';
import { decodeShare, friendName, shareApps, sharedAppName } from '../lib/share.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/friend')({
  component: FriendPage,
  head: () => ({ meta: [{ title: `${m.friend_head_title()} · ${SITE_NAME}` }] }),
});

const HOME_URL = '/';
/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'Attention Awareness';
/**
 * The apps a link with no list of its own stands for: the four the recommended
 * profile is known by, named in full because there is no rest to count.
 */
const FALLBACK_BUNDLE_IDS: ReadonlyArray<string> = [
  'com.burbn.instagram',
  'com.zhiliaoapp.musically',
  'com.google.ios.youtube',
  'com.atebits.Tweetie2',
];
const MINUTES_PER_HOUR = 60;
/** A day is quoted the way a till quotes one: 4 h 05, never 4 h 5. */
const MINUTE_DIGITS = 2;

const styles = create({
  body: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
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
  // A button is as wide as its own label, so the row it sits on holds it there.
  cta: {
    display: 'flex',
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
    minHeight: '100vh',
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s12,
    },
    paddingInline: spacing.s4,
    // The containing block the grid layer measures itself against.
    position: 'relative',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  sectionTitle: {
    fontSize: 'clamp(22px, 3.2vw, 28px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
});

/**
 * The page for the person on the other end of the phone. They did not ask for
 * any of this and they cannot act on it, so it explains itself once and then
 * gets out of the way: what happened, how to reach them anyway, why, and one
 * way in for a reader who ends up curious about their own day.
 */
function FriendPage() {
  // The link as it was sent, not as a search object: the router knows it on
  // the server too, so the page it renders is already the page the reader was
  // sent, and reading it whole keeps one parser for both pages.
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const { bundleIds, hours } = decodeShare(search);
  const name = friendName(new URLSearchParams(search).get('n'));
  // A link with no day of its own is read against the average, and says so.
  // The generator answers in whole hours, so a link's own day has no minutes.
  const day = hours === undefined ? AVERAGE_DAY : { hours, minutes: 0 };
  const years = formatYears(day.hours + day.minutes / MINUTES_PER_HOUR);
  const shared = bundleIds.length > 0;
  const appNames = (shared ? bundleIds : FALLBACK_BUNDLE_IDS).map(sharedAppName);
  // The fallback four are the whole list, so they are all named; a link's own
  // list is read the way every other share reads one, three and a count.
  const { apps, rest } = shared ? shareApps(appNames) : { apps: appNames.join(', '), rest: 0 };
  const said = {
    hours: day.hours,
    minutes: String(day.minutes).padStart(MINUTE_DIGITS, '0'),
    years,
  };

  return (
    <main {...props(styles.page)}>
      <GridTexture />
      <header {...props(styles.hero)}>
        <h1 {...props(styles.heroTitle)}>
          {name === undefined ? m.friend_title() : m.friend_title_named({ name })}
        </h1>
        <p {...props(styles.lead)}>{m.friend_lead()}</p>
      </header>

      <div {...props(styles.content)}>
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.friend_what_title()}</h2>
          <p {...props(styles.body)}>
            {rest > 0 ? m.friend_what_1_more({ apps, count: rest }) : m.friend_what_1({ apps })}
          </p>
          <p {...props(styles.body)}>{m.friend_what_2()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.friend_reach_title()}</h2>
          <p {...props(styles.body)}>{m.friend_reach_1()}</p>
          <p {...props(styles.body)}>{m.friend_reach_2()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.friend_why_title()}</h2>
          <p {...props(styles.body)}>
            {hours === undefined ? m.friend_why_1_average(said) : m.friend_why_1(said)}
          </p>
          <p {...props(styles.body)}>{m.friend_why_2()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.friend_try_title()}</h2>
          <p {...props(styles.body)}>{m.friend_try_1()}</p>
          <div {...props(styles.cta)}>
            <Button render={<a href={HOME_URL} />}>{m.friend_try_cta()}</Button>
          </div>
        </section>

        <Separator />

        <SiteFooter />
      </div>
    </main>
  );
}
