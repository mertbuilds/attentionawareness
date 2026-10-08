import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, defaultMarker, props, when } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense, useId, useState } from 'react';
import type { ComponentProps, FC } from 'react';
import { AngleDown, Check } from 'reicon-react';
import { PaperLetter } from '../components/bill-paper.tsx';
import { ExtensionBrowser } from '../components/extension-browser.tsx';
import { ExtensionCta } from '../components/extension-cta.tsx';
import { ANSWER_LINK, FaqAnswer } from '../components/faq-answer.tsx';
import type { AnswerBlock } from '../components/faq-answer.tsx';
import { GridTexture } from '../components/grid-texture.tsx';
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
import { REPO_URL } from '../lib/github.ts';
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
          questions: [...objectionQuestions(), ...homeQuestions()],
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
/** The column every section stands in. */
const COLUMN_WIDTH = 760;
/** The sign-off's lines: the name before its first comma, the place and date after it. */
function signLines(text: string): Array<string> {
  const comma = text.indexOf(',');
  return comma === -1 ? [text] : [text.slice(0, comma).trim(), text.slice(comma + 1).trim()];
}
/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
/** The id the download's section had, kept as an empty anchor for old links. */
const OLD_DOWNLOAD_ID = 'pricing';
/**
 * The face the letter is typed in: Special Elite, a worn typewriter's, which
 * the site serves itself, then a typewriter face the reader's own system has.
 */
const LETTER_FACE = "'Special Elite', 'Courier New', ui-monospace, monospace";
/** The first screen: wider than the column, so the claim's first line stays whole on a computer. */
const HERO_WIDTH = 1160;
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
/** The arrow after the link to the source code, in pixels: its words' size. */
const SOURCE_ARROW_SIZE = 14;
/**
 * The arrow in its 24-unit grid, on a square from `from` to `to` with the
 * arrow's point at its top right corner. Each leg of the head runs `leg`
 * along a side from that corner, nearly the whole side. The shaft runs down
 * the diagonal from it for `shaft` along each side, 85% of the diagonal.
 */
const SOURCE_ARROW = { from: 6, leg: 11, shaft: 10.2, to: 18 };
/**
 * How far the arrow's middle stands right of and above the middle of that
 * grid. Its box is moved by as much, so the arrow is in the middle of it.
 */
