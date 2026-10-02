import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { backOut, easeInOut } from 'motion/react';
import { drawing, easing } from '../../lib/motion.stylex.ts';
import { HEIGHT, WIDTH } from './box.ts';
import { Cable } from './cable.tsx';
import { Laptop, MAC_PLUG } from './laptop.tsx';
import { APPS, AppSquare, FEEDS, FeedIcon, PHONE, PhoneFrame } from './phone.tsx';
import { stretch, usePlayhead } from './playhead.ts';

/** What is drawn on an app's square: something of the reader's own that it holds. */
type Glyph = 'message' | 'notes' | 'person' | 'photo';

/** The apps that hold something, by their place on the home screen; the rest are plain. */
const GLYPHS: ReadonlyMap<number, Glyph> = new Map([
  [0, 'photo'],
  [1, 'message'],
  [3, 'notes'],
  [6, 'person'],
  [9, 'photo'],
  [12, 'message'],
  [14, 'notes'],
  [21, 'photo'],
]);
const GLYPH_PATHS: Record<Glyph, string> = {
  message:
    'M-3.6 -0.6 C-3.6 -2.4 -1.9 -3.4 0 -3.4 C1.9 -3.4 3.6 -2.4 3.6 -0.6 C3.6 1.2 1.9 2.2 0 2.2 C-0.6 2.2 -1.2 2.1 -1.7 1.9 L-3.4 3 L-2.8 1.2 C-3.3 0.7 -3.6 0.1 -3.6 -0.6 Z',
  notes: 'M-3.5 -2.5 H3.5 M-3.5 0 H3.5 M-3.5 2.5 H1',
  person:
    'M1.6 -1.8 A1.6 1.6 0 1 1 -1.6 -1.8 A1.6 1.6 0 1 1 1.6 -1.8 Z M-3.4 3.6 C-3.4 1.4 -1.8 0.6 0 0.6 C1.8 0.6 3.4 1.4 3.4 3.6',
  photo:
    'M-4 3.4 L-1.2 0 L0.8 2 L2 0.8 L4 3.4 M3.4 -2.4 A1.1 1.1 0 1 1 1.2 -2.4 A1.1 1.1 0 1 1 3.4 -2.4 Z',
};
/** The feeds chosen on the Mac, by their place on the home screen, in the order they go. */
const PICKS = [2, 4, 11, 13];

/**
 * Where the laptop and the phone stand: each drawn in its own units, moved
 * by `x` and `y` and sized by `scale`. The laptop is smaller than in the
 * first step and off to the left; the phone's top left corner is at 154, 12.
 */
type Place = { scale: number; x: number; y: number };
const MAC: Place = { scale: 0.7, x: -2, y: 60 };
const IPHONE: Place = { scale: 0.85, x: 86, y: 3.5 };
/** The plug in the phone's port, in the phone's units. */
const PHONE_PLUG = { height: 6, width: 5 };
/** How far under the phone the cable sags on its way from the laptop. */
const SAG = 168;

/** The pulse runs down the cable, and once it is in, the chosen apps go one after another. */
const TRAVEL = { from: 0.04, to: 0.38 };
const GONE = { from: 0.38, length: 0.14, next: 0.06 };
/** How much of its size a chosen app has lost by the time it is gone. */
const GONE_SCALE = 0.6;
/** Then the lock comes up over the phone's top corner, and its shackle, this far open, shuts. */
const BADGE_FROM = 0.62;
const BADGE_SCALE = 0.4;
const OPEN = 3.5;
const BODY = { height: 12, radius: 2.5, width: 16, y: -2 };
const SHACKLE = 'M-4.5 -2 V-6.5 A4.5 4.5 0 0 1 4.5 -6.5 V-2';
const KEYHOLE = 'M0 2.5 V5.5';

/** A point in a drawing's own units, where it stands in the box once put at `place`. */
function placed(place: Place, x: number, y: number): { x: number; y: number } {
  return { x: place.x + place.scale * x, y: place.y + place.scale * y };
}

/** The transform that puts a drawing at `place`. */
function transform(place: Place): string {
  return `translate(${place.x} ${place.y}) scale(${place.scale})`;
}

const OUT = placed(MAC, MAC_PLUG.x + MAC_PLUG.width, MAC_PLUG.y + MAC_PLUG.height / 2);
const PORT = placed(
  IPHONE,
  PHONE.x + PHONE.width / 2,
  PHONE.y + PHONE.height + 1 + PHONE_PLUG.height,
);
/** The cable: out of the laptop's side, sagging under the phone, and up into its port. */
const CABLE = `M${OUT.x} ${OUT.y} C${OUT.x + 20} ${OUT.y} ${OUT.x + 16} ${SAG} ${OUT.x + 38} ${SAG} C${PORT.x - 12} ${SAG} ${PORT.x} ${SAG - 4} ${PORT.x} ${PORT.y}`;
const BADGE = placed(IPHONE, PHONE.x + PHONE.width, PHONE.y + 9);

