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

/**
 * Each app's line, around the origin. They are Lucide's icons
 * (https://lucide.dev, ISC License, Copyright (c) Lucide Icons and
 * Contributors; `clock` and `music` come to it from Feather, MIT License,
 * Copyright (c) Cole Bemis): each icon's 24 grid with its middle on the
 * origin, at 0.36 of its size, so the widest of them leaves the square room
 * on every side. The bank is `landmark`, the contacts `user-round`, the maps
 * `map`, the messages `message-circle` and the photos `image`; the rest go
 * by their own names, but for the notes, which are Tabler's `notes`
 * (https://tabler.io/icons, MIT License, Copyright (c) Paweł Kuna) at 0.4 of
 * its size, as tall as Lucide's tallest.
 */
const GLYPHS: Record<Glyph, string> = {
  bank: 'M-0.72 2.16 V-0.36 M-0.32 -3.53 A0.72 0.72 0 0 1 0.32 -3.53 L3.14 -2.14 A0.18 0.18 0 0 1 3.06 -1.8 H-3.06 A0.18 0.18 0 0 1 -3.14 -2.14 Z M0.72 2.16 V-0.36 M2.16 2.16 V-0.36 M-3.24 3.6 H3.24 M-2.16 2.16 V-0.36',
  camera:
    'M0.72 -2.88 A0.72 0.72 0 0 1 1.35 -2.5 L1.53 -2.18 A0.72 0.72 0 0 0 2.16 -1.8 H2.88 A0.72 0.72 0 0 1 3.6 -1.08 V2.16 A0.72 0.72 0 0 1 2.88 2.88 H-2.88 A0.72 0.72 0 0 1 -3.6 2.16 V-1.08 A0.72 0.72 0 0 1 -2.88 -1.8 H-2.16 A0.72 0.72 0 0 0 -1.53 -2.18 L-1.35 -2.5 A0.72 0.72 0 0 1 -0.72 -2.88 Z M1.08 0.36 A1.08 1.08 0 1 1 -1.08 0.36 A1.08 1.08 0 1 1 1.08 0.36 Z',
  clock: 'M3.6 0 A3.6 3.6 0 1 1 -3.6 0 A3.6 3.6 0 1 1 3.6 0 Z M0 -2.16 V0 L1.44 0.72',
  contacts:
    'M1.8 -1.44 A1.8 1.8 0 1 1 -1.8 -1.44 A1.8 1.8 0 1 1 1.8 -1.44 Z M2.88 3.24 A2.88 2.88 0 0 0 -2.88 3.24',
  mail: 'M3.6 -1.8 L0.36 0.26 A0.72 0.72 0 0 1 -0.36 0.26 L-3.6 -1.8 M-2.88 -2.88 H2.88 A0.72 0.72 0 0 1 3.6 -2.16 V2.16 A0.72 0.72 0 0 1 2.88 2.88 H-2.88 A0.72 0.72 0 0 1 -3.6 2.16 V-2.16 A0.72 0.72 0 0 1 -2.88 -2.88 Z',
  maps: 'M0.76 -2.32 A0.72 0.72 0 0 0 1.4 -2.32 L2.72 -2.98 A0.36 0.36 0 0 1 3.24 -2.66 V1.94 A0.36 0.36 0 0 1 3.04 2.26 L1.4 3.08 A0.72 0.72 0 0 1 0.76 3.08 L-0.76 2.32 A0.72 0.72 0 0 0 -1.4 2.32 L-2.72 2.98 A0.36 0.36 0 0 1 -3.24 2.66 V-1.94 A0.36 0.36 0 0 1 -3.04 -2.26 L-1.4 -3.08 A0.72 0.72 0 0 1 -0.76 -3.08 Z M1.08 -2.24 V3.16 M-1.08 -3.16 V2.24',
  messages:
    'M-3.24 1.56 A0.72 0.72 0 0 1 -3.21 1.98 L-3.59 3.17 A0.36 0.36 0 0 0 -3.15 3.59 L-1.92 3.23 A0.72 0.72 0 0 1 -1.52 3.26 A3.6 3.6 0 1 0 -3.24 1.56',
  music:
    'M-1.08 2.16 V-2.52 L3.24 -3.24 V1.44 M-1.08 2.16 A1.08 1.08 0 1 1 -3.24 2.16 A1.08 1.08 0 1 1 -1.08 2.16 Z M3.24 1.44 A1.08 1.08 0 1 1 1.08 1.44 A1.08 1.08 0 1 1 3.24 1.44 Z',
  notes:
    'M-2.8 -2.8 A0.8 0.8 0 0 1 -2 -3.6 H2 A0.8 0.8 0 0 1 2.8 -2.8 V2.8 A0.8 0.8 0 0 1 2 3.6 H-2 A0.8 0.8 0 0 1 -2.8 2.8 Z M-1.2 -2 H1.2 M-1.2 -0.4 H1.2 M-1.2 1.2 H0.4',
  phone:
    'M0.66 1.64 A0.36 0.36 0 0 0 1.1 1.54 L1.22 1.37 A0.72 0.72 0 0 1 1.8 1.08 H2.88 A0.72 0.72 0 0 1 3.6 1.8 V2.88 A0.72 0.72 0 0 1 2.88 3.6 A6.48 6.48 0 0 1 -3.6 -2.88 A0.72 0.72 0 0 1 -2.88 -3.6 H-1.8 A0.72 0.72 0 0 1 -1.08 -2.88 V-1.8 A0.72 0.72 0 0 1 -1.37 -1.22 L-1.54 -1.1 A0.36 0.36 0 0 0 -1.64 -0.65 A5.04 5.04 0 0 0 0.66 1.64',
  photos:
    'M-2.52 -3.24 H2.52 A0.72 0.72 0 0 1 3.24 -2.52 V2.52 A0.72 0.72 0 0 1 2.52 3.24 H-2.52 A0.72 0.72 0 0 1 -3.24 2.52 V-2.52 A0.72 0.72 0 0 1 -2.52 -3.24 Z M-0.36 -1.08 A0.72 0.72 0 1 1 -1.8 -1.08 A0.72 0.72 0 1 1 -0.36 -1.08 Z M3.24 1.08 L2.13 -0.03 A0.72 0.72 0 0 0 1.11 -0.03 L-2.16 3.24',
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

/**
 * The phone's body, its screen and island, and the dock's tray, with no apps
 * on it. The tray is drawn as far as `dock`, for a screen that is not the
 * home screen.
 */
export function PhoneFrame({ dock = 1 }: { dock?: number }) {
  const dockLeft = GRID_LEFT - DOCK.inset;
  return (
    <>
      <rect
        height={PHONE.height}
        rx={PHONE.radius}
        width={PHONE.width}
        x={PHONE.x}
        y={PHONE.y}
        {...props(styles.body)}
      />
      <rect
        height={SCREEN.height}
        rx={SCREEN.radius}
        width={SCREEN.width}
        x={SCREEN.x}
        y={SCREEN.y}
        {...props(styles.screen)}
      />
      <rect
        height={ISLAND.height}
        rx={ISLAND.height / 2}
        width={ISLAND.width}
        x={(WIDTH - ISLAND.width) / 2}
        y={SCREEN.y + ISLAND.top}
        {...props(styles.screen)}
      />
      <rect
        height={DOCK.height}
        opacity={dock}
        rx={DOCK.radius}
        width={WIDTH - 2 * dockLeft}
        x={dockLeft}
        y={DOCK.y}
        {...props(styles.dock)}
      />
    </>
  );
}

/** An app's square, around the origin, for a group placed at the app's middle. */
export function AppSquare() {
  return (
    <rect
      height={ICON}
      rx={ICON_RADIUS}
      width={ICON}
      x={-ICON / 2}
      y={-ICON / 2}
      {...props(styles.app)}
    />
  );
}

/** The line drawn on a kept app's square, around the origin like the square. */
export function AppGlyph({ glyph }: { glyph: Glyph }) {
  return <path d={GLYPHS[glyph]} {...props(styles.glyph)} />;
}

/**
 * The feed `bundleId`'s own icon in place of an app's square, rounded like
 * the square and edged with a border, so a white or a black one still holds
 * its shape on the page.
 */
export function FeedIcon({ bundleId }: { bundleId: string }) {
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
        width={ICON}
        x={-ICON / 2}
        y={-ICON / 2}
        {...props(styles.feedEdge)}
      />
    </>
  );
}