const SOURCE_ARROW_OFF = SOURCE_ARROW.to - SOURCE_ARROW.leg / 2 - 12;
/** The tick's 1.5px line, in the arrow's grid at the arrow's size. */
const SOURCE_ARROW_STROKE = (CHEVRON_STROKE * CHECK_SIZE) / SOURCE_ARROW_SIZE;

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
  // its price, all in the middle of the column.
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
    fontSize: font.sizeSm,
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
  // A download's button stands in the middle, under the words above it.
  downloadCentered: {
    alignItems: 'center',
  },
  // The extension's three parts, a step further apart than the lines inside
  // each: what it is and the way to it, the drawing, then what it does.
  extension: {
    gap: spacing.s8,
  },
  // The way to it, right under the lead and no wider than its words.
  extensionAction: {
    display: 'flex',
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
  // The first screen, words only, in one column down the middle: the claim,
  // what the product is, the two buttons and the price. It has room over and
  // under it, but not a whole screen: the top of how it works shows at the
  // foot of a laptop's window.
  hero: {
    alignItems: 'center',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: HERO_WIDTH,
    paddingBlockEnd: spacing.s8,
    // Clear of the header strip over the top of the window, and wide air
    // under it before the claim: two of the scale's largest steps, one on a
    // phone.
    paddingBlockStart: {
      '@media (min-width: 640px)': `calc(${brandBar.height} + 2 * ${spacing.s16})`,
      default: `calc(${brandBar.height} + ${spacing.s16})`,
    },
    width: '100%',
  },
  // A word a sentence turns on, in the one orange.
  accentWord: {
    color: accent.base,
  },
  // The claim's last word stands on a line of its own: no full stop parts it
  // from the words before it.
  accentLine: {
    display: 'block',
  },
  // The two buttons, and the price close under them.
  heroAction: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  // The download first, the way down to how it works beside it. They stay in
  // the middle, and the second goes under the first where both do not fit.
  heroButtons: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
    justifyContent: 'center',
  },
  // What the product is, in one line under the claim: larger than the
  // page's prose, far smaller than the claim.
  heroLead: {
    fontSize: font.sizeLg,
    fontWeight: font.weightRegular,
    lineHeight: 1.4,
    margin: 0,
    textWrap: 'balance',
  },
  heroPrice: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  // The hero's words, each line in the middle of the hero.
  heroText: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    textAlign: 'center',
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
  // Its name, what it is, what it keeps and its button, one under the other
  // down the middle. The card is as wide as its words and stands in the
  // middle of the column.
  plan: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: `color-mix(in srgb, ${accent.base} 6%, ${colors.raised})`,
    borderColor: accent.base,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    maxWidth: '100%',
    paddingBlock: spacing.s8,
    paddingInline: {
      '@media (min-width: 768px)': spacing.s12,
      default: spacing.s6,
    },
    position: 'relative',
  },
  // The name, and what it is close under it.
  planHead: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    textAlign: 'center',
  },
  // The way to the source code: its words and the arrow after them, on one
  // line, with no line under them. Quiet at rest, it steps to the page's ink
  // under a pointer, and wears the ring every link wears under the keyboard.
  planLink: {
    alignItems: 'center',
    borderRadius: 2,
    color: {
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
      default: colors.muted,
    },
    display: 'inline-flex',
    gap: spacing.s1,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    textDecorationLine: 'none',
    transitionDuration: duration.quick,
    transitionProperty: 'color',
    transitionTimingFunction: easing.out,
    whiteSpace: 'nowrap',
  },
  planLinkArrow: {
    flexShrink: 0,
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

/**
 * The arrow after the link to the source code, up and to the right: a short
 * way down a square's diagonal from its top right corner, and the two sides
 * that meet at that corner, each cut a little short.
 */
function SourceArrow() {
  const { from, leg, shaft, to } = SOURCE_ARROW;
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={SOURCE_ARROW_SIZE}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={SOURCE_ARROW_STROKE}
      viewBox={`${SOURCE_ARROW_OFF} ${-SOURCE_ARROW_OFF} 24 24`}
      width={SOURCE_ARROW_SIZE}
      {...props(styles.planLinkArrow)}
    >
      <path
        d={`M${(to - shaft).toFixed(1)} ${(from + shaft).toFixed(1)}L${to} ${from}M${to - leg} ${from}H${to}V${from + leg}`}
      />
    </svg>
  );
}

/**
 * One question, closed until it is pressed unless it starts open
 * (`defaultOpen`). Its answer opens under it and leaves the others as they
 * are, so two can be read at once. A closed answer is inert: out of the tab
 * order and unread by a screen reader, though it stays in the page to animate.
 */
