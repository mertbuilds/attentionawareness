import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, defaultMarker, props, when } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useId, useState } from 'react';
import {
  AngleDown,
  BookOpen,
  Briefcase,
  Brush,
  Call,
  Camera,
  ChartLine,
  Check,
  MusicNote,
  Video,
} from 'reicon-react';
import { HeroPhone } from '../components/hero-phone.tsx';
import { HowItWorks } from '../components/how-it-works.tsx';
import { MacDownload } from '../components/mac-download.tsx';
import { ScreenShots } from '../components/screen-shots.tsx';
import { Signature } from '../components/signature.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { blur, duration, easing } from '../lib/motion.stylex.ts';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/**
 * The air between two sections, wider than anything inside one. The 4px scale
 * stops at 64px, and one idea per screen needs more than that between two of
 * them, so the page's widest gap is the one measure written out here.
 */
const SECTION_GAP = '96px';
/** The column every section stands in, and the first screen too once it is stacked. */
const COLUMN_WIDTH = 760;
/**
 * The first screen side by side: wider than the column, so the words keep a
 * readable measure next to the phone.
 */
const HERO_WIDTH = 1040;
/** The phone's column beside the words, as wide as the phone is drawn there. */
const HERO_PHONE_WIDTH = 320;
/** The places on the page that can be linked to, and the ids they use. */
const PROOF_ID = 'proof';
const WAY_OUT_ID = 'way-out';
const STORY_ID = 'story';
/** The manual way out, on a page of its own. */
const GUIDE_URL = '/guide';
/** Every link off this site carries utm tags, so the visit is traced to this page. */
const STORE_URL =
  'https://chromewebstore.google.com/detail/attention-awareness/lgcijcijcndmggjiioibfcmppndfakee?utm_source=attentionawareness.com&utm_medium=referral&utm_campaign=home';
/** The post this started from, linked out of the paragraph that tells it. */
const STORY_URL = 'https://stopa.io/post/297';
/**
 * Where a link or an orange word stands inside a sentence. The message is written
 * with it as a placeholder and split on it, so the words around it keep their
 * own order and spacing in every language instead of being stitched from
 * pieces.
 */
const LINK_SLOT = '\u0000';
/** The chevron at the end of a question, in pixels. */
const CHEVRON_SIZE = 16;
/** A 1.5px line at that size, in the icon's own 24-unit grid. */
const CHEVRON_STROKE = 2.25;
/** The tick before a promise, in pixels, drawn with the chevron's line. */
const CHECK_SIZE = 16;
/** A use's icon, in pixels, at the icons' own 1.5px line. */
const USE_ICON_SIZE = 24;

