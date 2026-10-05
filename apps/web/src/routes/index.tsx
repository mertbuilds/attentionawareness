import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, defaultMarker, props, when } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useId, useState } from 'react';
import type { ComponentProps, FC } from 'react';
import { AngleDown, Check } from 'reicon-react';
import { PaperLetter } from '../components/bill-paper.tsx';
import { ExtensionBrowser } from '../components/extension-browser.tsx';
import { ANSWER_LINK, FaqAnswer } from '../components/faq-answer.tsx';
import type { AnswerBlock } from '../components/faq-answer.tsx';
import { GridTexture } from '../components/grid-texture.tsx';
import { HeroPhone } from '../components/hero-phone.tsx';
import { HowItWorks } from '../components/how-it-works.tsx';
import { MacDownload } from '../components/mac-download.tsx';
import { OtherUses } from '../components/other-uses.tsx';
import { ScreenShots } from '../components/screen-shots.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { SupportSection } from '../components/support-section.tsx';
import type { ThanksPopup as ThanksPopupComponent } from '../components/thanks-popup.tsx';
import { UsesGrid } from '../components/uses-grid.tsx';
import { posthog } from '../lib/analytics.ts';
import { brandBar } from '../lib/brand-bar.stylex.ts';
import { duration, easing } from '../lib/motion.stylex.ts';
import { SECTION } from '../lib/sections.ts';
import { homeSchema, schemaMeta } from '../lib/structured-data.ts';
import { m } from '../paraglide/messages.js';

/**
 * The thank-you is fetched only for a reader the support checkout sends back.
 * A chunk that does not load leaves no popup.
 */
const ThanksPopup = lazy(
  (): Promise<{ default: FC<ComponentProps<typeof ThanksPopupComponent>> }> =>
    import('../components/thanks-popup.tsx').then(
      (popup) => ({ default: popup.ThanksPopup }),
      () => ({ default: () => null }),
    ),
);

export const Route = createFileRoute('/')({
  component: HomePage,
  // The site, the Mac app and the questions below, as data a search engine reads.
  head: () => ({
    meta: [
      { title: `${m.home_head_title()} · ${SITE_NAME}` },
      schemaMeta(
        homeSchema({
          description: m.home_meta_description(),
          name: SITE_NAME,
          questions: homeQuestions(),
        }),
      ),
    ],
  }),
  // The support checkout sends the reader back with `thanks=1`, among marks
  // of its own. Nothing else on the address means anything to the page.
  validateSearch: (search: Record<string, unknown>): { thanks?: 1 } =>
    search['thanks'] === 1 || search['thanks'] === '1' ? { thanks: 1 } : {},
});

/**
 * The air between two sections, wider than anything inside one. The 4px scale
 * stops at 64px, and one idea per screen needs more than that between two of
 * them, so the page's widest gap is the one measure written out here.
 */
const SECTION_GAP = '96px';
/** The column every section stands in, and the first screen too once it is stacked. */
const COLUMN_WIDTH = 760;
/** The sign-off's lines: the name before its first comma, the place and date after it. */
function signLines(text: string): Array<string> {
  const comma = text.indexOf(',');
  return comma === -1 ? [text] : [text.slice(0, comma).trim(), text.slice(comma + 1).trim()];
}
/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
/** The question about losing data, which the line under the download goes to. */
const FAQ_DATA_ID = 'faq-data';
/** The id the download's section had, kept as an empty anchor for old links. */
const OLD_DOWNLOAD_ID = 'pricing';
/** The extension's privacy page. */
const EXTENSION_PRIVACY_PATH = '/extension/privacy';
/**
 * The face the letter is typed in: Special Elite, a worn typewriter's, which
 * the site serves itself, then a typewriter face the reader's own system has.
 */
const LETTER_FACE = "'Special Elite', 'Courier New', ui-monospace, monospace";
/**
 * The first screen side by side: wider than the column, so the words keep a
 * readable measure next to the phone.
 */