function Question({
  answer,
  defaultOpen = false,
  question,
}: {
  answer: ReadonlyArray<AnswerBlock>;
  defaultOpen?: boolean;
  question: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);

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
function Promises({ promises }: { promises: ReadonlyArray<string> }) {
  return (
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
  );
}

/** A question and its answer, block under block. */
type Entry = { answer: ReadonlyArray<AnswerBlock>; question: string };

/**
 * The three doubts a reader has once the way is told: Screen Time,
 * self-control and the fear of an erased iPhone. They stand under what it
 * blocks, and the head tells search engines them with the questions below.
 */
function objectionQuestions(): ReadonlyArray<Entry> {
  return [
    {
      answer: [text(m.home_faq_screen_time_a1()), text(m.home_faq_screen_time_a2())],
      question: m.home_faq_screen_time_term(),
    },
    {
      answer: [text(m.home_objection_willpower_a1()), text(m.home_objection_willpower_a2())],
      question: m.home_objection_willpower_term(),
    },
    {
      answer: [text(m.home_objection_erase_a1()), text(m.home_objection_erase_a2())],
      question: m.home_objection_erase_term(),
    },
  ];
}

/**
 * The questions in the order a new visitor asks them, each answer block
 * under block. The page draws them, and its head tells search engines the
 * same ones.
 */
function homeQuestions(): ReadonlyArray<Entry> {
  return [
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
      answer: [text(m.home_faq_see_a1()), text(m.home_faq_see_a2())],
      question: m.home_faq_see_term(),
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
  // them, so the words around them keep their own order.
  const titleWords = new Map([
    [LINK_SLOT, m.home_hero_title_distraction()],
    [SECOND_SLOT, m.home_hero_title_accent()],
  ]);
  const titleParts = m
    .home_hero_title({ distraction: LINK_SLOT, permanently: SECOND_SLOT })
    .split(SLOTS);

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

  const objections = objectionQuestions();
  const questions = homeQuestions();

  return (
    <main {...props(styles.page)}>
      {/* The graph paper the first screen stands on, fading out before the
      first section. */}
      <GridTexture style={styles.heroPaper} />
      {/* The first screen, words only: the claim, what the product is, the
      download beside the way down to how it works, and the price. */}
      <header {...props(styles.hero)}>
        <div {...props(styles.heroText)}>
          <h1 {...props(styles.displayTitle)}>
            {titleParts.map((part) => {
              const word = titleWords.get(part);
              return word === undefined ? (
                part
              ) : (
                <span
                  key={part}
                  {...props(styles.accentWord, part === SECOND_SLOT && styles.accentLine)}
                >
                  {word}
                </span>
              );
            })}
          </h1>
          <p {...props(styles.heroLead)}>{m.home_hero_lead()}</p>
          <div {...props(styles.heroAction)}>
            <div {...props(styles.heroButtons)}>
              <MacDownload placement="hero" />
              <Button render={<a href={`#${SECTION.wayOut}`} />} variant="outline">
                {m.home_hero_how()}
              </Button>
            </div>
            <p {...props(styles.heroPrice)}>{m.home_hero_price()}</p>
          </div>
        </div>
      </header>

      <div {...props(styles.content)}>
        {/* How it works, first under the claim, where the hero's second
        button lands: what the Mac app does, in three steps, then the app
        itself, free, with what it keeps and its download. */}
        <section {...props(styles.section, styles.anchor)} id={SECTION.wayOut}>
          <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_how_lead()}</p>
          <HowItWorks />
          <div id={SECTION.download} {...props(styles.plan, styles.anchor)}>
            {/* Where links from before the two ways were named the download
            still land. Out of the card's flow, so it takes no room. */}
            <span id={OLD_DOWNLOAD_ID} {...props(styles.anchor, styles.outOfFlow)} />
            <div {...props(styles.planHead)}>
              <h3 {...props(styles.planTitle, styles.planPrice)}>{m.home_how_app_price()}</h3>
              <p {...props(styles.planSub)}>
                <a
                  data-plain=""
                  href={REPO_URL}
                  onClick={() => posthog.capture('github_clicked', { placement: 'plan' })}
                  rel="noreferrer"
                  target="_blank"
                  {...props(styles.planLink)}
                >
                  {m.home_how_app_sub()}
                  <SourceArrow />
                </a>
              </p>
            </div>
            <Promises promises={promises} />
            <MacDownload placement="download" />
          </div>
        </section>

        {/* The result, once the way is told: my own screen time, before in
        words and after in the screenshots. */}
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

        {/* What the hours that come back are for, and what they went to
        before. The rest of the phone stays. */}
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_uses_title()}</h2>
          <UsesGrid />
          <p {...props(styles.sectionBody, styles.sectionLines)}>
            <span>{m.home_uses_kept()}</span>
            <span>{m.home_uses_gone()}</span>
          </p>
        </section>

        {/* What it blocks: any app or website. The addictive feeds are where
        it starts, the rest is the reader's choice. */}
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_other_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_other_lead()}</p>
          <OtherUses />
        </section>

        {/* The doubts a reader has once the way and what it blocks are told,
        as three questions drawn like the ones at the foot of the page, but open from
        the start: their answers are read without a press. */}
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_objections_title()}</h2>
          <div>
            {objections.map((entry) => (
              <Question
                answer={entry.answer}
                defaultOpen
                key={entry.question}
                question={entry.question}
              />
            ))}
          </div>
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
                <ExtensionCta label={m.home_ext_cta()} />
              </Button>
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
              <Question answer={entry.answer} key={entry.question} question={entry.question} />
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
          <p {...props(styles.closingNote)}>{m.home_hero_price()}</p>
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