/** Once the lock is shut, a ring of it goes out now and then, and nothing else moves. */
const ripple = keyframes({
  from: { opacity: 0.5, transform: 'scale(1)' },
  to: { opacity: 0, transform: 'scale(1.9)' },
});

const styles = create({
  glyph: {
    fill: 'none',
    opacity: 0.7,
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 0.8,
  },
  graphic: {
    display: 'block',
    height: 'auto',
    marginInline: 'auto',
    maxWidth: 280,
    overflow: 'visible',
    width: '100%',
  },
  line: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinejoin: 'round',
    strokeWidth: 1,
  },
  // The lock, its body filled with the page so the corner under it gives way to it.
  lock: {
    fill: colors.bg,
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.4,
  },
  ripple: {
    animationDuration: '2.4s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: ripple,
    },
    animationTimingFunction: easing.smoothOut,
    fill: 'none',
    opacity: 0,
    stroke: accent.base,
    strokeWidth: 0.75,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  // The shackle and the keyhole.
  lockLine: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.4,
  },
});

/**
 * A small Mac on the left, the iPhone on the right and the cable between
 * them, the feeds chosen on the Mac by their own icons on the phone's home
 * screen among the reader's photos, messages and notes: a pulse runs down the
 * cable, the chosen feeds go one after another while everything else stays,
 * and an orange lock comes up over the phone's corner and shuts. It plays
 * once each time `play` turns on and stands with the chosen feeds still there
 * while it is off. With less motion it stands locked.
 */
export function StaysGraphic({ play }: { play: boolean }) {
  const at = usePlayhead(play, drawing.stepStays);
  const travel = stretch(at, TRAVEL.from, TRAVEL.to, easeInOut);
  const shown = stretch(at, BADGE_FROM, BADGE_FROM + 0.18);
  const shut = stretch(at, BADGE_FROM + 0.12, BADGE_FROM + 0.28, backOut);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.graphic)}>
      <g transform={transform(MAC)}>
        <Laptop plugged={1} />
      </g>
      <g transform={transform(IPHONE)}>
        <PhoneFrame />
        {APPS.map((app, index) => {
          const order = PICKS.indexOf(index);
          const start = GONE.from + order * GONE.next;
          const gone = order === -1 ? 0 : stretch(at, start, start + GONE.length);
          const feed = order === -1 ? undefined : FEEDS[order];
          const glyph = GLYPHS.get(index);
          return gone < 1 ? (
            <g
              key={index}
              opacity={1 - gone}
              transform={`translate(${app.x} ${app.y}) scale(${1 - GONE_SCALE * gone})`}
            >
              {feed === undefined ? <AppSquare /> : <FeedIcon bundleId={feed} />}
              {glyph === undefined ? null : (
                <path d={GLYPH_PATHS[glyph]} {...props(styles.glyph)} />
              )}
            </g>
          ) : null;
        })}
        <rect
          height={PHONE_PLUG.height}
          rx={1}
          width={PHONE_PLUG.width}
          x={PHONE.x + (PHONE.width - PHONE_PLUG.width) / 2}
          y={PHONE.y + PHONE.height + 1}
          {...props(styles.line)}
        />
      </g>
      <Cable d={CABLE} drawn={1} travel={travel} />
      {shown > 0 ? (
        <g
          opacity={shown}
          transform={`translate(${BADGE.x} ${BADGE.y}) scale(${1 - BADGE_SCALE * (1 - shown)})`}
        >
          {at >= 1 ? (
            <rect
              height={BODY.height}
              rx={BODY.radius}
              width={BODY.width}
              x={-BODY.width / 2}
              y={BODY.y}
              {...props(styles.ripple)}
            />
          ) : null}
          <path
            d={SHACKLE}
            transform={`translate(0 ${-OPEN * (1 - shut)})`}
            {...props(styles.lockLine)}
          />
          <rect
            height={BODY.height}
            rx={BODY.radius}
            width={BODY.width}
            x={-BODY.width / 2}
            y={BODY.y}
            {...props(styles.lock)}
          />
          <path d={KEYHOLE} {...props(styles.lockLine)} />
        </g>
      ) : null}
    </svg>
  );
}