const HERO_WIDTH = 1040;
/** The phone's column beside the words, as wide as the phone is drawn there. */
const HERO_PHONE_WIDTH = 272;
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

/** The hero's paper is centred on the hero, reaches toward its edges and is gone before the corners. */
const HERO_PAPER_MASK = 'radial-gradient(ellipse at 50% 45%, black 40%, transparent 92%)';
/** The closing's paper fades out from behind the line and the button. */
const CLOSING_PAPER_MASK = 'radial-gradient(ellipse at 50% 42%, black 25%, transparent 68%)';

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
    // The box the closing's graph paper measures itself against. No z-index,
    // so the paper still goes under the page's own stacking, as the hero's does.
    position: 'relative',
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
  // The hero's graph paper: its squares are centred on the page, and it is
  // clearest in the middle of the hero and gone before the sides.
  heroPaper: {
    backgroundPosition: 'center top',
    maskImage: HERO_PAPER_MASK,
    WebkitMaskImage: HERO_PAPER_MASK,
  },
  // The hero's graph paper again behind the last word: the window's whole
  // width, from the page's own left edge so its squares line up with the
  // footer's, a step past the section at the top and the foot, clearest
  // behind the line and the button and gone before any edge.
  closingPaper: {
    height: 'auto',
    insetBlock: `calc(-1 * ${spacing.s8})`,
    insetInline: 'calc(50% - 50vw)',
    maskImage: CLOSING_PAPER_MASK,
    WebkitMaskImage: CLOSING_PAPER_MASK,
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
  // The extension's three parts, a step further apart than the lines inside
  // each: what it is and the way to it, the drawing, then what it does.
  extension: {
    gap: spacing.s8,
  },
  // The way to it, on one line with what it costs, right under the lead.
  extensionAction: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
  },
  // The title, the lead and the action, close together as one block.
  extensionHead: {
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
  // What the track cuts off while it is short. Only the track moves: a fade
  // or a blur here makes the text a layer of its own, and Safari on iOS
  // draws that layer a pixel higher or lower in each frame of the growth.
  faqClip: {
    minHeight: 0,
    overflow: 'hidden',
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
  // The chevron at the end of the row. It waits in the muted ink, pointing
  // down, and darkens when the row is pointed at; an open answer turns it
  // over to point up.
  faqChevron: {
    color: {
      default: colors.muted,
      [when.ancestor(':hover')]: {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
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
      '@supports (height: 100svh)': '100svh',
      default: '100vh',
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
    minHeight: '100vh',
    // Anything past the window's edge is cut, so nothing scrolls sideways.
    overflowX: 'clip',
    paddingBlockEnd: spacing.s16,
    paddingInline: spacing.s4,
    // The containing block the footer's graph paper measures itself against.
    position: 'relative',
  },
  // The sheet the story is written on: the column's width, with room around
  // the words, less of it on a phone. Everything on it is typed. The face has
  // one weight, so nothing on the sheet is thickened to make a bolder one.
  letter: {
    boxSizing: 'border-box',
    fontFamily: LETTER_FACE,
    fontSynthesis: 'none',
    paddingBlock: {
      '@media (min-width: 640px)': spacing.s12,
      default: spacing.s8,
    },
    paddingInline: {
      '@media (min-width: 640px)': spacing.s12,
      default: spacing.s6,
    },
  },
  // The letter's title stands in the middle of the sheet, in the typewriter's
  // one weight, half as large again as the lines. What is written under it
  // starts at the left, as a letter does.
  letterTitle: {
    fontSize: {
      '@media (min-width: 640px)': 28,
      default: 25,
    },
    fontWeight: font.weightRegular,
    letterSpacing: 'normal',
    textAlign: 'center',
  },
  // The way out: the app's card, in the orange the page recommends it by.
  // Its name, what it is and what it keeps, with its button and the line
  // about backing up beside them at the card's foot on a wide window, and
  // under them on a narrow one.
  plan: {
    alignItems: {
      '@media (min-width: 768px)': 'end',
      default: 'start',
    },
    backgroundColor: `color-mix(in srgb, ${accent.base} 6%, ${colors.bg})`,
    borderColor: accent.base,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'grid',
    gap: spacing.s6,
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'minmax(0, 1fr) auto',
      default: 'minmax(0, 1fr)',
    },
    padding: spacing.s6,
    position: 'relative',
  },
  // The words of a card, held to a short measure where the card runs wide.
  planBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: '40ch',
  },
  // The card's button with the line about backing up under it.
  planFoot: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    maxWidth: '32ch',
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
  // A mark at the top of the card that holds it, taking no room there.
  outOfFlow: {
    insetBlockStart: 0,
    position: 'absolute',
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
  // A line of the sign-off, on a line of its own.
  signLine: {
    display: 'block',
  },
  // The sign-off stands at the end of the line, under the letter it closes,
  // a step clear of its last paragraph. Its lines start under one another.
  signOff: {
    alignSelf: 'flex-end',
    marginBlockStart: spacing.s4,
    maxWidth: '100%',
  },
  story: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 640,
  },
  // Paragraphs of prose, so the ink is pulled a step toward the page. Typed
  // at a size that sets about 65 letters to a line where the sheet is at its
  // full width.
  storyLine: {
    color: `color-mix(in srgb, ${colors.fg} 80%, ${colors.bg})`,
    fontSize: {
      '@media (min-width: 640px)': 19,
      default: 17,
    },
    lineHeight: 1.6,
    margin: 0,
    textWrap: 'pretty',
  },
});

