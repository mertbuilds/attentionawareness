import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, keyframes, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Restart, VolumeCross, VolumeUp } from 'reicon-react';
import { DEMO_FROM, FeedPhone } from '../components/feed-phone.tsx';
import { GridTexture } from '../components/grid-texture.tsx';
import { Receipt } from '../components/receipt.tsx';
import { clampHours, Count } from '../components/screen-time-gate.tsx';
import { AverageHelp, ScreenTimeHelp } from '../components/screen-time-help.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { Tip } from '../components/tip.tsx';
import { formatYears } from '../lib/attention-math.ts';
import { decodeShare } from '../lib/share.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';

export const Route = createFileRoute('/')({
  component: HomePage,
});

/**
 * Every heading on the page, the hero's own included. It is not a token
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
/**
 * How wide a line on the first screen is allowed to get. The column itself is
 * the page's, so every left edge lines up; this is how much of it a sentence
 * takes, which is less, because these are read rather than scanned.
 */
const HERO_MEASURE = 640;
/** The places on the page that can be linked to, and the ids they use. */
const STORY_ID = 'story';
const HOW_ID = 'how';
/** The two tool icons, top right. */
const ICON_SIZE = 22;
const SUPERVISE_URL = '/supervise';
const BUILD_URL = '/build';
/** The report the average day is taken from. */
/** The post this started from, linked out of the paragraph that tells it. */
const STORY_URL = 'https://stopa.io/post/297';
/**
 * Where a link or a figure stands inside a sentence. The message is written
 * with it as a placeholder and split on it, so the words around it keep their
 * own order and spacing in every language instead of being stitched from
 * pieces.
 */
const LINK_SLOT = '\u0000';
/** A till pads its receipt numbers. */
const RECEIPT_DIGITS = 6;
/** How long the receipt takes to roll back up when the reader starts over. */
const EXPAND_MS = '500ms';
/** How long the first screen takes to leave, and the bill to arrive under it. */
const SLIDE_MS = 500;
const SLIDE_DURATION = `${SLIDE_MS}ms`;
const SLIDE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** How long the six-seven hands take to fade. */
const HANDS_FADE = '250ms';
/** The blur the two screens carry while they travel. */
const SLIDE_BLUR = '3px';

/** Where the bill is between the question being asked and it being answered. */
type BillStage = 'held' | 'printed' | 'printing' | 'returning' | 'sliding';

/**
 * Each beat of the answer arriving: nothing is on the page until the question
 * is answered, and every beat comes in the same way after it.
 */
const revealEnter = keyframes({
  from: { filter: 'blur(2px)', opacity: 0, transform: 'translateY(4px)' },
  to: { filter: 'blur(0)', opacity: 1, transform: 'translateY(0)' },
});

/**
 * The question leaving and the answer arriving, together. The page reads as
 * one screen scrolled up over another: one goes a screen up and off, the
 * other comes a screen down into the place it left.
 */
const screenLeave = keyframes({
  from: { filter: 'blur(0)', opacity: 1, transform: 'translateY(0)' },
  to: { filter: `blur(${SLIDE_BLUR})`, opacity: 0, transform: 'translateY(-100svh)' },
});
const billArrive = keyframes({
  from: { filter: `blur(${SLIDE_BLUR})`, opacity: 0, transform: 'translateY(100svh)' },
  to: { filter: 'blur(0)', opacity: 1, transform: 'translateY(0)' },
});
/** The same two moves run backwards: the bill goes down, the question comes down. */
const billLeave = keyframes({
  from: { filter: 'blur(0)', opacity: 1, transform: 'translateY(0)' },
  to: { filter: `blur(${SLIDE_BLUR})`, opacity: 0, transform: 'translateY(100svh)' },
});
/** One hand of the six-seven: up, and down, while the other does the reverse. */
const weigh = keyframes({
  '0%': { translate: '0 0' },
  '100%': { translate: '0 0' },
  '50%': { translate: '0 -6px' },
});
const screenReturn = keyframes({
  from: { filter: `blur(${SLIDE_BLUR})`, opacity: 0, transform: 'translateY(-100svh)' },
  to: { filter: 'blur(0)', opacity: 1, transform: 'translateY(0)' },
});

