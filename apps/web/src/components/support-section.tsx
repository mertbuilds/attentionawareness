import { Button } from '@attentionawareness/ui';
import { accent, tint } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { usePostHog } from '@posthog/react';
import { create, defaultMarker, keyframes, props, when } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { Heart } from 'reicon-react';
import { blur, distance, duration, easing } from '../lib/motion.stylex.ts';
import { supportUrl } from '../lib/support.ts';
import { prefersLessMotion, useLessMotion } from '../lib/use-less-motion.ts';
import { useSeen } from '../lib/use-seen.ts';
import { m } from '../paraglide/messages.js';

const SUPPORT_URL = supportUrl('support-section');
/** Where the code is public. */
const REPO_URL = 'https://github.com/mertbuilds/attentionawareness';
/** The heart on the support button, as tall as the button's letters are set. */
const HEART_SIZE = 14;
/** One part of the section after the one before it, in milliseconds, as they rise. */
const STAGGER = 80;

/**
 * The stamp's drawing, in its own units: the sheet it is drawn on, the stamp
 * on it, a little turned, and the postmark over the stamp's lower corner.
 */
const SHEET = { height: 206, width: 200 };
const STAMP = { height: 164, turn: 3, width: 128, x: 58, y: 12 };
/** The stamp's edge: half circles bitten out of it, one every `pitch`. */
const BITE = 3.5;
const PITCH = 12;
/** The line printed inside the edge, and the view it frames. */
const FRAME = 10;
const VIEW = {
  height: STAMP.height - 2 * FRAME,
  width: STAMP.width - 2 * FRAME,
  x: FRAME,
  y: FRAME,
};
/**
 * The view is Antalya at dusk: the sky, the Bey mountains across the middle
 * and the sea under them. `SHORE` is the line the sea meets the land on.
 */
const SHORE = 121;
/**
 * The near range: a run of peaks from the left, the tallest of them near the
 * middle, then a long slope down to the shore.
 */
const RANGE =
  'M10 109L15.5 104.5L20.5 108.5L29 101.5L31.5 102L36 106.8L41 105.8L45 108L49.5 102.4L53.5 106.6L56.5 105.2L61.5 98.6L66.5 104.6L69.5 102.4L73.5 107.4L75.5 106.8L80 112L84 116Q88 119.6 94 121';
/** The far massif, taller and rounder, rising behind that slope and running off the right edge. */
const MASSIF =
  'M76 113L80.5 111.4C85 109 89.5 104 93 99.6C95.5 96.4 97 93.2 99.5 92.6C100.6 92.4 101 93.4 102 93C104 92 105.6 89.8 107.8 89.6C110.6 89.4 112.6 91.4 114.5 93.4C115.8 94.7 117 95.5 118 95.8';
/** The last light of the day, behind the mountains where the two meet. */
const DUSK = { rx: 52, ry: 32, x: 78, y: SHORE - 7 };
/**
 * The lights along the shore: a few on the left, the town under the massif.
 * Each is where it is, how large, and how long after the others it first goes
 * dim, in milliseconds.
 */
const LIGHTS = [
  { late: 0, r: 0.7, x: 33 },
  { late: 1900, r: 0.6, x: 36.5 },
  { late: 800, r: 0.7, x: 50 },
  { late: 2700, r: 0.6, x: 61 },
  { late: 1300, r: 0.6, x: 72 },
  { late: 400, r: 0.7, x: 96.5 },
  { late: 2300, r: 0.9, x: 99.5 },
  { late: 1100, r: 0.6, x: 102.5 },
  { late: 3000, r: 1, x: 105.5 },
  { late: 1700, r: 0.7, x: 108.5 },
  { late: 600, r: 0.9, x: 111.5 },
  { late: 2500, r: 0.6, x: 114.5 },
];
/** How far over the shore line the lights stand. */
const LIGHT_UP = 1.5;
/** When the lights and the sea start to move, in milliseconds: once the postmark is on. */
const CALM = 1600;
/** One ripple of the sea: a short calm wave, from where it starts. */
const ripple = (x: number, y: number) => `M${x} ${y}q2.5 -1.5 5 0t5 0t5 0`;
/**
 * The sea's ripples, in two sets that drift against each other. The ones on
 * the left lie between the postmark's lines, the others clear of them.
 */