/** The questions that can be asked for by name, each told when one is. */
const askers = new Set<(anchor: string) => void>();

/** Opens the question with that anchor, as a link to it does when pressed. */
function askQuestion(anchor: string) {
  for (const asker of askers) {
    asker(anchor);
  }
}

/**
 * One question, closed until it is pressed. Its answer opens under it and
 * leaves the others as they are, so two can be read at once. A closed answer
 * is inert: out of the tab order and unread by a screen reader, though it
 * stays in the page to animate.
 */
function Question({
  anchor,
  answer,
  question,
}: {
  /** The id a link elsewhere on the page goes to. Gone to, the answer opens. */
  anchor?: string | undefined;
  answer: ReadonlyArray<AnswerBlock>;
  question: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (anchor === undefined) {
      return;
    }
    const openIfHere = () => {
      if (window.location.hash === `#${anchor}`) {
        setOpen(true);
      }
    };
    // A link to it that is pressed asks for it by name: with the address
    // already here, the press changes nothing the browser would tell of.
    const openIfAsked = (asked: string) => {
      if (asked === anchor) {
        setOpen(true);
      }
    };
    openIfHere();
    window.addEventListener('hashchange', openIfHere);
    askers.add(openIfAsked);
    return () => {
      window.removeEventListener('hashchange', openIfHere);
      askers.delete(openIfAsked);
    };
  }, [anchor]);
  const questionId = `${id}-question`;
  const answerId = `${id}-answer`;

  return (
    <div id={anchor} {...props(styles.faqItem, anchor !== undefined && styles.anchor)}>
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
        <div {...props(styles.faqClip)}>
          <FaqAnswer blocks={answer} />
        </div>
      </div>
    </div>
  );
}

/** An answer's block of a sentence or two. */
function text(words: string): AnswerBlock {
  return { kind: 'text', text: words };
}

/** An answer's list, one item under another, under its name if it has one. */
function dots(items: ReadonlyArray<string>, label?: string): AnswerBlock {
  return { items, kind: 'list', label, mark: 'dot' };
}

/** Promises in a list, each after its tick. */
function Promises({ promises, style }: { promises: ReadonlyArray<string>; style?: StyleXStyles }) {
  return (
    <ul {...props(styles.promises, style)}>
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
  );
}

