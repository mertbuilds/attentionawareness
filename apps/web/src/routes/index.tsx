import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, defaultMarker, props, when } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { AngleDown, Check } from 'reicon-react';
import { ExtensionBrowser } from '../components/extension-browser.tsx';
import { GridTexture } from '../components/grid-texture.tsx';
import { HeroPhone } from '../components/hero-phone.tsx';
import { HowItWorks } from '../components/how-it-works.tsx';
import { MacDownload } from '../components/mac-download.tsx';
import { OtherUses } from '../components/other-uses.tsx';
import { ScreenShots } from '../components/screen-shots.tsx';
import { Signature } from '../components/signature.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { SupportSection } from '../components/support-section.tsx';
import { UsesGrid } from '../components/uses-grid.tsx';
import { brandBar } from '../lib/brand-bar.stylex.ts';
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
const HERO_PHONE_WIDTH = 272;
/** The places on the page that can be linked to, and the ids they use. */
const PROOF_ID = 'proof';
const WAY_OUT_ID = 'way-out';
const STORY_ID = 'story';
const FAQ_ID = 'faq';
/** The browser extension, the same idea on the computer. */
const EXTENSION_ID = 'extension';
/** The two ways, both free. Links from before the app was free still come down to it. */
const PRICING_ID = 'pricing';
/** Why everything is free and how to support the work, which the header's support link goes down to. */
const SUPPORT_ID = 'support';
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
/** A second orange word in the same sentence, told apart from the first. */
const SECOND_SLOT = '\u0001';
/** Both slots, kept when a sentence is split on them, so each word goes back where it stood. */
const SLOTS = new RegExp(`(${LINK_SLOT}|${SECOND_SLOT})`);
/** The chevron at the end of a question, in pixels. */
const CHEVRON_SIZE = 16;
/** A 1.5px line at that size, in the icon's own 24-unit grid. */
const CHEVRON_STROKE = 2.25;
/** The tick before a promise, in pixels, drawn with the chevron's line. */
const CHECK_SIZE = 16;