const RIPPLES = [
  [ripple(43, 133.2), ripple(96, 126.5), ripple(71, 143), ripple(99, 145.5)],
  [ripple(66, 132), ripple(46, 144.2), ripple(93, 136)],
];
/** The heart in the sky, where the evening star stands. */
const HEART = { scale: 1.5, x: 60, y: 60 };
/** A heart in a 24 unit box, as one line a pen can draw from its foot round to its foot. */
const HEART_LINE =
  'M12 21s-7.5-4.6-9.3-9.5C1.4 8 3.4 4.5 6.9 4.5c2 0 3.7 1 5.1 2.9 1.4-1.9 3.1-2.9 5.1-2.9 3.5 0 5.5 3.5 4.2 7C19.5 16.4 12 21 12 21Z';
/**
 * The postmark: two rings, set straight, with the place round the top between
 * them and the year round the foot.
 */
const MARK = { inner: 23, outer: 34, x: 50, y: 150 };
/**
 * The postmark's words: how large they are set, and how tall a capital or a
 * figure of Suisse Intl stands on its line, as a share of that size.
 */
const WORDS_SIZE = 7.5;
const WORDS_CAP = 0.725;
/**
 * The circles the two words are set on. The place stands on its circle and
 * the year hangs from its own, so each circle is half a capital off the
 * middle of the band, and both words are as far from one ring as from the
 * other.
 */
const WORDS_OFF = (WORDS_CAP * WORDS_SIZE) / 2;
const PLACE_CIRCLE = (MARK.inner + MARK.outer) / 2 - WORDS_OFF;
const YEAR_CIRCLE = (MARK.inner + MARK.outer) / 2 + WORDS_OFF;
/**
 * Half a circle for a word to run along, from nine o'clock to three: over the
 * top, or under the foot. Its middle is at twelve or at six, where the word's
 * own middle is put.
 */
const half = (radius: number, over: boolean) =>
  `M${-radius} 0 A${radius} ${radius} 0 0 ${over ? 1 : 0} ${radius} 0`;
/** The lines the postmark cancels the stamp with, running off its right side. */
const WAVES = [-11, 0, 11].map((dy) => `M${MARK.outer + 4} ${dy} q7 -5 14 0 t14 0 t14 0 t14 0`);
/**
 * The heart's line, in the heart's own units, so it comes out a pixel and a
 * half wide where the stamp is drawn at its full size. It cannot be held to
 * the page's width the way the other lines are: a pen draws it, and a line
 * held that way loses the measure the pen draws it by.
 */
const HEART_STROKE = 1;

/**
 * A rectangle with half circles bitten out of all four sides, the way a
 * stamp is torn from its sheet. What is left over along a side is split
 * between its two ends, so the corners match.
 */
function perforated(width: number, height: number): string {
  const side = (length: number, line: (by: number) => string, bite: string) => {
    const teeth = Math.floor(length / PITCH);
    const end = (length - teeth * PITCH) / 2;
    const flat = PITCH / 2 - BITE;
    const tooth = line(flat) + bite + line(flat);
    return line(end) + tooth.repeat(teeth) + line(end);
  };
  return [
    'M0 0',
    side(width, (by) => `h${by}`, `a${BITE} ${BITE} 0 0 0 ${2 * BITE} 0`),
    side(height, (by) => `v${by}`, `a${BITE} ${BITE} 0 0 0 0 ${2 * BITE}`),
    side(width, (by) => `h${-by}`, `a${BITE} ${BITE} 0 0 0 ${-2 * BITE} 0`),
    side(height, (by) => `v${-by}`, `a${BITE} ${BITE} 0 0 0 0 ${-2 * BITE}`),
    'Z',
  ].join('');
}
const STAMP_EDGE = perforated(STAMP.width, STAMP.height);

