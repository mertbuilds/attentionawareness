import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CostStory } from '../components/cost-story.tsx';
import { Facts } from '../components/facts.tsx';
import { MacDownload } from '../components/mac-download.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { Turn } from '../components/turn.tsx';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/**
 * Every section heading on the page. It is not a token
 * because the scale holds three weights and this is the fourth: Suisse Intl
 * ships 400, 500 and 700, so a 600 lands on its bold face and on a true
 * semibold in the Inter Variable fallback.
 */
const HEADING_WEIGHT = 600;
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
  defDesc: {
    color: colors.muted,
    lineHeight: 1.5,
    marginBlockEnd: spacing.s3,
    marginInlineStart: 0,
    textWrap: 'pretty',
  },
  defList: {
    margin: 0,
  },
  defTerm: {
    fontWeight: font.weightMedium,
    lineHeight: 1.5,
    textWrap: 'pretty',
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
    fontWeight: HEADING_WEIGHT,
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
    fontWeight: HEADING_WEIGHT,
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
        <Turn />

        {/* Act two, the way out: the app that keeps the phone as it is, and
        the manual way that starts it over. */}
        <section {...props(styles.section, styles.anchor)} id={WAY_OUT_ID}>
          <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_how_body()}</p>
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
          <h2 {...props(styles.sectionTitle)}>{m.home_facts_title()}</h2>
          <Facts />
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_faq_title()}</h2>
          <dl {...props(styles.defList)}>
            {objections.map((objection) => (
              <div key={objection.term}>
                <dt {...props(styles.defTerm)}>{objection.term}</dt>
                <dd {...props(styles.defDesc)}>{objection.desc}</dd>
              </div>
            ))}
          </dl>
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
    </main>
  );
}