const styles = create({
  // A section the page links down to. The scroll stops short of its heading,
  // clear of the header strip over the top of the window.
  anchor: {
    scrollMarginBlockStart: `calc(${brandBar.height} + ${spacing.s6})`,
  },
  // The last word before the footer: one line, the download under it, then
  // its price and the guide, all in the middle of the column.
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
  // A phone's note and its button stand in the middle, under the words above
  // them.
  downloadCentered: {
    alignItems: 'center',
  },
  // The extension: its drawing beside what it does, and over it on a phone.
  extension: {
    alignItems: 'center',
    display: 'grid',
    gap: spacing.s8,
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'minmax(0, 11fr) minmax(0, 9fr)',
      default: 'minmax(0, 1fr)',
    },
  },
  // What it does, then the way to it and what it costs.
  extensionWords: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
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
  // The first screen: the claim, what makes it last and the download beside
  // the phone the feeds leave. Too narrow for two columns, the phone stands
  // under the words and the hero narrows to the column, so every left edge
  // lines up. It fills the window under the work-in-progress strip, so the
  // first section waits below the fold, and stands in the middle of the room
  // under the header. `svh` so a phone's collapsing toolbar does not move it,
  // `vh` where a browser has no `svh`.
  hero: {
    alignContent: 'center',
    alignItems: 'center',
    boxSizing: 'border-box',
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
    minHeight: {
      '@supports (height: 100svh)': `calc(100svh - ${wip.height})`,
      default: `calc(100vh - ${wip.height})`,
    },
    paddingBlockEnd: spacing.s12,
    // Clear of the header strip over the top of the window, and a step more.
    paddingBlockStart: `calc(${brandBar.height} + ${spacing.s12})`,
    rowGap: spacing.s12,
    width: '100%',
  },
  // A word a sentence turns on, in the one orange.
  accentWord: {
    color: accent.base,
  },
  // The download, and the price close under it.
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
  // Why it lasts, under the claim: the price box's ticked list, a step quieter.
  heroPromises: {
    color: colors.muted,
  },
  heroText: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
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
  // One way out: its name, what it is, what it keeps, then its button at the
  // foot, level with the other card's.
  plan: {
    alignItems: 'flex-start',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    padding: spacing.s6,
  },
  // The app is the way the page recommends, so its card carries the orange.
  planApp: {
    backgroundColor: `color-mix(in srgb, ${accent.base} 6%, ${colors.bg})`,
    borderColor: accent.base,
  },
  // The words of a card, held to a short measure where the card runs wide.
  planBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: '40ch',
  },
  // The button takes what height is left, so both stand at the foot.
  planButton: {
    marginBlockStart: 'auto',
  },
  // The name, and what it is close under it.
  planHead: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  // The app's price is in its card's orange.
  planPrice: {
    color: accent.base,
  },
  // The guide's ticks in the ink, so its card stays quiet.
  planQuietCheck: {
    color: colors.fg,
  },
  planSub: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  planTitle: {
    fontSize: font.sizeLg,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
  },
  // The two ways side by side, as tall as each other, where both fit; the app
  // first and the guide under it where they do not.
  plans: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'repeat(2, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
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
  // The promises stand as one block, their ticks in a column.
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
  // A closing said in two lines, one under the other.
  sectionLines: {
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
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

/** Promises in a list, each after its tick. */
function Promises({
  checkStyle,
  promises,
  style,
}: {
  checkStyle?: StyleXStyles;
  promises: ReadonlyArray<string>;
  style?: StyleXStyles;
}) {
  return (
    <ul {...props(styles.promises, style)}>
      {promises.map((promise) => (
        <li key={promise} {...props(styles.promise)}>
          <Check
            aria-hidden="true"
            size={CHECK_SIZE}
            strokeWidth={CHEVRON_STROKE}
            {...props(styles.promiseCheck, checkStyle)}
          />
          {promise}
        </li>
      ))}
    </ul>
  );
}

function HomePage() {
  // The word the claim turns on, wherever a language puts it, so the words
  // around it keep their own order in every language.
  const [titleBefore, titleAfter] = m.home_hero_title({ permanently: LINK_SLOT }).split(LINK_SLOT);

  // Why the lock lasts, each with its tick.
  const heroPromises = [
    m.home_hero_promise_install(),
    m.home_hero_promise_keep(),
    m.home_hero_promise_sticks(),
  ];

  // What the browser extension does, each with its tick.
  const extensionPoints = [
    m.home_ext_point_sites(),
    m.home_ext_point_accounts(),
    m.home_ext_point_custom(),
  ];

  // The post the story links out to, in the middle of the sentence that tells
  // it, so the words around it keep their own order in every language.
  const [storyBefore, storyAfter] = m.home_story_path({ post: LINK_SLOT }).split(LINK_SLOT);

  // The two words the story's turn rests on, in orange wherever a language
  // puts them in the sentence.
  const attentionWords = new Map([
    [LINK_SLOT, m.home_story_attention_aware()],
    [SECOND_SLOT, m.home_story_attention_attention()],
  ]);
  const attentionParts = m
    .home_story_attention({ attention: SECOND_SLOT, aware: LINK_SLOT })
    .split(SLOTS);

  // What the app gives, each with its tick.
  const promises = [
    m.home_how_promise_free(),
    m.home_how_promise_keep(),
    m.home_how_promise_trial(),
    m.home_how_promise_add(),
  ];

  // What the manual way is, each with its tick.
  const guidePromises = [
    m.home_how_guide_steps(),
    m.home_how_guide_free(),
    m.home_how_guide_erase(),
  ];

  // The word the closing line turns on, in orange wherever a language puts it.
  const [closeBefore, closeAfter] = m.home_close_title({ better: LINK_SLOT }).split(LINK_SLOT);

  const objections = [
    { desc: m.home_faq_free_desc(), term: m.home_faq_free_term() },
    { desc: m.home_faq_money_desc(), term: m.home_faq_money_term() },
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
  ];

  return (
    <main {...props(styles.page)}>
      {/* The graph paper the first screen stands on, fading out before the
      first section. */}
      <GridTexture />
      {/* The first screen: the claim, why it lasts, and the download with its
      price, next to the phone the feeds leave. */}
      <header {...props(styles.hero)}>
        <div {...props(styles.heroText)}>
          <h1 {...props(styles.displayTitle)}>
            {titleBefore}
            <span {...props(styles.accentWord)}>{m.home_hero_title_accent()}</span>
            {titleAfter}
          </h1>
          <Promises promises={heroPromises} style={styles.heroPromises} />
          <div {...props(styles.heroAction)}>
            <MacDownload placement="hero" />
            <p {...props(styles.heroPrice)}>{m.home_hero_price()}</p>
          </div>
        </div>
        <HeroPhone />
      </header>

      <div {...props(styles.content)}>
        {/* What the feeds take, and what the phone is for once they are off
        it: everything else it does, which is why the rest of it stays. */}
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_uses_title()}</h2>
          <UsesGrid />
          <p {...props(styles.sectionBody, styles.sectionLines)}>
            <span>{m.home_uses_kept()}</span>
            <span>{m.home_uses_gone()}</span>
          </p>
        </section>

        {/* How it works: what the Mac app does, in three steps, then the two
        ways to it, both free: the app, with what it keeps, and the guide that
        starts the phone over. */}
        <section {...props(styles.section, styles.anchor)} id={WAY_OUT_ID}>
          <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_how_lead()}</p>
          <HowItWorks />
          <div id={PRICING_ID} {...props(styles.plans, styles.anchor)}>
            <div {...props(styles.plan, styles.planApp)}>
              <div {...props(styles.planBody)}>
                <div {...props(styles.planHead)}>
                  <h3 {...props(styles.planTitle, styles.planPrice)}>{m.home_how_app_price()}</h3>
                  <p {...props(styles.planSub)}>{m.home_how_app_sub()}</p>
                </div>
                <Promises promises={promises} />
              </div>
              <MacDownload placement="pricing" style={styles.planButton} />
            </div>
            <div {...props(styles.plan)}>
              <div {...props(styles.planBody)}>
                <div {...props(styles.planHead)}>
                  <h3 {...props(styles.planTitle)}>{m.home_how_guide_title()}</h3>
                  <p {...props(styles.planSub)}>{m.home_how_guide_sub()}</p>
                </div>
                <Promises checkStyle={styles.planQuietCheck} promises={guidePromises} />
              </div>
              <Button render={<a href={GUIDE_URL} />} style={styles.planButton} variant="outline">
                {m.home_how_guide_cta()}
              </Button>
            </div>
          </div>
        </section>

        {/* That it works, once the way is told: the before in words, my own
        screen time after. */}
        <section {...props(styles.section, styles.anchor)} id={PROOF_ID}>
          <h2 {...props(styles.displayTitle)}>{m.home_proof_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_proof_lead()}</p>
          <ScreenShots
            caption={m.home_proof_caption()}
            shots={[
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
        </section>

        {/* What else the same setup blocks: any app or website, not only the
        feeds. */}
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_other_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_other_lead()}</p>
          <OtherUses />
        </section>

        {/* The same idea on the computer: the browser extension, what it
        hides on the three sites it knows, and how to add another. */}
        <section {...props(styles.section, styles.anchor)} id={EXTENSION_ID}>
          <h2 {...props(styles.sectionTitle)}>{m.home_ext_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_ext_lead()}</p>
          <div {...props(styles.extension)}>
            <ExtensionBrowser />
            <div {...props(styles.extensionWords)}>
              <Promises promises={extensionPoints} />
              <Button render={<a href={STORE_URL} rel="noreferrer" target="_blank" />}>
                {m.home_ext_cta()}
              </Button>
              <p {...props(styles.heroPrice)}>{m.home_ext_note()}</p>
            </div>
          </div>
        </section>

        {/* Why everything is free, and the way to support the work, in a box
        of its own. */}
        <section {...props(styles.anchor)} id={SUPPORT_ID}>
          <SupportSection titleStyle={styles.displayTitle} />
        </section>

        {/* Not against the networks, only their feeds. */}
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_social_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_social_body()}</p>
        </section>

        <section {...props(styles.section, styles.anchor)} id={FAQ_ID}>
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
              ]}
            />
            <p {...props(styles.storyLine)}>
              {attentionParts.map((part) => {
                const word = attentionWords.get(part);
                return word === undefined ? (
                  part
                ) : (
                  <span key={part} {...props(styles.accentWord)}>
                    {word}
                  </span>
                );
              })}
            </p>
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
          <h2 {...props(styles.displayTitle)}>
            {closeBefore}
            <span {...props(styles.accentWord)}>{m.home_close_title_accent()}</span>
            {closeAfter}
          </h2>
          <MacDownload placement="closing" style={styles.downloadCentered} />
          <p {...props(styles.closingNote)}>
            <span>{m.home_hero_price()}</span>
            <a href={GUIDE_URL}>{m.home_close_diy()}</a>
          </p>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