/** A part of the section rising into place, out of a blur. */
const rise = keyframes({
  from: {
    filter: `blur(${blur.medium})`,
    opacity: 0,
    transform: `translateY(${distance.medium})`,
  },
});
/** The heart drawn by a pen, from its foot round to its foot. */
const draw = keyframes({
  from: { strokeDashoffset: 1 },
  to: { strokeDashoffset: 0 },
});
/** Its colour coming in under the line once the pen is done. */
const wash = keyframes({
  from: { opacity: 0 },
});
/** The postmark coming down on the stamp: from above it and a little turned, then pressed flat. */
const press = keyframes({
  from: { opacity: 0, transform: 'rotate(-10deg) scale(1.3)' },
});
/** The heart's soft beat, once in a while. Most of its turn it stands still. */
const beatSoft = keyframes({
  '0%': { transform: 'scale(1)' },
  '100%': { transform: 'scale(1)' },
  '12%': { transform: 'scale(1)' },
  '6%': { transform: 'scale(1.06)' },
});
/** A light on the shore going dim and bright again. */
const twinkle = keyframes({
  '0%': { opacity: 1 },
  '100%': { opacity: 1 },
  '50%': { opacity: 0.4 },
});
/** The sea's ripples drifting a little along the shore and back. */
const drift = keyframes({
  '0%': { transform: 'translateX(0)' },
  '100%': { transform: 'translateX(0)' },
  '50%': { transform: 'translateX(3px)' },
});
/** The button's heart under the pointer: past its size and back, once. */
const beat = keyframes({
  '0%': { transform: 'scale(1)' },
  '100%': { transform: 'scale(1)' },
  '40%': { transform: 'scale(1.25)' },
});

