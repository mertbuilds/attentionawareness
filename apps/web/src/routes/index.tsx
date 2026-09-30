import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, palette, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { VolumeCross, VolumeUp } from 'reicon-react';
import { FeedPhone } from '../components/feed-phone.tsx';
import { GridTexture } from '../components/grid-texture.tsx';
import { MacDownload } from '../components/mac-download.tsx';
import { Receipt } from '../components/receipt.tsx';
import {
  clampHours,
  HOURS_DEFAULT,
  HourReadout,
  HourSlider,
} from '../components/screen-time-gate.tsx';
import { AverageNote, ScreenTimeMark } from '../components/screen-time-help.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import { Tip } from '../components/tip.tsx';
import { formatYears } from '../lib/attention-math.ts';
import { useScrollLock } from '../lib/scroll-lock.ts';
import { decodeShare } from '../lib/share.ts';
import { primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { typingIn } from '../lib/typing-in.ts';
import { wip } from '../lib/wip.stylex.ts';
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
/**
 * How far past its slot the bill is allowed to paint: the widest shadow under
 * it is 12px down and 32px soft, and the torn edge takes a few pixels more.
 */
const SHEET_SHADOW_ROOM = '48px';
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
/** A till pads its receipt numbers. */
const RECEIPT_DIGITS = 6;
/**
 * How long the bill prints before the way past it is offered. A bill short
 * enough to be over by then never shows the button at all.
 */
const SKIP_AFTER_MS = 400;
/**
 * How much of the dial has to be on screen for its own show to run: the rail
 * counts six, seven, six only where the reader can see it do so.
 */
const DIAL_SEEN = 0.75;
/** The sound icon, top right across from the name. */
const ICON_SIZE = 22;

/** How far along the bill is: not asked for yet, printing, or standing whole. */
type Print = 'held' | 'printed' | 'printing';

/**
 * One real week on the wall: a screenshot cropped to the Screen Time average
 * card, so no name, device or status bar is in the picture, or a short clip.
 * Another one is a file in `public/media/screentime-friends/` and a line here.
 */
type Week = {
  height: number;
  kind: 'image' | 'video';
  src: string;
  /** The day the week starts on, as the phone counts it. */
  week: string;
  width: number;
};

const WEEKS: ReadonlyArray<Week> = [
  {
    height: 640,
    kind: 'image',
    src: '/media/screentime-friends/friend-1-week-sep-07.webp',
    week: '2026-09-07',
    width: 800,
  },
  {
    height: 640,
    kind: 'image',
    src: '/media/screentime-friends/friend-1-week-sep-14.webp',
    week: '2026-09-14',
    width: 800,
  },
  {
    height: 640,
    kind: 'image',
    src: '/media/screentime-friends/friend-1-week-sep-21.webp',
    week: '2026-09-21',
    width: 800,
  },
];

const styles = create({
  // A section the page links down to. The scroll stops short of its heading,
  // clear of the brand bar fixed over the top of the window.
  anchor: {
    scrollMarginBlockStart: `calc(${spacing.s16} + ${wip.height})`,
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
  // The first screen: the claim and the way on beside the feed, which stands
  // under them once the window is too narrow for two columns.
  hero: {
    alignItems: 'center',
    boxSizing: 'border-box',
    columnGap: spacing.s16,
    display: 'grid',
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'minmax(0, 1fr) auto',
      default: 'minmax(0, 1fr)',
    },
    justifyItems: {
      '@media (min-width: 768px)': 'start',
      default: 'center',
    },
    maxWidth: 760,
    // On a wide screen the hero is the first screen, less the air above it
    // and the gap under it, so the question starts at the fold.
    minHeight: {
      '@media (min-width: 768px)': firstThatWorks(
        `calc(100svh - ${wip.height} - 2 * ${SECTION_GAP})`,
        `calc(100vh - ${wip.height} - 2 * ${SECTION_GAP})`,
      ),
      default: 0,
    },
    // On a phone the page's own air is too little to clear the brand bar.
    paddingBlockStart: {
      '@media (min-width: 640px)': 0,
      default: spacing.s16,
    },
    rowGap: spacing.s8,
    width: '100%',
  },
  // What the reader does next: the bill, or straight past it.
  heroActions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s4,
    justifyContent: {
      '@media (min-width: 768px)': 'flex-start',
      default: 'center',
    },
  },
  // The words the claim turns on: orange, like the figures on the bill.
  heroMark: {
    color: accent.base,
  },
  heroProduct: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '46ch',
    textWrap: 'pretty',
  },
  // The way past the bill, for a reader who has seen enough of it already.
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
  // The words of the first screen: left of the feed on a wide screen, centred
  // over it on a narrow one.
  heroText: {
    alignItems: {
      '@media (min-width: 768px)': 'flex-start',
      default: 'center',
    },
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    maxWidth: HERO_MEASURE,
    textAlign: {
      '@media (min-width: 768px)': 'start',
      default: 'center',
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
  // The question the bill is priced against: one column, centred, with the
  // bill under it in the same measure.
  hours: {
    alignItems: 'center',
    alignSelf: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
    maxWidth: HERO_MEASURE,
    textAlign: 'center',
    width: '100%',
  },
  // The rail and the figure it reads, as one thing: the figure is the rail's
  // own readout, so nothing comes between them.
  hoursDial: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    width: '100%',
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
    minHeight: `calc(100vh - ${wip.height})`,
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': SECTION_GAP,
      default: spacing.s6,
    },
    paddingInline: spacing.s4,
    // The containing block the grid layer measures itself against.
    position: 'relative',
  },
  // The bill's own slot. The sheet's shadow falls outside its edges: `clip`
  // keeps the cut without a scroll box, and the margin lets the shadow and the
  // torn outline out of it. It costs no layout, so nothing scrolls sideways on
  // a phone.
  receiptSlot: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'clip',
    overflowClipMargin: SHEET_SHADOW_ROOM,
    width: '100%',
  },
  receiptWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: HERO_MEASURE,
    width: '100%',
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
  // The way past the print: a quiet secondary control, standing in the foot
  // of the window rather than in the column, because the bill it belongs to
  // is still moving under it.
  skip: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    insetBlockEnd: spacing.s6,
    insetInlineStart: '50%',
    lineHeight: 1,
    opacity: 0,
    padding: 0,
    pointerEvents: 'none',
    position: 'fixed',
    transform: 'translateX(-50%)',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '400ms',
    },
    transitionProperty: 'opacity, visibility',
    transitionTimingFunction: 'ease-in-out',
    visibility: 'hidden',
    zIndex: 20,
  },
  skipShown: {
    opacity: 1,
    pointerEvents: 'auto',
    visibility: 'visible',
  },
  // The one tool on the page, top right across from the name: the sound of
  // the rail, the bill and the count, on or off.
  sound: {
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
    height: 40,
    insetBlockStart: `calc(${spacing.s2} + ${wip.height})`,
    insetInlineEnd: spacing.s4,
    justifyContent: 'center',
    padding: 0,
    position: 'fixed',
    width: 40,
    zIndex: 30,
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
  // Real weeks, side by side while they fit and one under the other on a
  // phone.
  wall: {
    display: 'grid',
    gap: spacing.s6,
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  wallCaption: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.4,
  },
  wallFigure: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    margin: 0,
  },
  // A screenshot is black in both themes, the way the phone took it.
  wallMedia: {
    backgroundColor: palette.black,
    borderRadius: radius.base,
    display: 'block',
    height: 'auto',
    width: '100%',
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

/**
 * Whether the page may click. Reduced motion silences the default, because a
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

/** The day a week on the wall starts on, the way the reader's language writes it. */
function weekOf(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

/** The marked stretches of the title, [[like this]]. */
const MARK = /\[\[(.*?)\]\]/u;

/**
 * The claim the page opens on. The catalog marks the orange stretches, so
 * each language puts them where its grammar wants them.
 */
function HeroTitle() {
  return m
    .home_hero_title()
    .split(MARK)
    .map((part, index) =>
      index % 2 === 0 ? (
        <span key={index}>{part}</span>
      ) : (
        <span key={index} {...props(styles.heroMark)}>
          {part}
        </span>
      ),
    );
}

function HomePage() {
  const [hours, setHours] = useState(HOURS_DEFAULT);
  // The bill is off the page until it is asked for, then prints its lines,
  // then stands whole.
  const [print, setPrint] = useState<Print>('held');
  // The rail is counting six, seven, six on its own: the readout puts its
  // hands out, and the count keeps them starting from rest at each one.
  const [sixSeven, setSixSeven] = useState(false);
  const [sixSevenRun, setSixSevenRun] = useState(0);
  // Whether the rail is on screen: it only shows itself where it is seen.
  const [dialSeen, setDialSeen] = useState(false);
  const dial = useRef<HTMLDivElement>(null);
  const billSection = useRef<HTMLElement>(null);
  const storySection = useRef<HTMLElement>(null);
  // The date on the bill: when the page was opened, not when it was rung up.
  const [printedAt] = useState(() => new Date());
  // Whether the reader asked for the rest of the bill at once, and whether the
  // way to ask has been offered yet: it arrives a beat into the print, so a
  // short bill is whole before it shows.
  const [skipped, setSkipped] = useState(false);
  const [skipReady, setSkipReady] = useState(false);
  const [friendYears, setFriendYears] = useState<string | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [soundChosen, setSoundChosen] = useState(false);
  const billed = print !== 'held';

  /* oxlint-disable react/set-state-in-effect -- one-shot read of browser-only state */
  useEffect(() => {
    const shared = decodeShare(globalThis.location.search);
    if (shared.hours !== undefined) {
      // A friend already answered the question, so the page opens on their
      // number, printed.
      setHours(shared.hours);
      setPrint('printed');
      setFriendYears(formatYears(shared.hours));
    }
  }, []);
  /* oxlint-enable react/set-state-in-effect */

  // From the moment the bill starts printing until its last line has landed,
  // the page owns the scroll: the reader cannot pull it out from under the
  // lines, while the print keeps scrolling the newest one into view itself.
  useScrollLock(print === 'printing');

  // The print has been running a beat: the way past it is offered.
  useEffect(() => {
    if (print !== 'printing') {
      return;
    }
    const timer = setTimeout(() => setSkipReady(true), SKIP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [print]);

  // Escape does what the button does, for a reader whose hands are already on
  // the keyboard.
  useEffect(() => {
    if (print !== 'printing') {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !typingIn(event.target)) {
        skipBill();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // The skip is nothing but the setter under it, so the listener is bound
    // for the print rather than rebound for every render of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setters only
  }, [print]);

  // Watches the rail: its show runs while it is on screen and stops when it
  // is scrolled away.
  useEffect(() => {
    const element = dial.current;
    if (element === null) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setDialSeen((entry?.intersectionRatio ?? 0) >= DIAL_SEEN),
      { threshold: DIAL_SEEN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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

  // The rail or the bill's own stepper moved the day, and every figure on the
  // bill is priced against it from here.
  function setDay(value: number) {
    setHours(clampHours(value));
  }

  // The question is answered: the bill prints for the day they set. A bill
  // already standing is only brought into view.
  function showBill() {
    if (billed) {
      billSection.current?.scrollIntoView({ block: 'start' });
      return;
    }
    // iOS opens an audio device inside a gesture and nowhere else.
    unlockTickSound();
    setPrint('printing');
  }

  // The last line has landed: the bill stands whole, and the page has its
  // own scroll back.
  function billPrinted() {
    setPrint('printed');
  }

  // The reader would rather not watch it print: every line still pending lands
  // in one batch, and the bill says it is printed once that batch has landed.
  function skipBill() {
    setSkipped(true);
  }

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

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundChosen(true);
    if (next) {
      primeTickSound();
    }
  }

  const wholeHours = clampHours(hours);
  // The way past the print is on the screen while the bill prints, and a
  // reader who asked for less motion never had a print to sit through.
  const reduced = useReducedMotion();
  const sound = tickAllowed(soundOn, soundChosen);
  const skipOffered = print === 'printing' && skipReady && !skipped && reduced !== true;
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
      <GridTexture />
      <Tip
        mobile="none"
        title={m.home_math_sound_label()}
        trigger={
          <button
            aria-label={m.home_math_sound_label()}
            aria-pressed={soundOn}
            onClick={toggleSound}
            type="button"
            {...props(styles.sound)}
          >
            {soundOn ? (
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
      {/* The first screen: the claim, what the site is, and the two ways on,
      beside a feed that never stops. */}
      <header {...props(styles.hero)}>
        <div {...props(styles.heroText)}>
          <h1 {...props(styles.heroTitle)}>
            <HeroTitle />
          </h1>
          <p {...props(styles.heroProduct)}>{m.home_hero_product()}</p>
          <div {...props(styles.heroActions)}>
            <Button render={<a href={`#${COST_ID}`} />}>{m.home_hero_cta()}</Button>
            <a href={`#${WAY_OUT_ID}`} {...props(styles.heroSecondary)}>
              {m.home_hero_secondary()}
            </a>
          </div>
        </div>
        <FeedPhone />
      </header>

      <div {...props(styles.content)}>
        {/* Act one, the problem: the reader's own day, what it adds up to, and
        what it looks like on real phones. */}
        <section {...props(styles.hours, styles.anchor)} id={COST_ID}>
          <h2 {...props(styles.heroTitle)}>
            {m.home_gate_question()}
            <ScreenTimeMark />
          </h2>
          <AverageNote />
          <div ref={dial} {...props(styles.hoursDial)}>
            <HourReadout hours={wholeHours} sixSeven={sixSeven} sixSevenRun={sixSevenRun} />
            <HourSlider
              // The rail shows itself only while it is seen, and only until
              // the reader has asked for a bill: after that it is theirs.
              arrived={dialSeen && !billed}
              onChange={setDay}
              onSixSeven={(showing) => {
                setSixSeven(showing);
                if (showing) {
                  setSixSevenRun((count) => count + 1);
                }
              }}
              sound={sound}
              value={wholeHours}
            />
          </div>
          <Button onClick={showBill}>{m.home_gate_show()}</Button>
        </section>

        {/* The bill: off the page until it is asked for, then printed line by
        line and priced live against the day. */}
        <section
          aria-live="polite"
          ref={billSection}
          {...props(styles.receiptWrap, styles.anchor, !billed && styles.gone)}
        >
          <div {...props(styles.receiptSlot)}>
            <Receipt
              hours={wholeHours}
              number={receiptNo}
              onChange={setDay}
              onPrinted={billPrinted}
              print={print}
              printedOn={printedOn}
              skipped={skipped}
              sound={sound}
            />
          </div>
        </section>
        {/* The way past the print. It stands in the window's foot rather than
        in the column, and stays on the page while the bill finishes so it
        fades out instead of blinking away. */}
        {billed ? (
          <button
            aria-hidden={!skipOffered}
            onClick={skipBill}
            tabIndex={skipOffered ? 0 : -1}
            type="button"
            {...props(styles.skip, skipOffered && styles.skipShown)}
          >
            {m.home_bill_skip()}
          </button>
        ) : null}

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_wall_title()}</h2>
          <p {...props(styles.sectionBody)}>{m.home_wall_body()}</p>
          <ul {...props(styles.wall)}>
            {WEEKS.map((week) => (
              <li key={week.src}>
                <figure {...props(styles.wallFigure)}>
                  {week.kind === 'video' ? (
                    <video
                      aria-label={m.home_wall_alt()}
                      autoPlay
                      height={week.height}
                      loop
                      muted
                      playsInline
                      preload="metadata"
                      src={week.src}
                      width={week.width}
                      {...props(styles.wallMedia)}
                    />
                  ) : (
                    <img
                      alt={m.home_wall_alt()}
                      decoding="async"
                      height={week.height}
                      loading="lazy"
                      src={week.src}
                      width={week.width}
                      {...props(styles.wallMedia)}
                    />
                  )}
                  <figcaption {...props(styles.wallCaption)}>
                    {m.home_wall_caption({ week: weekOf(week.week, locale) })}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>

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
