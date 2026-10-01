import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { WIDTH } from './box.ts';

/** The iPhone the home-screen steps draw, upright in the middle of the box. */
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

const GRID_LEFT = PHONE.x + (PHONE.width - (COLUMNS - 1) * PITCH.x - ICON) / 2;
const SCREEN = {
  height: PHONE.height - 2 * BEZEL,
  radius: PHONE.radius - BEZEL,
  width: PHONE.width - 2 * BEZEL,
  x: PHONE.x + BEZEL,
  y: PHONE.y + BEZEL,
};

/** One app on the home screen: the middle of its square, and its row from the top. */
export type App = { row: number; x: number; y: number };

/** Every app, a row at a time from the top, and the dock's last, as a row of their own. */
export const APPS: ReadonlyArray<App> = [
  ...Array.from({ length: ROWS * COLUMNS }, (_, index) => {
    const row = Math.floor(index / COLUMNS);
    return {
      row,
      x: GRID_LEFT + (index % COLUMNS) * PITCH.x + ICON / 2,
      y: GRID_TOP + row * PITCH.y + ICON / 2,
    };
  }),
  ...Array.from({ length: COLUMNS }, (_, column) => ({
    row: ROWS,
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
  // The glass and the island on it, a step fainter than the body.
  screen: {
    fill: 'none',
    opacity: 0.5,
    stroke: colors.muted,
    strokeWidth: 1,
  },
});

/** The phone's body, its screen and island, and the dock's tray, with no apps on it. */
export function PhoneFrame() {
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