const styles = create({
  // Waits for a delay a part sets, by its place in the order they come in by.
  after: (ms: number) => ({
    animationDelay: `${ms}ms`,
  }),
  // The one thing to press, a step clear of the words over it.
  button: {
    marginBlockStart: spacing.s2,
  },
  // The ripples drift once the stamp is in, slowly, one set against the other.
  drift: {
    animationDelay: `${CALM}ms`,
    animationDuration: '9s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: drift,
    },
    animationTimingFunction: easing.inOut,
  },
  driftBack: {
    animationDirection: 'reverse',
    animationDuration: '11s',
  },
  // The last light of the day: the gold, strongest on the horizon and gone a
  // little way up the sky.
  duskFar: {
    stopColor: tint.gold,
    stopOpacity: 0,
  },
  duskNear: {
    stopColor: tint.gold,
    stopOpacity: 0.32,
  },
  // What is true of all of it, small and quiet, in a row that wraps: plain
  // words with space between them, nothing boxed.
  facts: {
    color: colors.muted,
    columnGap: spacing.s6,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    rowGap: spacing.s1,
  },
  // The stamp's printed line, the lines of its view, and the postmark's rings
  // and waves.
  hairline: {
    fill: 'none',
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  // The heart on the button, in the one orange. It sits in a wrapper because
  // a browser draws a scaled icon soft where the icon itself is scaled.
  heart: {
    animationDuration: duration.verySlow,
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: null,
      [when.ancestor(':hover')]: beat,
    },
    animationTimingFunction: easing.bounce,
    color: accent.base,
    display: 'flex',
  },
  // The stamp's heart: an orange line, with a wash of the same under it.
  heartLine: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: HEART_STROKE,
  },
  // The line is drawn as the stamp arrives.
  heartLineDrawn: {
    animationDelay: '300ms',
    animationDuration: '900ms',
    animationFillMode: 'backwards',
    animationName: draw,
    animationTimingFunction: easing.inOut,
    strokeDasharray: 1,
  },
  heartWash: {
    fill: accent.base,
    opacity: 0.12,
  },
  // The wash comes in once the pen is done.
  heartWashIn: {
    animationDelay: '1100ms',
    animationDuration: duration.slow,
    animationFillMode: 'backwards',
    animationName: wash,
    animationTimingFunction: easing.inOut,
  },
  // The stamp's heart beats softly once the postmark is on, about every four
  // seconds, round its own middle.
  heartSoft: {
    animationDelay: '2400ms',
    animationDuration: '4s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: beatSoft,
    },
    animationTimingFunction: easing.inOut,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  // Below the fold once the page has come alive, a part waits out of sight
  // for its rise.
  hidden: {
    opacity: 0,
  },
  // The far massif and the sea's ripples, a step fainter than the near range.
  faint: {
    opacity: 0.5,
  },
  // A light on the shore, in the gold.
  light: {
    fill: tint.gold,
  },
  // The lights twinkle softly once the stamp is in, each on its own time.
  lightSoft: {
    animationDuration: '3.6s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: twinkle,
    },
    animationTimingFunction: easing.inOut,
  },
  // The paragraphs under the title, held to a measure a line is easy to read
  // at, in the muted ink the page's other sections say their piece in.
  line: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.6,
    margin: 0,
    maxWidth: '48ch',
    textWrap: 'pretty',
  },
  // The postmark's ink: the page's own, thinned, as a rubber stamp leaves it.
  mark: {
    opacity: 0.6,
    stroke: colors.fg,
  },
  // The postmark comes down after the heart is drawn.
  markPressed: {
    animationDelay: '1300ms',
    animationDuration: duration.fast,
    animationFillMode: 'backwards',
    animationName: press,
    animationTimingFunction: easing.smoothOut,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  // The last letter of a word round the postmark takes no space after it.
  markLast: {
    letterSpacing: 0,
  },
  // The words round the postmark, spaced as a rubber stamp's letters are.
  markWords: {
    fill: colors.fg,
    fontSize: WORDS_SIZE,
    fontWeight: font.weightMedium,
    letterSpacing: '0.14em',
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  // A mountain's body: the stamp's paper, so what is behind it does not show
  // through.
  land: {
    fill: colors.bg,
  },
  // The mountains' outline, the shore and the sea, in the muted ink.
  view: {
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  // The stamp's paper: the page's own, so the lines under it give way to it.
  paper: {
    fill: colors.bg,
    stroke: colors.muted,
    strokeLinejoin: 'round',
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
  },
  printed: {
    stroke: colors.border,
  },
  rise: {
    animationDuration: duration.verySlow,
    animationFillMode: 'backwards',
    animationName: rise,
    animationTimingFunction: easing.smoothOut,
  },
  // The words on the left, the stamp to their right and level with their
  // top, where a stamp sits on an envelope. On a narrow window the stamp
  // comes first, small, and the words under it.
  section: {
    alignItems: 'start',
    columnGap: spacing.s12,
    display: 'grid',
    gridTemplateAreas: {
      '@media (min-width: 768px)': '"words stamp"',
      default: '"stamp" "words"',
    },
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'minmax(0, 1fr) auto',
      default: 'minmax(0, 1fr)',
    },
    rowGap: spacing.s6,
  },
  // The stamp, as wide as a real one reads at beside the words.
  stamp: {
    display: 'block',
    gridArea: 'stamp',
    height: 'auto',
    overflow: 'visible',
    width: {
      '@media (min-width: 768px)': 220,
      default: 148,
    },
  },
  // What the stamp is worth, and whose it is, in the stamp's own small type.
  stampName: {
    fill: colors.muted,
    fontSize: 7.5,
    letterSpacing: '0.04em',
  },
  stampValue: {
    fill: colors.fg,
    fontSize: 11,
    fontWeight: font.weightMedium,
  },
  // The title, a step clear of the lines under it.
  title: {
    marginBlockEnd: spacing.s2,
  },
  // The words, in one column: the title, what it says, the button, the facts.
  words: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    gridArea: 'words',
  },
});

/**
 * A word of the postmark, set round the circle drawn as `line`, with its
 * middle on the circle's upright axis. The space after each letter would
 * follow the last one too and push the word half of it off that axis, so the
 * last letter is set without it.
 */
function RingWord({ line, word }: { line: string; word: string }) {
  return (
    <text textAnchor="middle" {...props(styles.markWords)}>
      <textPath href={`#${line}`} startOffset="50%">
        {word.slice(0, -1)}
        <tspan {...props(styles.markLast)}>{word.slice(-1)}</tspan>
      </textPath>
    </text>
  );
}

/**
 * A postage stamp, drawn in the page's lines: its bitten edge and a printed
 * line inside it, and in that the view from Antalya at dusk. The mountains
 * stand across the middle, a run of peaks and a taller massif behind them on
 * the right, with the day's last light in the gold where the two meet. Under
 * them are the lights along the shore and the sea, and in the sky the heart,
 * where the evening star stands. What the stamp is worth is in its top corner
 * and the site's name runs up its left side. Over its lower corner is a
 * postmark with the place and the year.
 *
 * `play` draws it in: the stamp is there, the pen draws the heart, the
 * postmark comes down, and from then on the heart beats softly once in a
 * while, the lights twinkle and the sea's ripples drift. Without `play` it
 * stands finished and still.
 */
