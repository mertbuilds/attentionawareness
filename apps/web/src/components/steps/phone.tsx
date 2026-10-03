import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useId } from 'react';
import { WIDTH } from './box.ts';

/**
 * The iPhone the last step draws, upright in the middle of the box, from
 * where that step moves it aside to make room for the Mac.
 */
export const PHONE = { height: 160, radius: 14, width: 80, x: (WIDTH - 80) / 2, y: 10 };
/** The screen sits this far inside the body, its corners concentric with the body's. */
const BEZEL = 3;
const ISLAND = { height: 6, top: 3, width: 20 };
/** An app's square, and how far one app's square stands from the next. */
export const ICON = 12;
const ICON_RADIUS = 3;
const PITCH = { x: 17, y: 19 };
const COLUMNS = 4;
const ROWS = 5;
const GRID_TOP = 31;
/** The dock's tray along the bottom of the screen, and how far in from its edges the apps sit. */
const DOCK = { height: 18, inset: 3, radius: 6, y: 143 };
/**
 * A phone drawn far larger than a step draws it, as the hero does, keeps its
 * lines at the page's own width with `hairline`, rather than as thick as the
 * drawing is large.
 */
const HAIRLINE = 'non-scaling-stroke';
/**
 * The feeds chosen on the Mac, in the order they are chosen, by bundle id:
 * TikTok, Instagram, YouTube and X. Their icons are in `public/media/apps`.
 */
export const FEEDS = [
  'com.zhiliaoapp.musically',
  'com.burbn.instagram',
  'com.google.ios.youtube',
  'com.atebits.Tweetie2',
] as const;

const GRID_LEFT = PHONE.x + (PHONE.width - (COLUMNS - 1) * PITCH.x - ICON) / 2;
const SCREEN = {
  height: PHONE.height - 2 * BEZEL,
  radius: PHONE.radius - BEZEL,
  width: PHONE.width - 2 * BEZEL,
  x: PHONE.x + BEZEL,
  y: PHONE.y + BEZEL,
};

/** An app the reader keeps, by the line drawn on its square. */
export type Glyph =
  | 'bank'
  | 'camera'
  | 'clock'
  | 'contacts'
  | 'mail'
  | 'maps'
  | 'messages'
  | 'music'
  | 'notes'
  | 'phone'
  | 'photos';

const GLYPHS: Record<Glyph, string> = {
  bank: 'M-4 -1.4 L0 -3.6 L4 -1.4 Z M-2.6 0 V2.2 M0 0 V2.2 M2.6 0 V2.2 M-4 3.6 H4',
  camera:
    'M-4 -1.6 H-1.6 L-0.8 -2.8 H0.8 L1.6 -1.6 H4 V3 H-4 Z M1.5 0.7 A1.5 1.5 0 1 1 -1.5 0.7 A1.5 1.5 0 1 1 1.5 0.7 Z',
  clock: 'M3.8 0 A3.8 3.8 0 1 1 -3.8 0 A3.8 3.8 0 1 1 3.8 0 Z M0 -2.4 V0 L1.6 1',
  contacts:
    'M1.6 -1.8 A1.6 1.6 0 1 1 -1.6 -1.8 A1.6 1.6 0 1 1 1.6 -1.8 Z M-3.4 3.6 C-3.4 1.4 -1.8 0.6 0 0.6 C1.8 0.6 3.4 1.4 3.4 3.6',
  mail: 'M-4 -2.8 H4 V2.8 H-4 Z M-4 -2.8 L0 0.6 L4 -2.8',
  maps: 'M-4 -2.6 L-1.4 -3.6 L1.4 -2.6 L4 -3.6 V2.6 L1.4 3.6 L-1.4 2.6 L-4 3.6 Z M-1.4 -3.6 V2.6 M1.4 -2.6 V3.6',
  messages:
    'M-3.6 -0.6 C-3.6 -2.4 -1.9 -3.4 0 -3.4 C1.9 -3.4 3.6 -2.4 3.6 -0.6 C3.6 1.2 1.9 2.2 0 2.2 C-0.6 2.2 -1.2 2.1 -1.7 1.9 L-3.4 3 L-2.8 1.2 C-3.3 0.7 -3.6 0.1 -3.6 -0.6 Z',
  music:
    'M-1.2 2.2 V-2.6 L3.4 -3.4 V1.4 M-1.2 2.2 A1.2 1.2 0 1 1 -3.6 2.2 A1.2 1.2 0 1 1 -1.2 2.2 Z M3.4 1.4 A1.2 1.2 0 1 1 1 1.4 A1.2 1.2 0 1 1 3.4 1.4 Z',
  notes: 'M-3.5 -2.5 H3.5 M-3.5 0 H3.5 M-3.5 2.5 H1',
  phone:
    'M-3.2 -2.4 L-2.4 -3.2 L-1.2 -2 L-2 -1.2 Q-1.5 1.5 1.2 2 L2 1.2 L3.2 2.4 L2.4 3.2 Q-2.7 2.7 -3.2 -2.4 Z',
  photos:
    'M-4 3.4 L-1.2 0 L0.8 2 L2 0.8 L4 3.4 M3.4 -2.4 A1.1 1.1 0 1 1 1.2 -2.4 A1.1 1.1 0 1 1 3.4 -2.4 Z',
};