const styles = create({
  // A section the hero links down to. The scroll stops short of its heading
  // instead of pinning it to the top edge of the window.
  anchor: {
    scrollMarginBlockStart: spacing.s8,
  },
  banner: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    maxWidth: 760,
    paddingBlock: spacing.s2,
    paddingInline: spacing.s4,
    textWrap: 'pretty',
    width: '100%',
  },
  bannerDismiss: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 18,
    lineHeight: 1,
    marginInlineStart: 'auto',
    padding: 0,
  },
  // The bill, and the words under it, riding up into the screen the question
  // has just left.
  billArriving: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: SLIDE_DURATION,
    },
    animationName: billArrive,
    animationTimingFunction: SLIDE_EASE,
  },
  billLeaving: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: SLIDE_DURATION,
    },
    animationFillMode: 'forwards',
    animationName: billLeave,
    animationTimingFunction: SLIDE_EASE,
    pointerEvents: 'none',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    // Nothing is drawn between the sections any more, so the gap carries the
    // rhythm on its own at every width.
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
  // The line the icon fan is set into. It is the section's picture, not its
  // heading, so it sits one step under the h2 above it; the line box is tall
  // enough for a 32px icon, which is what keeps the sentence around it even.
  expand: {
    display: 'grid',
    gridTemplateRows: '0fr',
    transitionProperty: 'grid-template-rows',
    transitionTimingFunction: SLIDE_EASE,
    width: '100%',
  },
  expandInner: {
    minHeight: 0,
    opacity: 0,
    overflow: 'hidden',
    transitionProperty: 'opacity',
  },
  expandInnerOpen: {
    opacity: 1,
  },
  // Opening is not a tween any more: the box takes its full height at once,
  // under a bill that slides into it. Only the way back is drawn.
  expandInnerSnap: {
    transitionDelay: '0ms',
    transitionDuration: '0ms',
  },
  expandInnerTween: {
    transitionDelay: '150ms',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: EXPAND_MS,
    },
  },
  expandOpen: {
    gridTemplateRows: '1fr',
  },
  expandSnap: {
    transitionDuration: '0ms',
  },
  expandTween: {
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: EXPAND_MS,
    },
  },
  // The first screen, whole, and one thing at a time down it: the question,
  // then the lines the answer earns, then the total they come to, then what to
  // do about it. One column at every width, because the order is the argument.
  // The same box as `content`, so the whole page keeps one left edge; what
  // stands in it is narrower, because a line this size is read, not scanned.
  gateHint: {
    color: colors.muted,
    fontSize: 13,
    margin: 0,
    textAlign: 'center',
  },
  // Hidden in place until the rail is held, then faded in: the box is laid
  // out from the first paint, so the page does not move when it shows.
  gateCta: {
    opacity: 0,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '250ms',
    },
    transitionProperty: 'opacity, visibility',
    transitionTimingFunction: 'ease-in-out',
    visibility: 'hidden',
  },
  gateCtaShown: {
    opacity: 1,
    visibility: 'visible',
  },
  hero: {
    alignItems: 'center',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
    // Centred while it fits; a receipt taller than a phone screen starts
    // under the brand bar instead of climbing behind it.
    justifyContent: firstThatWorks('safe center', 'center'),
    maxWidth: 760,
    minHeight: firstThatWorks('100svh', '100vh'),
    paddingBlockEnd: {
      '@media (max-width: 639px)': spacing.s6,
      default: '8vh',
    },
    paddingBlockStart: {
      '@media (min-width: 640px)': 0,
      default: spacing.s16,
    },
    position: 'relative',
    textAlign: 'center',
    width: '100%',
  },
  // What the reader does next, and the one sentence that says what it is.
  heroActions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s4,
    justifyContent: 'center',
  },
  heroPitch: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    marginInline: 'auto',
    maxWidth: HERO_MEASURE,
    textAlign: 'center',
  },
  heroProduct: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '46ch',
    textWrap: 'pretty',
  },
  // The way past the button, for a reader who wants the price in time first.
  heroSecondary: {
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    fontSize: font.sizeSm,
    textDecorationLine: {
      ':hover': 'underline',
      default: 'none',
    },
  },
  // The words the number lands in: orange, like the number and the bill.
  hand: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '700ms',
    },
    animationIterationCount: 'infinite',
    animationName: weigh,
    animationTimingFunction: 'ease-in-out',
    display: 'inline-block',
    fontSize: 20,
    lineHeight: 1,
  },
  handRight: {
    animationDelay: '350ms',
  },
  // Under the number, out of the flow, so the line never moves for them.
  hands: {
    display: 'flex',
    gap: 2,
    insetBlockStart: '100%',
    insetInlineStart: '50%',
    justifyContent: 'center',
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translateX(-50%)',
    transitionDuration: HANDS_FADE,
    transitionProperty: 'opacity',
    whiteSpace: 'nowrap',
  },
  handsShown: {
    opacity: 1,
  },
  // The number's box: its width is set by the digit count and animated.
  heroCount: {
    display: 'inline-block',
    overflow: 'visible',
    position: 'relative',
    textAlign: 'center',
    verticalAlign: 'baseline',
    whiteSpace: 'nowrap',
  },
  heroMark: {
    color: accent.base,
    // Every digit the same width, so 6 to 7 moves nothing; only 9 to 10 does.
    fontVariantNumeric: 'tabular-nums',
  },
  // The line breaks after the hours on a wide screen, so the claim reads as
  // two lines: what we did, and how often. A phone wraps it as it must.
  heroBreak: {
    display: {
      '@media (min-width: 640px)': 'inline',
      default: 'none',
    },
  },
  heroTitle: {
    fontSize: {
      '@media (min-width: 640px)': 44,
      default: 28,
    },
    fontWeight: HEADING_WEIGHT,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    margin: 0,
    maxWidth: {
      '@media (min-width: 640px)': 760,
      default: HERO_MEASURE,
    },
    textWrap: 'balance',
  },
  howBody: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '60ch',
    textWrap: 'pretty',
  },
  // Four steps, one under the other, with nothing drawn around any of them:
  // the order is what makes them steps.
  howList: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  howStep: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  howTitle: {
    fontSize: 18,
    fontWeight: HEADING_WEIGHT,
    lineHeight: 1.3,
    margin: 0,
    textWrap: 'pretty',
  },
  // The page's one caption: the small line that names the group under it.
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: font.weightMedium,
    letterSpacing: '0.08em',
    lineHeight: 1.4,
    margin: 0,
    textTransform: 'uppercase',
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: SECTION_GAP,
    // The stacking context that keeps the grid layer above the page's own
    // background instead of behind it.
    isolation: 'isolate',
    minHeight: '100vh',
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s6,
    },
    paddingInline: spacing.s4,
    // The containing block the grid layer measures itself against.
    position: 'relative',
  },
  // One cited line inside the research box, and the whole line is the source.
  receiptAfter: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  receiptSlot: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
  },
  receiptWrap: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    maxWidth: HERO_MEASURE,
    width: '100%',
  },
  // What the answer buys, arriving: the total, the list under it, the line
  // under that and the pitch. One fade for all of them, so every beat reads
  // the same way.
  reveal: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    animationName: revealEnter,
    animationTimingFunction: 'ease-in-out',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
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
  // The speaker is a hint, not a headline: it only colours up on hover, and it
  // sits in the quiet row under the way on, at the size of the text beside it.
  stepLink: {
    display: 'inline-block',
    marginBlockStart: spacing.s2,
  },
  story: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    maxWidth: 640,
  },
  storyLine: {
    fontSize: 18,
    lineHeight: 1.7,
    margin: 0,
    textWrap: 'pretty',
  },
  // Who wrote it, and from where. It is a signature, so it is the quietest
  // line in the section.
  storySign: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  // The restart arrow, turned over so it runs the other way round.
  flipped: {
    transform: 'scaleX(-1)',
  },
  toolButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    padding: 0,
    width: 40,
  },
  // The buttons are 40px tall and the brand mark 24px, both from a 16px top:
  // pulled up by half the difference, their centres meet on one line.
  // Start over rides with the bill: on screen while the bill is, gone when
  // the reader has scrolled past it.
  toolAway: {
    opacity: 0,
    pointerEvents: 'none',
  },
  toolFade: {
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '250ms',
    },
    transitionProperty: 'opacity',
    transitionTimingFunction: 'ease-in-out',
  },
  tools: {
    display: 'flex',
    gap: spacing.s1,
    insetBlockStart: spacing.s2,
    insetInlineEnd: spacing.s4,
    position: 'fixed',
    zIndex: 30,
  },
  // Lays out like the hero itself: one column, centred, same gaps.
  // On a phone the column takes the whole first screen: the question at the
  // top, the words at the foot, and the phone grows into whatever is between.
  untouched: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    flexGrow: {
      '@media (max-width: 639px)': 1,
      default: 0,
    },
    gap: {
      '@media (max-height: 720px)': spacing.s4,
      '@media (min-width: 640px)': spacing.s6,
      default: spacing.s4,
    },
    minHeight: 0,
    width: '100%',
  },
  // On its way out: pinned where it stood, so it leaves from there, and over
  // the bill coming up under it.
  untouchedLeaving: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: SLIDE_DURATION,
    },
    animationFillMode: 'forwards',
    animationName: screenLeave,
    animationTimingFunction: SLIDE_EASE,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    pointerEvents: 'none',
    position: 'absolute',
    zIndex: 1,
  },
  untouchedLeavingAt: (top: number) => ({
    insetBlockStart: top,
  }),
  // On its way back: over the bill going down under it, coming down from
  // above into the place it left.
  untouchedReturning: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: SLIDE_DURATION,
    },
    animationName: screenReturn,
    animationTimingFunction: SLIDE_EASE,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    pointerEvents: 'none',
    position: 'absolute',
    zIndex: 1,
  },
});

