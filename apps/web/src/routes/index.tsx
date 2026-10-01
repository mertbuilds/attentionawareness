import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, defaultMarker, props, when } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CostStory } from '../components/cost-story.tsx';
import { Facts } from '../components/facts.tsx';
import { HowItWorks } from '../components/how-it-works.tsx';
import { MacDownload } from '../components/mac-download.tsx';
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
/** The places on the page that can be linked to, and the ids they use. */
const COST_ID = 'cost';
const WAY_OUT_ID = 'way-out';
const STORY_ID = 'story';
const STORY_REST_ID = 'story-rest';
/** The manual way out, on a page of its own. */
const GUIDE_URL = '/guide';
/** Every link off this site carries utm tags, so the visit is traced to this page. */
const STORE_URL =
  'https://chromewebstore.google.com/detail/attention-awareness/lgcijcijcndmggjiioibfcmppndfakee?utm_source=attentionawareness.com&utm_medium=referral&utm_campaign=home';
/** The post this started from, linked out of the paragraph that tells it. */
const STORY_URL = 'https://stopa.io/post/297';
/**
 * Where a link or a figure stands inside a sentence. The message is written
 * with it as a placeholder and split on it, so the words around it keep their
 * own order and spacing in every language instead of being stitched from
 * pieces.
 */
const LINK_SLOT = '\u0000';