/**
 * The questions in the order a new visitor asks them, each answer block
 * under block. The page draws them, and its head tells search engines the
 * same ones.
 */
function homeQuestions(): ReadonlyArray<{
  anchor?: string;
  answer: ReadonlyArray<AnswerBlock>;
  question: string;
}> {
  return [
    {
      answer: [text(m.home_faq_free_a1()), text(m.home_faq_free_a2())],
      question: m.home_faq_free_term(),
    },
    {
      answer: [text(m.home_faq_screen_time_a1()), text(m.home_faq_screen_time_a2())],
      question: m.home_faq_screen_time_term(),
    },
    {
      answer: [text(m.home_faq_supervision_a1()), text(m.home_faq_supervision_a2())],
      question: m.home_faq_supervision_term(),
    },
    {
      answer: [
        text(m.home_faq_needs_a1()),
        dots([
          m.home_faq_needs_item_friend(),
          m.home_faq_needs_item_phone(),
          m.home_faq_needs_item_copy(),
        ]),
      ],
      question: m.home_faq_needs_term(),
    },
    {
      answer: [
        text(m.home_faq_ios27_a1()),
        text(m.home_faq_ios27_a2()),
        {
          kind: 'text',
          link: {
            href: '/blog/supervise-iphone-ios-27-without-erasing',
            label: m.home_faq_ios27_a3_link(),
          },
          text: m.home_faq_ios27_a3({ post: ANSWER_LINK }),
        },
        text(m.home_faq_ios27_a4()),
      ],
      question: m.home_faq_ios27_term(),
    },
    {
      anchor: FAQ_DATA_ID,
      answer: [
        text(m.home_faq_data_a1()),
        {
          kind: 'path',
          label: m.home_faq_data_icloud(),
          steps: [
            m.home_faq_data_icloud_settings(),
            m.home_faq_data_icloud_name(),
            m.home_faq_data_icloud_icloud(),
            m.home_faq_data_icloud_backup(),
            m.home_faq_data_back_up_now(),
          ],
        },
        {
          kind: 'path',
          label: m.home_faq_data_finder(),
          steps: [
            m.home_faq_data_finder_connect(),
            m.home_faq_data_finder_select(),
            m.home_faq_data_back_up_now(),
          ],
        },
        {
          items: [
            m.home_faq_data_stays_photos(),
            m.home_faq_data_stays_messages(),
            m.home_faq_data_stays_logins(),
            m.home_faq_data_stays_health(),
          ],
          kind: 'list',
          label: m.home_faq_data_stays(),
          mark: 'check',
        },
        text(m.home_faq_data_changes()),
        dots([m.home_faq_data_before_find_my()], m.home_faq_data_before()),
      ],
      question: m.home_faq_data_term(),
    },
    { answer: [text(m.home_faq_time_a1())], question: m.home_faq_time_term() },
    {
      answer: [text(m.home_faq_fail_a1()), text(m.home_faq_fail_a2())],
      question: m.home_faq_fail_term(),
    },
    {
      answer: [text(m.home_faq_trial_a1()), text(m.home_faq_trial_a2())],
      question: m.home_faq_trial_term(),
    },
    {
      answer: [
        text(m.home_faq_undo_a1()),
        dots([m.home_faq_undo_item_erase(), m.home_faq_undo_item_configurator()]),
        text(m.home_faq_undo_a2()),
      ],
      question: m.home_faq_undo_term(),
    },
    {
      answer: [
        text(m.home_faq_apps_a1()),
        dots([m.home_faq_apps_item_store(), m.home_faq_apps_item_rest()]),
      ],
      question: m.home_faq_apps_term(),
    },
    {
      answer: [text(m.home_faq_see_a1()), text(m.home_faq_see_a2())],
      question: m.home_faq_see_term(),
    },
    {
      answer: [
        text(m.home_faq_source_a1()),
        dots([m.home_faq_source_item_mac(), m.home_faq_source_item_rest()]),
      ],
      question: m.home_faq_source_term(),
    },
    {
      answer: [
        {
          kind: 'text',
          link: { href: '/guide', label: m.home_faq_manual_a1_link() },
          text: m.home_faq_manual_a1({ guide: ANSWER_LINK }),
        },
        text(m.home_faq_manual_a2()),
      ],
      question: m.home_faq_manual_term(),
    },
    {
      answer: [text(m.home_faq_other_platforms_a1()), text(m.home_faq_other_platforms_a2())],
      question: m.home_faq_other_platforms_term(),
    },
  ];
}