/**
 * Whether the show may click. Reduced motion silences the default, because a
 * click is one more thing happening at the reader; a reader who turned the
 * speaker on themselves has answered that question already.
 */
function tickAllowed(on: boolean, chosen: boolean): boolean {
  if (!on) {
    return false;
  }
  if (chosen) {
    return true;
  }
  const query = (globalThis as { matchMedia?: (media: string) => MediaQueryList }).matchMedia;
  return query === undefined || !query('(prefers-reduced-motion: reduce)').matches;
}

/** Where the reader's day is kept between visits, in this browser only. */
const HOURS_KEY = 'aa:hours';
/** The attribute the head script stamps on the root when hours are saved. */
const RECALL_STAMP = 'data-aa-hours';

function recallHours(): number | null {
  try {
    const raw = globalThis.localStorage.getItem(HOURS_KEY);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? clampHours(value) : null;
  } catch {
    return null;
  }
}

function rememberHours(value: number): void {
  try {
    globalThis.localStorage.setItem(HOURS_KEY, String(value));
  } catch {
    // Private mode or a full store: the page still works, it just forgets.
  }
}

function forgetHours(): void {
  try {
    globalThis.localStorage.removeItem(HOURS_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** How the number's box glides when it gains or loses a digit. */
const GLIDE = { damping: 28, stiffness: 260, type: 'spring' } as const;

/** The marked stretches of the title, [[like this]]; # is where the number goes. */
const MARK = /\[\[(.*?)\]\]/u;

/**
 * The claim with the reader's number inside it. The catalog marks the orange
 * stretches, so each language puts them where its grammar wants them.
 */
function HeroTitle({
  hours,
  nodRun,
  sixSeven,
}: {
  hours: number;
  /** Counts the nods, so the hands start from rest at each one. */
  nodRun: number;
  sixSeven: boolean;
}) {
  const text = hours === 1 ? m.home_hero_title_one() : m.home_hero_title();
  // With tabular figures every digit is one ch wide, so the number's box is
  // as many ch as it has digits, and it glides between one and two while
  // the digits roll; the words around it ride along instead of jumping.
  const digits = String(hours).length;
  return text.split(MARK).map((part, index) =>
    index % 2 === 0 ? (
      <span key={index}>{part}</span>
    ) : (
      <span key={index} {...props(styles.heroMark)}>
        {part.includes('#') ? (
          <>
            {part.slice(0, part.indexOf('#'))}
            <motion.span
              animate={{ width: `${digits}ch` }}
              initial={false}
              transition={GLIDE}
              {...props(styles.heroCount)}
            >
              <Count value={hours} />
              {/* Six, seven. Palms up, one hand rising as the other falls:
              the gesture the number pair comes with now. */}
              <span
                aria-hidden="true"
                // A new pair at every nod: their bob starts from rest with
                // the step to seven, and keeps going while they fade.
                key={nodRun}
                {...props(styles.hands, sixSeven && styles.handsShown)}
              >
                <span {...props(styles.hand)}>🫴</span>
                <span {...props(styles.hand, styles.handRight)}>🫴</span>
              </span>
            </motion.span>
            {part.slice(part.indexOf('#') + 1)}
            <br {...props(styles.heroBreak)} />
          </>
        ) : (
          part
        )}
      </span>
    ),
  );
}

/** The caption under the phone; the marked words open the screen time help. */
function ScrollHint() {
  return m
    .home_gate_scroll_hint()
    .split(MARK)
    .map((part, index) =>
      index % 2 === 0 ? (
        <span key={index}>{part}</span>
      ) : (
        <ScreenTimeHelp key={index} label={part} />
      ),
    );
}

function HomePage() {
  const [hours, setHours] = useState(DEMO_FROM);
  // Whether the reader has touched the dial: the receipt is empty until then.
  const [touched, setTouched] = useState(false);
  // How the bill got here: held behind the first screen, sliding up into the
  // place it leaves, printing its lines, or simply on the page.
  const [stage, setStage] = useState<BillStage>('held');
  // Where the first screen stood when it was asked to go, so it leaves from
  // there and not from the top of the column.
  const [leaveTop, setLeaveTop] = useState(0);
  const firstScreen = useRef<HTMLDivElement>(null);
  const billSection = useRef<HTMLElement>(null);
  // Whether the bill is on screen: the way back to the question shows only
  // while there is a bill to come back from.
  const [billInView, setBillInView] = useState(true);
  // The feed is nodding six, seven, six on its own: the hands come out.
  const [sixSeven, setSixSeven] = useState(false);
  const [nodRun, setNodRun] = useState(0);
  // After the way back the bill is already off screen: its box closes in one
  // frame, so nothing of it shows under the question while it closes.
  const [snapClose, setSnapClose] = useState(false);
  // Whether the reader has set the rail down once: the way to the bill shows
  // itself then, and not before.
  const [picked, setPicked] = useState(false);
  // The date on the bill: when the page was opened, not when it was rung up.
  const [printedAt] = useState(() => new Date());
  const [sound, setSound] = useState(true);
  const [soundChosen, setSoundChosen] = useState(false);
  const [friendYears, setFriendYears] = useState<string | null>(null);

  /* oxlint-disable react/set-state-in-effect -- one-shot read of browser-only state */
  useEffect(() => {
    const shared = decodeShare(globalThis.location.search);
    const remembered = recallHours();
    if (shared.hours === undefined && remembered !== null) {
      // The reader has been here: the receipt opens where they left it,
      // whole, because it was printed on the last visit.
      setHours(remembered);
      setStage('printed');
      setTouched(true);
    }
    // From here on React owns the first screen; the pre-paint stamp that hid
    // it has done its job, and would otherwise hide it after a reset too.
    document.documentElement.removeAttribute(RECALL_STAMP);
    if (shared.hours !== undefined) {
      // A friend already answered the question, so the page opens on their
      // number, printed.
      setHours(shared.hours);
      setStage('printed');
      setTouched(true);
      setFriendYears(formatYears(shared.hours));
    }
  }, []);
  /* oxlint-enable react/set-state-in-effect */

  // The first screen is the whole page until the dial is touched, and stays
  // the whole page while it leaves: nothing under it can be scrolled to
  // before the bill has landed in its place.
  useEffect(() => {
    document.documentElement.style.overflow =
      touched && stage !== 'sliding' && stage !== 'returning' ? '' : 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [stage, touched]);

  // The screens have swapped: the page is free again, and the bill prints
  // the rest of itself line by line.
  useEffect(() => {
    if (stage !== 'sliding') {
      return;
    }
    const timer = setTimeout(() => setStage('printing'), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  // The screens have swapped back: the bill is gone and the first screen
  // takes the column again.
  useEffect(() => {
    if (stage !== 'returning') {
      return;
    }
    const timer = setTimeout(() => {
      setStage('held');
      setTouched(false);
    }, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  // Watches the bill: Start over fades out once it has scrolled away and
  // back in when it returns.
  useEffect(() => {
    const element = billSection.current;
    if (element === null || !touched) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setBillInView(entry?.isIntersecting ?? true);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [touched]);

  // iOS Safari opens an audio device inside a gesture and nowhere else, so the
  // first gesture it accepts anywhere on the page opens one. Once that works
  // there is nothing left to listen for.
  useEffect(() => {
    const gestures = ['touchend', 'pointerup', 'click'] as const;
    function stop() {
      for (const gesture of gestures) {
        document.removeEventListener(gesture, unlock);
      }
    }
    function unlock() {
      if (unlockTickSound()) {
        stop();
      }
    }
    for (const gesture of gestures) {
      document.addEventListener(gesture, unlock, { once: true, passive: true });
    }
    return stop;
  }, []);

  // The rail was let go at a value: the way to the bill shows on the first
  // release, and the bill itself only tracks the day once it is open.
  function onHoursChange(value: number) {
    const next = clampHours(value);
    setHours(next);
    setPicked(true);
    if (touched) {
      rememberHours(next);
    }
  }

  // The reader asked for the bill: the day they set is kept, and the bill
  // unrolls for it.
  function showBill() {
    // iOS opens an audio device inside a gesture and nowhere else.
    unlockTickSound();
    rememberHours(hours);
    // Measured before the screen is taken out of the column, so it leaves
    // from exactly where the reader last saw it.
    setLeaveTop(firstScreen.current?.offsetTop ?? 0);
    setSnapClose(false);
    setStage('sliding');
    setTouched(true);
  }

  // Back to the first screen: the remembered day is forgotten, the feed
  // starts its show again, and the two screens swap back the way they came.
  function reset() {
    forgetHours();
    setHours(DEMO_FROM);
    setPicked(false);
    setBillInView(true);
    // A section link may have brought the reader here; the fresh question
    // carries no anchor.
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    window.scrollTo({ behavior: 'instant', top: 0 });
    setLeaveTop(0);
    setSnapClose(true);
    setStage('returning');
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundChosen(true);
    if (next) {
      primeTickSound();
    }
  }

  const wholeHours = clampHours(hours);
  const locale = getLocale();
  // The bill's own number and date: one number per visit, the second of the
  // day the page was opened, and the date it was opened on.
  const receiptNo = String(
    printedAt.getHours() * 3600 + printedAt.getMinutes() * 60 + printedAt.getSeconds(),
  ).padStart(RECEIPT_DIGITS, '0');
  const printedOn = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(printedAt);
  // The post the story links out to, in the middle of the sentence that tells
  // it, so the words around it keep their own order in every language.
  const [storyBefore, storyAfter] = m.home_story_1({ post: LINK_SLOT }).split(LINK_SLOT);

  // Supervision leads: it is the step the other three stand on.
  // Each step ends in the way into it: the guide, then the generator.
  const howItWorks = [
    {
      body: m.home_how_supervision_body(),
      href: SUPERVISE_URL,
      link: m.gen_supervise_link(),
      title: m.home_how_supervision_title(),
    },
    {
      body: m.home_how_profile_body(),
      href: BUILD_URL,
      link: m.home_how_build_link(),
      title: m.home_how_profile_title(),
    },
  ];

  const objections = [
    { desc: m.home_faq_supervision_desc(), term: m.home_faq_supervision_term() },
    { desc: m.home_faq_see_desc(), term: m.home_faq_see_term() },
    { desc: m.home_faq_erase_desc(), term: m.home_faq_erase_term() },
    { desc: m.home_faq_data_desc(), term: m.home_faq_data_term() },
    { desc: m.home_faq_undo_desc(), term: m.home_faq_undo_term() },
    { desc: m.home_faq_change_desc(), term: m.home_faq_change_term() },
    { desc: m.home_faq_updates_desc(), term: m.home_faq_updates_term() },
    { desc: m.home_faq_keep_desc(), term: m.home_faq_keep_term() },
    { desc: m.home_faq_apple_desc(), term: m.home_faq_apple_term() },
    { desc: m.home_faq_mac_desc(), term: m.home_faq_mac_term() },
    { desc: m.home_faq_android_desc(), term: m.home_faq_android_term() },
    { desc: m.home_faq_windows_desc(), term: m.home_faq_windows_term() },
    { desc: m.home_faq_who_desc(), term: m.home_faq_who_term() },
  ];

  return (
    <main {...props(styles.page)}>
      <GridTexture />
      {friendYears === null ? null : (
        <div {...props(styles.banner)}>
          <span>{m.share_banner({ years: friendYears })}</span>
          <button
            aria-label={m.share_banner_dismiss()}
            onClick={() => setFriendYears(null)}
            type="button"
            {...props(styles.bannerDismiss)}
          >
            ×
          </button>
        </div>
      )}
      <header {...props(styles.hero)}>
        {/* The two tools, top right: start over, and the sound. */}
        <div {...props(styles.tools)}>
          {touched && stage !== 'returning' ? (
            <div {...props(styles.toolFade, !billInView && styles.toolAway)}>
              <Tip
                mobile="none"
                title={m.home_reset_label()}
                trigger={
                  <button
                    aria-label={m.home_reset_label()}
                    onClick={reset}
                    type="button"
                    {...props(styles.toolButton)}
                  >
                    <Restart aria-hidden="true" size={ICON_SIZE} {...props(styles.flipped)} />
                  </button>
                }
                variant="label"
              >
                {null}
              </Tip>
            </div>
          ) : null}
          <Tip
            mobile="none"
            title={m.home_math_sound_label()}
            trigger={
              <button
                aria-label={m.home_math_sound_label()}
                aria-pressed={sound}
                onClick={toggleSound}
                type="button"
                {...props(styles.toolButton)}
              >
                {sound ? (
                  <VolumeUp aria-hidden="true" size={ICON_SIZE} />
                ) : (
                  <VolumeCross aria-hidden="true" size={ICON_SIZE} />
                )}
              </button>
            }
            variant="label"
          >
            {null}
          </Tip>
        </div>
        {/* The first screen: the question, the rail, the average and the
        preferences. A reader with saved hours never sees it: an inline
        script in the head stamps the root before first paint, and the
        `data-aa-untouched` block is hidden by a global rule until React
        restores the receipt. */}
        {touched && stage !== 'sliding' && stage !== 'returning' ? null : (
          <div
            data-aa-untouched=""
            // A fresh key on the way back, so the feed's show plays again.
            key={stage === 'returning' ? 'returning' : 'held'}
            ref={firstScreen}
            {...props(
              styles.untouched,
              stage === 'sliding' && styles.untouchedLeaving,
              stage === 'sliding' && styles.untouchedLeavingAt(leaveTop),
              stage === 'returning' && styles.untouchedReturning,
              stage === 'returning' && styles.untouchedLeavingAt(leaveTop),
            )}
          >
            <h1 {...props(styles.heroTitle)}>
              <HeroTitle hours={hours} nodRun={nodRun} sixSeven={sixSeven} />
              <AverageHelp />
            </h1>
            <FeedPhone
              onChange={setHours}
              onNod={(nodding) => {
                setSixSeven(nodding);
                if (nodding) {
                  setNodRun((run) => run + 1);
                }
              }}
              onPick={onHoursChange}
              sound={tickAllowed(sound, soundChosen)}
            />
            <p {...props(styles.gateHint)}>
              <ScrollHint />
            </p>
            {/* In the page from the start, so nothing moves when it appears:
            it fades in once the rail has been held. */}
            <div aria-hidden={!picked} {...props(styles.gateCta, picked && styles.gateCtaShown)}>
              <Button onClick={showBill} tabIndex={picked ? 0 : -1}>
                {m.home_gate_cta()}
              </Button>
            </div>
          </div>
        )}
        {/* The receipt: empty until the reader touches the dial, then priced
        live against it. Every figure on it rolls as the hours change. */}
        <section
          aria-live="polite"
          ref={billSection}
          {...props(
            styles.receiptWrap,
            stage === 'sliding' && styles.billArriving,
            stage === 'returning' && styles.billLeaving,
          )}
        >
          <div
            {...props(
              styles.expand,
              touched || snapClose ? styles.expandSnap : styles.expandTween,
              touched && styles.expandOpen,
            )}
          >
            <div
              {...props(
                styles.expandInner,
                touched || snapClose ? styles.expandInnerSnap : styles.expandInnerTween,
                touched && styles.expandInnerOpen,
                styles.receiptSlot,
              )}
            >
              <Receipt
                hours={wholeHours}
                number={receiptNo}
                onChange={onHoursChange}
                print={stage === 'sliding' ? 'held' : stage === 'returning' ? 'printed' : stage}
                printedOn={printedOn}
                sound={tickAllowed(sound, soundChosen)}
              />
              <div {...props(styles.receiptAfter)}></div>
            </div>
          </div>
        </section>
        <div
          {...props(
            styles.expand,
            touched || snapClose ? styles.expandSnap : styles.expandTween,
            touched && styles.expandOpen,
            stage === 'sliding' && styles.billArriving,
            stage === 'returning' && styles.billLeaving,
          )}
        >
          <div
            {...props(
              styles.expandInner,
              touched || snapClose ? styles.expandInnerSnap : styles.expandInnerTween,
              touched && styles.expandInnerOpen,
              styles.heroPitch,
            )}
          >
            <p {...props(styles.heroProduct)}>{m.home_hero_product()}</p>
            <div {...props(styles.heroActions)}>
              <Button render={<a href={`#${STORY_ID}`} />}>{m.home_hero_cta()}</Button>
              <a href={`#${HOW_ID}`} {...props(styles.heroSecondary)}>
                {m.home_hero_secondary()}
              </a>
            </div>
          </div>
        </div>
      </header>

      <div {...props(styles.content)}>
        {/* Who made this and why, told rather than argued. It is the only
        place on the page that speaks in the first person. */}
        <section {...props(styles.section, styles.anchor)} id={STORY_ID}>
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
            <p {...props(styles.storyLine)}>{m.home_story_4()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_5()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_6()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_7()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_8()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_9()}</p>
            <p {...props(styles.storyLine)}>{m.home_story_10()}</p>
            <p {...props(styles.storySign)}>{m.home_story_sign()}</p>
          </div>
        </section>

        <section {...props(styles.section, styles.anchor)} id={HOW_ID}>
          <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
          <ol {...props(styles.howList)}>
            {howItWorks.map((step, index) => (
              <li key={step.title} {...props(styles.howStep)}>
                <h3 {...props(styles.howTitle)}>
                  {m.home_how_step({ n: index + 1, title: step.title })}
                </h3>
                <p {...props(styles.howBody)}>{step.body}</p>
                <a href={step.href} {...props(styles.stepLink)}>
                  {step.link}
                </a>
              </li>
            ))}
          </ol>
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

        <SiteFooter />
      </div>
    </main>
  );
}