/** One app on the home screen: the middle of its square. */
export type App = { x: number; y: number };

/** Every app, a row at a time from the top, and the dock's last. */
export const APPS: ReadonlyArray<App> = [
  ...Array.from({ length: ROWS * COLUMNS }, (_, index) => ({
    x: GRID_LEFT + (index % COLUMNS) * PITCH.x + ICON / 2,
    y: GRID_TOP + Math.floor(index / COLUMNS) * PITCH.y + ICON / 2,
  })),
  ...Array.from({ length: COLUMNS }, (_, column) => ({
    x: GRID_LEFT + column * PITCH.x + ICON / 2,
    y: DOCK.y + DOCK.inset + ICON / 2,
  })),
];

const styles = create({
  app: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  body: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  dock: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
  },
  feedEdge: {
    fill: 'none',
    stroke: colors.border,
    strokeWidth: 1,
  },
  glyph: {
    fill: 'none',
    opacity: 0.7,
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 0.8,
  },
  // The glass and the island on it, a step fainter than the body.
  screen: {
    fill: 'none',
    opacity: 0.5,
    stroke: colors.muted,
    strokeWidth: 1,
  },
});

/** The phone's body, its screen and island, and the dock's tray, with no apps on it. */
export function PhoneFrame({ hairline = false }: { hairline?: boolean }) {
  const dockLeft = GRID_LEFT - DOCK.inset;
  const line = hairline ? HAIRLINE : undefined;
  return (
    <>
      <rect
        height={PHONE.height}
        rx={PHONE.radius}
        vectorEffect={line}
        width={PHONE.width}
        x={PHONE.x}
        y={PHONE.y}
        {...props(styles.body)}
      />
      <rect
        height={SCREEN.height}
        rx={SCREEN.radius}
        vectorEffect={line}
        width={SCREEN.width}
        x={SCREEN.x}
        y={SCREEN.y}
        {...props(styles.screen)}
      />
      <rect
        height={ISLAND.height}
        rx={ISLAND.height / 2}
        vectorEffect={line}
        width={ISLAND.width}
        x={(WIDTH - ISLAND.width) / 2}
        y={SCREEN.y + ISLAND.top}
        {...props(styles.screen)}
      />
      <rect
        height={DOCK.height}
        rx={DOCK.radius}
        vectorEffect={line}
        width={WIDTH - 2 * dockLeft}
        x={dockLeft}
        y={DOCK.y}
        {...props(styles.dock)}
      />
    </>
  );
}

/** An app's square, around the origin, for a group placed at the app's middle. */
export function AppSquare({ hairline = false }: { hairline?: boolean }) {
  return (
    <rect
      height={ICON}
      rx={ICON_RADIUS}
      vectorEffect={hairline ? HAIRLINE : undefined}
      width={ICON}
      x={-ICON / 2}
      y={-ICON / 2}
      {...props(styles.app)}
    />
  );
}

/** The line drawn on a kept app's square, around the origin like the square. */
export function AppGlyph({ glyph, hairline = false }: { glyph: Glyph; hairline?: boolean }) {
  return (
    <path
      d={GLYPHS[glyph]}
      vectorEffect={hairline ? HAIRLINE : undefined}
      {...props(styles.glyph)}
    />
  );
}

/**
 * The feed `bundleId`'s own icon in place of an app's square, rounded like
 * the square and edged with a border, so a white or a black one still holds
 * its shape on the page.
 */
export function FeedIcon({ bundleId, hairline = false }: { bundleId: string; hairline?: boolean }) {
  const clip = useId();
  return (
    <>
      <clipPath id={clip}>
        <rect height={ICON} rx={ICON_RADIUS} width={ICON} x={-ICON / 2} y={-ICON / 2} />
      </clipPath>
      <image
        clipPath={`url(#${clip})`}
        height={ICON}
        href={`/media/apps/${bundleId}.webp`}
        width={ICON}
        x={-ICON / 2}
        y={-ICON / 2}
      />
      <rect
        height={ICON}
        rx={ICON_RADIUS}
        vectorEffect={hairline ? HAIRLINE : undefined}
        width={ICON}
        x={-ICON / 2}
        y={-ICON / 2}
        {...props(styles.feedEdge)}
      />
    </>
  );
}