function Stamp({
  beatRef,
  play,
  style,
}: {
  /** The heart, for whoever wants to give it a beat of their own. */
  beatRef: Ref<SVGGElement>;
  play: boolean;
  style: StyleXStyles;
}) {
  const id = useId();
  const place = `${id}-place`;
  const year = `${id}-year`;
  const view = `${id}-view`;
  const dusk = `${id}-dusk`;
  return (
    <svg
      aria-label={m.home_support_stamp()}
      role="img"
      viewBox={`0 0 ${SHEET.width} ${SHEET.height}`}
      {...props(styles.stamp, style)}
    >
      <defs>
        <path d={half(PLACE_CIRCLE, true)} id={place} />
        <path d={half(YEAR_CIRCLE, false)} id={year} />
        <clipPath id={view}>
          <rect height={VIEW.height} rx={2} width={VIEW.width} x={VIEW.x} y={VIEW.y} />
        </clipPath>
        {/* A circle of light, pressed flat along the horizon. */}
        <radialGradient
          cx={DUSK.x}
          cy={DUSK.y}
          gradientTransform={`translate(0 ${DUSK.y}) scale(1 ${DUSK.ry / DUSK.rx}) translate(0 ${-DUSK.y})`}
          gradientUnits="userSpaceOnUse"
          id={dusk}
          r={DUSK.rx}
        >
          <stop offset="0" {...props(styles.duskNear)} />
          <stop offset="1" {...props(styles.duskFar)} />
        </radialGradient>
      </defs>
      <g
        transform={`translate(${STAMP.x} ${STAMP.y}) rotate(${STAMP.turn} ${STAMP.width / 2} ${STAMP.height / 2})`}
      >
        <path d={STAMP_EDGE} {...props(styles.paper)} />
        <g clipPath={`url(#${view})`}>
          <rect
            fill={`url(#${dusk})`}
            height={SHORE - VIEW.y}
            width={VIEW.width}
            x={VIEW.x}
            y={VIEW.y}
          />
          <path d={`${MASSIF}V${SHORE}H76Z`} {...props(styles.land)} />
          <path d={MASSIF} {...props(styles.hairline, styles.view)} />
          <path d={`${RANGE}H${VIEW.x}Z`} {...props(styles.land)} />
          <path d={RANGE} {...props(styles.hairline, styles.view)} />
          <path
            d={`M${VIEW.x} ${SHORE}H${VIEW.x + VIEW.width}`}
            {...props(styles.hairline, styles.view, styles.faint)}
          />
          {LIGHTS.map((light) => (
            <circle
              cx={light.x}
              cy={SHORE - LIGHT_UP}
              key={light.x}
              r={light.r}
              {...props(styles.light, play && [styles.lightSoft, styles.after(CALM + light.late)])}
            />
          ))}
          {RIPPLES.map((set, index) => (
            <g key={set[0]} {...props(play && [styles.drift, index === 1 && styles.driftBack])}>
              {set.map((d) => (
                <path d={d} key={d} {...props(styles.hairline, styles.view, styles.faint)} />
              ))}
            </g>
          ))}
        </g>
        <rect
          height={STAMP.height - 2 * FRAME}
          rx={2}
          width={STAMP.width - 2 * FRAME}
          x={FRAME}
          y={FRAME}
          {...props(styles.hairline, styles.printed)}
        />
        <text
          textAnchor="end"
          x={STAMP.width - FRAME - 8}
          y={FRAME + 18}
          {...props(styles.stampValue)}
        >
          {m.home_support_stamp_value()}
        </text>
        <g
          transform={`translate(${HEART.x - 12 * HEART.scale} ${HEART.y - 12 * HEART.scale}) scale(${HEART.scale})`}
        >
          <g ref={beatRef} {...props(play && styles.heartSoft)}>
            <path d={HEART_LINE} {...props(styles.heartWash, play && styles.heartWashIn)} />
            <path
              d={HEART_LINE}
              pathLength={1}
              {...props(styles.heartLine, play && styles.heartLineDrawn)}
            />
          </g>
        </g>
        {/* Whose stamp it is, up its left side in the sky, over the postmark. */}
        <text
          textAnchor="end"
          transform={`translate(${FRAME + 10.5} ${FRAME + 8}) rotate(-90)`}
          {...props(styles.stampName)}
        >
          {m.site_name()}
        </text>
      </g>
      <g transform={`translate(${MARK.x} ${MARK.y})`}>
        <g {...props(play && styles.markPressed)}>
          <circle r={MARK.outer} {...props(styles.hairline, styles.mark)} />
          <circle r={MARK.inner} {...props(styles.hairline, styles.mark)} />
          {WAVES.map((d) => (
            <path d={d} key={d} {...props(styles.hairline, styles.mark)} />
          ))}
          <RingWord line={place} word={m.home_support_postmark_place()} />
          <RingWord line={year} word={m.home_support_postmark_year()} />
        </g>
      </g>
    </svg>
  );
}