const styles = create({
  // A section the page links down to. The scroll stops short of its heading,
  // clear of the brand bar fixed over the top of the window.
  anchor: {
    scrollMarginBlockStart: `calc(${spacing.s16} + ${wip.height})`,
  },
  // The last word before the footer: one line, the download under it, then
  // its price and the free way, all in the middle of the column.
  closing: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    paddingBlock: spacing.s16,
    textAlign: 'center',
  },
  closingNote: {
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    lineHeight: 1.5,
    margin: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    // Nothing is drawn between the sections, so the gap carries the rhythm on
    // its own at every width.
    gap: SECTION_GAP,
    maxWidth: COLUMN_WIDTH,
    width: '100%',
  },
  // The page's largest words, at one size: the claim it opens on, the numbers
  // that back it and the line it closes on.
  displayTitle: {
    fontSize: {
      '@media (min-width: 640px)': 'clamp(40px, 5vw, 64px)',
      default: 'clamp(32px, 9vw, 40px)',
    },
    fontWeight: font.weightRegular,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
    margin: 0,
    textWrap: 'balance',
  },
  // The free way, under the or: one quiet line and its button, in the middle
  // like the price above it.
  diy: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    textAlign: 'center',
  },
  // The free way's one line, quiet: one line where it fits, even lines where
  // it wraps.
  diyLine: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'balance',
  },
  // A phone's note and its button stand in the middle, under the words above
  // them.
  downloadCentered: {
    alignItems: 'center',
  },
  // The track an answer grows and shrinks in, from no height to its own. It
  // takes no padding, or a closed answer would keep a strip of it.
  faqAnswer: {
    display: 'grid',
    gridTemplateRows: '0fr',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.fast,
    },
    transitionProperty: 'grid-template-rows',
    transitionTimingFunction: easing.smoothOut,
  },
  faqAnswerOpen: {
    gridTemplateRows: '1fr',
  },
  // What the track cuts off while it is short, coming into focus as it opens.
  faqClip: {
    filter: `blur(${blur.small})`,
    minHeight: 0,
    opacity: 0,
    overflow: 'hidden',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.fast,
    },
    transitionProperty: 'opacity, filter',
    transitionTimingFunction: easing.smoothOut,
  },
  faqClipOpen: {
    filter: 'blur(0)',
    opacity: 1,
  },
  faqHeading: {
    margin: 0,
  },
  // A line between two questions, none above the first.
  faqItem: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: {
      ':first-child': 0,
      default: '1px',
    },
  },
  // Quieter than the question, and clear of the chevron above it.
  faqText: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    paddingBlockEnd: spacing.s4,
    paddingInlineEnd: spacing.s8,
    textWrap: 'pretty',
  },
  // The chevron at the end of the row. It waits in the muted ink, pointing
  // down, and darkens when the row is pointed at; an open answer turns it
  // over to point up.
  faqChevron: {
    color: {
      default: colors.muted,
      [when.ancestor(':hover')]: colors.fg,
    },
    flexShrink: 0,
    transform: 'none',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.fast,
    },
    transitionProperty: 'transform',
    transitionTimingFunction: easing.smoothOut,
  },
  faqChevronOpen: {
    color: colors.fg,
    transform: 'rotate(180deg)',
  },
  // The whole row is the button, so the question is pressed wherever it is
  // touched.
  faqQuestion: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.base,
    borderStyle: 'none',
    borderWidth: 0,
    color: colors.fg,
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: font.sizeMd,
    fontWeight: font.weightRegular,
    gap: spacing.s4,
    justifyContent: 'space-between',
    lineHeight: 1.5,
    margin: 0,
    outlineColor: colors.fg,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    paddingBlock: spacing.s4,
    paddingInline: 0,
    textAlign: 'start',
    textWrap: 'pretty',
    width: '100%',
  },
  // The first screen: the claim, the reason and the download beside the phone
  // the feeds leave. Too narrow for two columns, the phone stands under the
  // words and the hero narrows to the column, so every left edge lines up.
  hero: {
    alignItems: 'center',
    columnGap: spacing.s16,
    display: 'grid',
    gridTemplateColumns: {
      '@media (min-width: 900px)': `minmax(0, 1fr) ${HERO_PHONE_WIDTH}px`,
      default: 'minmax(0, 1fr)',
    },
    maxWidth: {
      '@media (min-width: 900px)': HERO_WIDTH,
      default: COLUMN_WIDTH,
    },
    // Clear of the name: the strip a phone keeps it in, and the corner a wider
    // window keeps it in.
    paddingBlockStart: spacing.s16,
    rowGap: spacing.s12,
    width: '100%',
  },
  // The word the claim turns on, in the one orange.
  heroAccent: {
    color: accent.base,
  },
  // The download and its price, close under it.
  heroAction: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  heroPrice: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  // The reason under the claim, a step quieter and a step smaller on a phone.
  heroSub: {
    color: colors.muted,
    fontSize: {
      '@media (min-width: 640px)': font.sizeLg,
      default: font.sizeMd,
    },
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '46ch',
    textWrap: 'pretty',
  },
  heroText: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
  },
  // The app's offer under the steps: the price and what it buys, then the
  // download, all in the middle. The app is the way the page recommends, so
  // its card carries the orange. It takes the column on a phone and stands
  // narrower in the middle of it on a wide one.
  offer: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: `color-mix(in srgb, ${accent.base} 6%, ${colors.bg})`,
    borderColor: accent.base,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    maxWidth: 560,
    padding: spacing.s6,
    textAlign: 'center',
    width: '100%',
  },
  // The price, and the promises close under it.
  offerHead: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  // The price is in the card's orange.
  offerPrice: {
    color: accent.base,
    fontSize: font.sizeLg,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
  },
  // The rule between the two ways, broken in its middle by the word that
  // tells the reader to pick one.
  or: {
    '::after': {
      backgroundColor: colors.border,
      content: '""',
      flexGrow: 1,
      height: 1,
    },
    '::before': {
      backgroundColor: colors.border,
      content: '""',
      flexGrow: 1,
      height: 1,
    },
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    gap: spacing.s4,
    lineHeight: 1.5,
    margin: 0,
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: SECTION_GAP,
    // The stacking context that keeps the footer's graph paper above the page's
    // own background instead of behind it.
    isolation: 'isolate',
    minHeight: `calc(100vh - ${wip.height})`,
    // Anything past the window's edge is cut, so nothing scrolls sideways.
    overflowX: 'clip',
    paddingBlockEnd: spacing.s16,
    paddingInline: spacing.s4,
    // The containing block the footer's graph paper measures itself against.
    position: 'relative',
  },
  // One promise: its tick, then its words, wrapping clear of the tick in even
  // lines.
  promise: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: spacing.s2,
    textAlign: 'start',
    textWrap: 'balance',
  },
  // The tick sits in the middle of the first line of its words, 24px tall,
  // in the price's orange.
  promiseCheck: {
    color: accent.base,
    flexShrink: 0,
    marginBlockStart: 4,
  },
  // The promises stand in the middle as one block, their ticks in a column.
  promises: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeMd,
    gap: spacing.s2,
    lineHeight: 1.5,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
  },
  // The sentence under a section heading: the reason, not the claim.
  sectionBody: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '60ch',
    textWrap: 'pretty',
  },
  sectionTitle: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  // Two times at the display size, their digits at one width.
  stat: {
    fontVariantNumeric: 'tabular-nums',
  },
  story: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 640,
  },
  // Paragraphs of prose, so the ink is pulled a step toward the page.
  storyLine: {
    color: `color-mix(in srgb, ${colors.fg} 80%, ${colors.bg})`,
    fontSize: 18,
    lineHeight: 1.7,
    margin: 0,
    textWrap: 'pretty',
  },
  // One thing the phone is for: a quiet tile, its icon over its line.
  use: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeMd,
    gap: spacing.s4,
    lineHeight: 1.4,
    padding: {
      '@media (min-width: 768px)': spacing.s6,
      default: spacing.s4,
    },
    textWrap: 'pretty',
  },
  useIcon: {
    color: colors.muted,
    flexShrink: 0,
  },
  // Two to a row on a phone, all four across once the column has room.
  uses: {
    display: 'grid',
    gap: spacing.s3,
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'repeat(4, minmax(0, 1fr))',
      default: 'repeat(2, minmax(0, 1fr))',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
});