const styles = create({
  // Everything under the story, as one place the page can rest anywhere in.
  // It is taller than the window, so while the story holds the page to its
  // beats a find, a link or a focus that lands down here stays where it lands
  // instead of being pulled back to the story's foot.
  afterStory: {
    display: 'flex',
    flexDirection: 'column',
    gap: SECTION_GAP,
    scrollMarginBlockStart: SECTION_GAP,
    scrollSnapAlign: 'start',
  },
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
  // Set at the turn's size, so the page closes on the voice it turned in.
  closingTitle: {
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
  content: {
    display: 'flex',
    flexDirection: 'column',
    // Nothing is drawn between the sections, so the gap carries the rhythm on
    // its own at every width.
    gap: SECTION_GAP,
    maxWidth: 760,
    width: '100%',
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
  // Quieter than the question, and clear of the plus above it.
  faqText: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    paddingBlockEnd: spacing.s4,
    paddingInlineEnd: spacing.s8,
    textWrap: 'pretty',
  },
  // The plus at the end of the row. It waits in the muted ink and darkens when
  // the row is pointed at or its answer is open.
  faqPlus: {
    color: {
      default: colors.muted,
      [when.ancestor(':hover')]: colors.fg,
    },
    fill: 'none',
    flexShrink: 0,
    height: 16,
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeWidth: 1.5,
    width: 16,
  },
  faqPlusOpen: {
    color: colors.fg,
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
  // The upright stroke of the plus. It turns a quarter onto the level one and
  // fades as it goes, which leaves the minus.
  faqTurn: {
    opacity: 1,
    transform: 'none',
    transformBox: 'fill-box',
    transformOrigin: 'center',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.fast,
    },
    transitionProperty: 'opacity, transform',
    transitionTimingFunction: easing.smoothOut,
  },
  faqTurnOpen: {
    opacity: 0,
    transform: 'rotate(90deg)',
  },
  // Not on the page yet, and taking no room in it either.
  gone: {
    display: 'none',
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: SECTION_GAP,
    // The stacking context that keeps the story's grid above the page's own
    // background instead of behind it.
    isolation: 'isolate',
    minHeight: `calc(100vh - ${wip.height})`,
    // The story's grid runs the whole width of the window; anything past the
    // window's edge is cut, so nothing scrolls sideways. `clip` keeps the
    // story's stage sticky, where `hidden` would not.
    overflowX: 'clip',
    paddingBlockEnd: spacing.s16,
    paddingInline: spacing.s4,
    // The containing block the footer's graph paper measures itself against.
    position: 'relative',
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
  story: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 640,
  },
  // Ten paragraphs of prose, so the ink is pulled a step toward the page.
  storyLine: {
    color: `color-mix(in srgb, ${colors.fg} 80%, ${colors.bg})`,
    fontSize: 18,
    lineHeight: 1.7,
    margin: 0,
    textWrap: 'pretty',
  },
  // The way into the rest of the story, at the start of the line like the
  // paragraphs around it.
  storyMore: {
    alignSelf: 'flex-start',
  },
  // The part of the story behind the button, spaced like the part before it.
  storyRest: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  // Who wrote it, and from where. It is a signature, so it is the quietest
  // line in the section.
  storySign: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  // One of the two ways out: what it is, what it costs, what it does to the
  // phone, and the button at the foot, level with the other card's.
  way: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    padding: spacing.s6,
  },
  // The app is the way the page recommends, so its card carries the orange.
  wayAccent: {
    backgroundColor: `color-mix(in srgb, ${accent.base} 6%, ${colors.bg})`,
    borderColor: accent.base,
  },
  wayAction: {
    marginBlockStart: 'auto',
    paddingBlockStart: spacing.s2,
  },
  wayBody: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  wayHead: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
    justifyContent: 'space-between',
  },
  // What happens to the phone: the one difference between the two ways, so
  // it is the loudest line on each card.
  wayLead: {
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  wayPrice: {
    fontSize: font.sizeMd,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    margin: 0,
  },
  wayPriceAccent: {
    color: accent.base,
  },
  wayTitle: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
  },
  // The recommended way a little wider than the other, side by side once
  // there is room for both.
  ways: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'minmax(0, 6fr) minmax(0, 5fr)',
      default: 'minmax(0, 1fr)',
    },
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
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            {...props(styles.faqPlus, open && styles.faqPlusOpen)}
          >
            <line x1={3} x2={13} y1={8} y2={8} />
            <line
              x1={8}
              x2={8}
              y1={3}
              y2={13}
              {...props(styles.faqTurn, open && styles.faqTurnOpen)}
            />
          </svg>
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
  const storySection = useRef<HTMLElement>(null);
  const [storyOpen, setStoryOpen] = useState(false);

  // Folding the story from its last paragraph would leave the reader far
  // below it, so once it is folded the page goes back to where it starts.
  function toggleStory() {
    if (!storyOpen) {
      setStoryOpen(true);
      return;
    }
    flushSync(() => setStoryOpen(false));
    storySection.current?.scrollIntoView({ block: 'start' });
  }

  // The post the story links out to, in the middle of the sentence that tells
  // it, so the words around it keep their own order in every language.
  const [storyBefore, storyAfter] = m.home_story_1({ post: LINK_SLOT }).split(LINK_SLOT);

  // The browser half: the extension, in the middle of the sentence, and the
  // store it is added from.
  const [computerBefore, computerAfter] = m
    .home_computer_body({ extension: LINK_SLOT })
    .split(LINK_SLOT);

  const objections = [
    { desc: m.home_faq_supervision_desc(), term: m.home_faq_supervision_term() },
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
      <div {...props(styles.content)}>
        {/* Act one, the problem, and the first screen: what an average day
        adds up to, told one sentence a screen, and then whose doing it is. */}
        <CostStory id={COST_ID} />

        <div {...props(styles.afterStory)}>
          {/* Act two, the way out: how it works, in three steps, then the app
          that keeps the phone as it is and the manual way that starts it over. */}
          <section {...props(styles.section, styles.anchor)} id={WAY_OUT_ID}>
            <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
            <p {...props(styles.sectionBody)}>{m.home_how_body()}</p>
            <HowItWorks />
            <div {...props(styles.ways)}>
              <article {...props(styles.way, styles.wayAccent)}>
                <div {...props(styles.wayHead)}>
                  <h3 {...props(styles.wayTitle)}>{m.home_how_app_title()}</h3>
                  <p {...props(styles.wayPrice, styles.wayPriceAccent)}>{m.home_how_app_price()}</p>
                </div>
                <p {...props(styles.wayLead)}>{m.home_how_app_lead()}</p>
                <p {...props(styles.wayBody)}>{m.home_how_app_body()}</p>
                <p {...props(styles.wayBody)}>{m.home_how_app_fail()}</p>
                <div {...props(styles.wayAction)}>
                  <MacDownload />
                </div>
              </article>
              <article {...props(styles.way)}>
                <div {...props(styles.wayHead)}>
                  <h3 {...props(styles.wayTitle)}>{m.home_how_diy_title()}</h3>
                  <p {...props(styles.wayPrice)}>{m.home_how_diy_price()}</p>
                </div>
                <p {...props(styles.wayLead)}>{m.home_how_diy_lead()}</p>
                <p {...props(styles.wayBody)}>{m.home_how_diy_body()}</p>
                <div {...props(styles.wayAction)}>
                  <Button render={<a href={GUIDE_URL} />} variant="outline">
                    {m.home_how_diy_cta()}
                  </Button>
                </div>
              </article>
            </div>
          </section>

          <section {...props(styles.section)}>
            <h2 {...props(styles.sectionTitle)}>{m.home_facts_title()}</h2>
            <Facts />
          </section>

          {/* Act three, support. Who made this and why, told rather than argued:
          the only place on the page that speaks in the first person. */}
          <section {...props(styles.section, styles.anchor)} id={STORY_ID} ref={storySection}>
            <h2 {...props(styles.sectionTitle)}>{m.home_story_title()}</h2>
            <div {...props(styles.story)}>
              <p {...props(styles.storyLine)}>
                {storyBefore}
                <a href={STORY_URL} rel="noreferrer" target="_blank">
                  {m.home_story_2_link()}
                </a>
                {storyAfter}
              </p>
              <p {...props(styles.storyLine)}>{m.home_story_2()}</p>
              <p {...props(styles.storyLine)}>{m.home_story_3()}</p>
              {/* The button comes after the rest, so it stands under the third
              paragraph while the rest is folded and under the last once it is
              open, without ever leaving its place in the page. */}
              <div id={STORY_REST_ID} {...props(styles.storyRest, !storyOpen && styles.gone)}>
                <p {...props(styles.storyLine)}>{m.home_story_4()}</p>
                <p {...props(styles.storyLine)}>{m.home_story_5()}</p>
                <p {...props(styles.storyLine)}>{m.home_story_6()}</p>
                <p {...props(styles.storyLine)}>{m.home_story_7()}</p>
                <p {...props(styles.storyLine)}>{m.home_story_8()}</p>
                <p {...props(styles.storyLine)}>{m.home_story_9()}</p>
                <p {...props(styles.storyLine)}>{m.home_story_10()}</p>
              </div>
              <Button
                aria-controls={STORY_REST_ID}
                aria-expanded={storyOpen}
                onClick={toggleStory}
                style={styles.storyMore}
                variant="outline"
              >
                {storyOpen ? m.home_story_less() : m.home_story_more()}
              </Button>
              <p {...props(styles.storySign)}>{m.home_story_sign()}</p>
            </div>
          </section>

          {/* The browser half of the same idea, on its own so the way out reads
          as the phone and the computer as one more place the feeds are shut off. */}
          <section {...props(styles.section)}>
            <h2 {...props(styles.sectionTitle)}>{m.home_computer_title()}</h2>
            <p {...props(styles.sectionBody)}>
              {computerBefore}
              <a href={STORE_URL} rel="noreferrer" target="_blank">
                {m.home_computer_link()}
              </a>
              {computerAfter}
            </p>
          </section>

          <section {...props(styles.section)}>
            <h2 {...props(styles.sectionTitle)}>{m.home_faq_title()}</h2>
            <div>
              {objections.map((objection) => (
                <Question answer={objection.desc} key={objection.term} question={objection.term} />
              ))}
            </div>
          </section>

          <section {...props(styles.closing)}>
            <h2 {...props(styles.closingTitle)}>{m.home_close_title()}</h2>
            <MacDownload />
            <p {...props(styles.closingNote)}>
              <span>{m.home_how_app_price()}</span>
              <a href={GUIDE_URL}>{m.home_close_diy()}</a>
            </p>
          </section>

          <SiteFooter />
        </div>
      </div>
    </main>
  );
}