/**
 * Why everything is free and the way to support the work, in the founder's
 * own words, set as the corner of an envelope: the words on the left, a
 * stamp of Antalya with a heart in its sky and a postmark to their right. The title carries
 * the section, in the page's display size, which the page hands it; under it
 * three short paragraphs at a readable measure, the one button, and two
 * plain facts in quiet type. Nothing is boxed.
 *
 * The server draws it finished. Still under the window once the page has come
 * alive, its parts hide and rise one after another as it comes into view, the
 * stamp's heart is drawn and the postmark comes down on it, and then its
 * lights twinkle and its sea drifts; off screen it goes back to waiting, so
 * it plays again. The hearts beat once under a pointer on the button. With
 * less motion everything stands still.
 */
export function SupportSection({ titleStyle }: { titleStyle: StyleXStyles }) {
  const posthog = usePostHog();
  const section = useRef<HTMLDivElement>(null);
  const stampHeart = useRef<SVGGElement>(null);
  const reduced = useLessMotion();
  const seen = useSeen(section);
  // Whether the section was under the window as the page came alive.
  const [below, setBelow] = useState(false);

  // Measured once, before the page paints again: only a section wholly under
  // the window is hidden, where nobody sees it go.
  useLayoutEffect(() => {
    const top = section.current?.getBoundingClientRect().top;
    setBelow(top !== undefined && top > window.innerHeight);
  }, []);

  const moving = below && !reduced;
  // A part's rise, by its place in the order: out of sight until the section
  // is seen, then up, a step after the part before it.
  const part = (place: number): StyleXStyles =>
    moving && (seen ? [styles.rise, styles.after(place * STAGGER)] : styles.hidden);

  return (
    <div ref={section} {...props(styles.section)}>
      <div {...props(styles.words)}>
        <h2 {...props(titleStyle, styles.title, part(0))}>{m.home_support_title()}</h2>
        <p {...props(styles.line, part(1))}>{m.home_support_free()}</p>
        <p {...props(styles.line, part(2))}>{m.home_support_why()}</p>
        <p {...props(styles.line, part(3))}>{m.home_support_ask()}</p>
        <Button
          onClick={() => posthog.capture('support_clicked', { placement: 'support_section' })}
          onPointerEnter={() => {
            // The stamp's heart answers the button's: one beat, on top of its own.
            if (!prefersLessMotion()) {
              stampHeart.current?.animate(
                [
                  { transform: 'scale(1)' },
                  { transform: 'scale(1.12)' },
                  { transform: 'scale(1)' },
                ],
                { composite: 'add', duration: 500, easing: 'cubic-bezier(0.34, 1.36, 0.64, 1)' },
              );
            }
          }}
          render={<a href={SUPPORT_URL} rel="noreferrer" target="_blank" />}
          style={[styles.button, defaultMarker(), part(4)]}
        >
          <span {...props(styles.heart)}>
            <Heart aria-hidden="true" size={HEART_SIZE} weight="Filled" />
          </span>
          {m.home_support_cta()}
        </Button>
        <ul {...props(styles.facts, part(5))}>
          <li>
            <a href={REPO_URL} rel="noreferrer" target="_blank">
              {m.home_support_fact_open()}
            </a>
          </li>
          <li>{m.home_support_fact_tracking()}</li>
        </ul>
      </div>
      <Stamp beatRef={stampHeart} play={moving && seen} style={part(1)} />
    </div>
  );
}