function HomePage() {
  const { thanks } = Route.useSearch();
  // Kept for the visit: the popup takes the mark off the address as it opens.
  const [thanked] = useState(thanks === 1);
  const navigate = Route.useNavigate();
  // The two words the claim turns on, in orange wherever a language puts
  // them, so the words around them keep their own order in every language.
  const titleWords = new Map([
    [LINK_SLOT, m.home_hero_title_distraction()],
    [SECOND_SLOT, m.home_hero_title_accent()],
  ]);
  const titleParts = m
    .home_hero_title({ distraction: LINK_SLOT, permanently: SECOND_SLOT })
    .split(SLOTS);

  // Why the lock lasts, each with its tick.
  const heroPromises = [
    m.home_hero_promise_install(),
    m.home_hero_promise_keep(),
    m.home_hero_promise_sticks(),
  ];

  // What the browser extension does: a short name each, and a line under it.
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

  // The word the closing line turns on, in orange wherever a language puts it.
  const [closeBefore, closeAfter] = m.home_close_title({ better: LINK_SLOT }).split(LINK_SLOT);

  const questions = homeQuestions();

  return (
    <main {...props(styles.page)}>
      {/* The graph paper the first screen stands on, fading out before the
      first section. */}
      <GridTexture style={styles.heroPaper} />
      {/* The first screen: the claim, why it lasts, and the download with its
      price, next to the phone the feeds leave. */}
      <header {...props(styles.hero)}>
        <div {...props(styles.heroText)}>
          <h1 {...props(styles.displayTitle)}>
            {titleParts.map((part) => {
              const word = titleWords.get(part);
              return word === undefined ? (
                part
              ) : (
                <span key={part} {...props(styles.accentWord)}>
                  {word}
                </span>
              );
            })}
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

        {/* How it works: what the Mac app does, in three steps, then the app
        itself, free, with what it keeps and its download. */}
        <section {...props(styles.section, styles.anchor)} id={SECTION.wayOut}>
          <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_how_lead()}</p>
          <HowItWorks />
          <div id={SECTION.download} {...props(styles.plan, styles.anchor)}>
            {/* Where links from before the two ways were named the download
            still land. Out of the card's grid, so it takes no cell. */}
            <span id={OLD_DOWNLOAD_ID} {...props(styles.anchor, styles.outOfFlow)} />
            <div {...props(styles.planBody)}>
              <div {...props(styles.planHead)}>
                <h3 {...props(styles.planTitle, styles.planPrice)}>{m.home_how_app_price()}</h3>
                <p {...props(styles.planSub)}>{m.home_how_app_sub()}</p>
              </div>
              <Promises promises={promises} />
            </div>
            <div {...props(styles.planFoot)}>
              <MacDownload placement="download" />
              <p {...props(styles.planSub)}>
                <a href={`#${FAQ_DATA_ID}`} onClick={() => askQuestion(FAQ_DATA_ID)}>
                  {m.home_how_backup_note_link()}
                </a>
                {m.home_how_backup_note({ link: LINK_SLOT }).split(LINK_SLOT)[1]}
              </p>
            </div>
          </div>
        </section>

        {/* That it works, once the way is told: the before in words, my own
        screen time after. */}
        <section {...props(styles.section, styles.anchor)} id={SECTION.proof}>
          <h2 {...props(styles.sectionTitle)}>{m.home_proof_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_proof_lead()}</p>
          <ScreenShots
            caption={m.home_proof_caption()}
            shots={[
              {
                alt: m.home_proof_shot_time(),
                height: 672,
                padded: true,
                src: '/media/screentime-mert/mert-after-screen-time.webp',
                width: 800,
              },
              {
                alt: m.home_proof_shot_pickups(),
                height: 672,
                padded: true,
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

        {/* The same idea on the computer: the browser extension and the way
        to it, then the drawing of what it hides on the three sites it knows,
        with what it does on each under it. */}
        <section {...props(styles.section, styles.extension, styles.anchor)} id={SECTION.extension}>
          <div {...props(styles.extensionHead)}>
            <h2 {...props(styles.sectionTitle)}>{m.home_ext_title()}</h2>
            <p {...props(styles.sectionBody)}>{m.home_ext_lead()}</p>
            <div {...props(styles.extensionAction)}>
              <Button
                aria-label={m.home_ext_cta_label()}
                onClick={() =>
                  posthog.capture('extension_install_clicked', { placement: 'extension_section' })
                }
                render={<a href={STORE_URL} rel="noreferrer" target="_blank" />}
              >
                {m.home_ext_cta()}
              </Button>
              <p {...props(styles.heroPrice)}>
                <a href={EXTENSION_PRIVACY_PATH}>{m.home_ext_privacy()}</a>
              </p>
            </div>
          </div>
          <ExtensionBrowser />
        </section>

        {/* Why everything is free, and the way to support the work: the
        founder's words beside a stamp, like the corner of an envelope. */}
        <section {...props(styles.anchor)} id={SECTION.support}>
          <SupportSection titleStyle={styles.displayTitle} />
        </section>

        {/* Who made this and why, told rather than argued: a letter on a
        sheet of paper, signed at its foot. */}
        <section {...props(styles.anchor)} id={SECTION.story}>
          <PaperLetter ink={styles.section} style={styles.letter}>
            <h2 {...props(styles.sectionTitle, styles.letterTitle)}>{m.home_story_title()}</h2>
            <div {...props(styles.story)}>
              <p {...props(styles.storyLine)}>{m.home_story_people()}</p>
              <ScreenShots
                caption={m.home_story_shot_caption()}
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
              {/* Not against the networks, only what their feeds take. */}
              <p {...props(styles.storyLine)}>{m.home_story_social()}</p>
              <p {...props(styles.storyLine)}>
                {storyBefore}
                <a href={STORY_URL} rel="noreferrer" target="_blank">
                  {m.home_story_path_link()}
                </a>
                {storyAfter}
              </p>
              {/* The sign-off, typed: the name, then the place and date under it. */}
              <p {...props(styles.storyLine, styles.signOff)}>
                {signLines(m.home_story_sign()).map((line) => (
                  <span key={line} {...props(styles.signLine)}>
                    {line}
                  </span>
                ))}
              </p>
            </div>
          </PaperLetter>
        </section>

        {/* The questions, last of the sections: after them only the line the
        page closes on. */}
        <section {...props(styles.section, styles.anchor)} id={SECTION.faq}>
          <h2 {...props(styles.sectionTitle)}>{m.home_faq_title()}</h2>
          <div>
            {questions.map((entry) => (
              <Question
                anchor={entry.anchor}
                answer={entry.answer}
                key={entry.question}
                question={entry.question}
              />
            ))}
          </div>
        </section>

        <section {...props(styles.closing)}>
          <GridTexture style={styles.closingPaper} />
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
      {thanked ? (
        <Suspense fallback={null}>
          <ThanksPopup
            // The mark goes off the address, in place: the page stays where it is.
            onShown={() => void navigate({ replace: true, resetScroll: false, search: {} })}
            show={thanks === 1}
          />
        </Suspense>
      ) : null}
    </main>
  );
}