/**
 * One question, closed until it is pressed. Its answer opens under it and
 * leaves the others as they are, so two can be read at once. A closed answer
 * is inert: out of the tab order and unread by a screen reader, though it
 * stays in the page to animate.
 */
function Question({ answer, question }: { answer: string; question: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const questionId = `${id}-question`;
  const answerId = `${id}-answer`;

  return (
    <div {...props(styles.faqItem)}>
      <h3 {...props(styles.faqHeading)}>
        <button
          aria-controls={answerId}
          aria-expanded={open}
          id={questionId}
          onClick={() => setOpen(!open)}
          type="button"
          {...props(styles.faqQuestion, defaultMarker())}
        >
          <span>{question}</span>
          <AngleDown
            aria-hidden="true"
            size={CHEVRON_SIZE}
            strokeWidth={CHEVRON_STROKE}
            {...props(styles.faqChevron, open && styles.faqChevronOpen)}
          />
        </button>
      </h3>
      <div
        aria-labelledby={questionId}
        id={answerId}
        inert={!open}
        role="region"
        {...props(styles.faqAnswer, open && styles.faqAnswerOpen)}
      >
        <div {...props(styles.faqClip, open && styles.faqClipOpen)}>
          <p {...props(styles.faqText)}>{answer}</p>
        </div>
      </div>
    </div>
  );
}

function HomePage() {
  // The word the claim turns on, in the middle of it, so the words around it
  // keep their own order in every language.
  const [titleBefore, titleAfter] = m.home_hero_title({ algorithms: LINK_SLOT }).split(LINK_SLOT);

  // What the phone is still for, each with its icon.
  const uses = [
    { Icon: Brush, text: m.home_uses_make() },
    { Icon: Camera, text: m.home_uses_photos() },
    { Icon: Call, text: m.home_uses_call() },
    { Icon: Briefcase, text: m.home_uses_work() },
    { Icon: ChartLine, text: m.home_uses_numbers() },
    { Icon: BookOpen, text: m.home_uses_learn() },
    { Icon: MusicNote, text: m.home_uses_music() },
    { Icon: Video, text: m.home_uses_video() },
  ];

  // The browser half: the extension, in the middle of the sentence, and the
  // store it is added from.
  const [socialBefore, socialAfter] = m
    .home_social_computer({ extension: LINK_SLOT })
    .split(LINK_SLOT);

  // The post the story links out to, in the middle of the sentence that tells
  // it, so the words around it keep their own order in every language.
  const [storyBefore, storyAfter] = m.home_story_path({ post: LINK_SLOT }).split(LINK_SLOT);

  // What the price buys, each with its tick.
  const promises = [
    m.home_how_promise_once(),
    m.home_how_promise_keep(),
    m.home_how_promise_trial(),
    m.home_how_promise_add(),
  ];

  const objections = [
    { desc: m.home_faq_screen_time_desc(), term: m.home_faq_screen_time_term() },
    { desc: m.home_faq_supervision_desc(), term: m.home_faq_supervision_term() },
    { desc: m.home_faq_trial_desc(), term: m.home_faq_trial_term() },
    { desc: m.home_faq_choice_desc(), term: m.home_faq_choice_term() },
    { desc: m.home_faq_data_desc(), term: m.home_faq_data_term() },
    { desc: m.home_faq_fail_desc(), term: m.home_faq_fail_term() },
    { desc: m.home_faq_see_desc(), term: m.home_faq_see_term() },
    { desc: m.home_faq_undo_desc(), term: m.home_faq_undo_term() },
    { desc: m.home_faq_mac_desc(), term: m.home_faq_mac_term() },
    { desc: m.home_faq_other_platforms_desc(), term: m.home_faq_other_platforms_term() },
    { desc: m.home_faq_who_desc(), term: m.home_faq_who_term() },
  ];

  return (
    <main {...props(styles.page)}>
      {/* The first screen: the claim, why willpower cannot win it, and the
      download with its price, beside the phone the feeds leave. */}
      <header {...props(styles.hero)}>
        <div {...props(styles.heroText)}>
          <h1 {...props(styles.displayTitle)}>
            {titleBefore}
            <span {...props(styles.heroAccent)}>{m.home_hero_title_accent()}</span>
            {titleAfter}
          </h1>
          <p {...props(styles.heroSub)}>{m.home_hero_sub()}</p>
          <div {...props(styles.heroAction)}>
            <MacDownload />
            <p {...props(styles.heroPrice)}>{m.home_hero_price()}</p>
          </div>
        </div>
        <HeroPhone />
      </header>

      <div {...props(styles.content)}>
        {/* What the phone is for once the feeds are off it: everything else
        it does, which is why the rest of it stays. */}
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_uses_title()}</h2>
          <ul {...props(styles.uses)}>
            {uses.map(({ Icon, text }) => (
              <li key={text} {...props(styles.use)}>
                <Icon aria-hidden="true" size={USE_ICON_SIZE} {...props(styles.useIcon)} />
                {text}
              </li>
            ))}
          </ul>
          <p {...props(styles.sectionBody)}>{m.home_uses_close()}</p>
        </section>

        {/* That it works: my own screen time before and after, what the hours
        went to instead, and one more person it worked for. */}
        <section {...props(styles.section, styles.anchor)} id={PROOF_ID}>
          <h2 {...props(styles.displayTitle, styles.stat)}>{m.home_proof_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_proof_lead()}</p>
          <ScreenShots
            caption={m.home_proof_caption()}
            shots={[
              // TODO(mert): replace with real screenshot
              {
                alt: m.home_proof_shot_before(),
                height: 640,
                todo: m.home_proof_shot_todo(),
                width: 800,
              },
              {
                alt: m.home_proof_shot_time(),
                height: 684,
                src: '/media/screentime-mert/mert-after-screen-time.webp',
                width: 800,
              },
              {
                alt: m.home_proof_shot_pickups(),
                height: 511,
                src: '/media/screentime-mert/mert-after-pickups.webp',
                width: 800,
              },
            ]}
          />
          <ScreenShots
            shots={[
              // TODO(mert): replace with real screenshot
              {
                alt: m.home_proof_shot_github(),
                height: 640,
                todo: m.home_proof_shot_todo(),
                width: 800,
              },
              // TODO(mert): replace with real screenshot
              {
                alt: m.home_proof_shot_claude(),
                height: 640,
                todo: m.home_proof_shot_todo(),
                width: 800,
              },
            ]}
          />
          <p {...props(styles.sectionBody)}>{m.home_proof_sister()}</p>
        </section>

        {/* Not against the networks, only their feeds, and the browser half
        of the same idea: the extension that takes the feeds off the computer. */}
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_social_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_social_body()}</p>
          <p {...props(styles.sectionBody)}>
            {socialBefore}
            <a href={STORE_URL} rel="noreferrer" target="_blank">
              {m.home_social_link()}
            </a>
            {socialAfter}
          </p>
        </section>

        {/* How it works: what the Mac app does, in three steps, what it costs
        and promises, and under it, past an or, the manual way that starts the
        phone over. */}
        <section {...props(styles.section, styles.anchor)} id={WAY_OUT_ID}>
          <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_how_lead()}</p>
          <HowItWorks />
          <div {...props(styles.offer)}>
            <div {...props(styles.offerHead)}>
              <p {...props(styles.offerPrice)}>{m.home_how_app_price()}</p>
              <ul {...props(styles.promises)}>
                {promises.map((promise) => (
                  <li key={promise} {...props(styles.promise)}>
                    <Check
                      aria-hidden="true"
                      size={CHECK_SIZE}
                      strokeWidth={CHEVRON_STROKE}
                      {...props(styles.promiseCheck)}
                    />
                    {promise}
                  </li>
                ))}
              </ul>
            </div>
            <MacDownload style={styles.downloadCentered} />
          </div>
          <p {...props(styles.or)}>{m.home_how_or()}</p>
          <div {...props(styles.diy)}>
            <p {...props(styles.diyLine)}>{m.home_how_diy()}</p>
            <Button render={<a href={GUIDE_URL} />} variant="outline">
              {m.home_how_diy_cta()}
            </Button>
          </div>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_faq_title()}</h2>
          <div>
            {objections.map((objection) => (
              <Question answer={objection.desc} key={objection.term} question={objection.term} />
            ))}
          </div>
        </section>

        {/* Who made this and why, told rather than argued. */}
        <section {...props(styles.section, styles.anchor)} id={STORY_ID}>
          <h2 {...props(styles.sectionTitle)}>{m.home_story_title()}</h2>
          <div {...props(styles.story)}>
            <p {...props(styles.storyLine)}>{m.home_story_people()}</p>
            <ScreenShots
              shots={[
                {
                  alt: m.home_story_shot_friend_1(),
                  height: 640,
                  src: '/media/screentime-friends/friend-1-week-sep-14.webp',
                  width: 800,
                },
                {
                  alt: m.home_story_shot_friend_2(),
                  height: 640,
                  src: '/media/screentime-friends/friend-2-week-sep-07.webp',
                  width: 800,
                },
              ]}
            />
            <p {...props(styles.storyLine)}>{m.home_story_attention()}</p>
            <p {...props(styles.storyLine)}>
              {storyBefore}
              <a href={STORY_URL} rel="noreferrer" target="_blank">
                {m.home_story_path_link()}
              </a>
              {storyAfter}
            </p>
            <Signature />
          </div>
        </section>

        <section {...props(styles.closing)}>
          <h2 {...props(styles.displayTitle)}>{m.home_close_title()}</h2>
          <MacDownload style={styles.downloadCentered} />
          <p {...props(styles.closingNote)}>
            <span>{m.home_how_app_price()}</span>
            <a href={GUIDE_URL}>{m.home_close_diy()}</a>
          </p>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
