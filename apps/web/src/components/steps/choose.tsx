import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { easeInOut } from 'motion/react';
import type { Ref } from 'react';
import { drawing } from '../../lib/motion.stylex.ts';
import { HEIGHT, WIDTH } from './box.ts';
import { AppGlyph, AppSquare, FEEDS, FeedIcon, type Glyph, ICON } from './phone.tsx';
import { stretch, usePlayhead } from './playhead.ts';

/** The Mac app's window, the bar along its top, and the three buttons at the bar's left. */
const WINDOW = { height: 144, radius: 6, width: 184, x: 28, y: 18 };
const TITLE_BAR = 16;
const BUTTONS = { left: 10, pitch: 8, radius: 2.5 };
/** The list in the window: how far in from its sides, and how far one row stands from the next. */
const INSET = 10;
const PITCH = 20;
/** Each row's name, as the length of a bar, and how far it stands from the app's square. */
const NAMES = [54, 38, 62, 46, 58, 34];
const NAME_GAP = 8;
/** The box at each row's end, and the tick drawn in it. */
const BOX = { radius: 2, size: 9 };
const TICK = 'M-2.4 0.2 L-0.6 2 L2.6 -1.8';
/** A ticked box's orange wash, faint enough that the tick still reads on it. */
const WASH = 0.12;

/** The rows ticked, in the order they are ticked, each the next of the feeds. */
const PICKS = [0, 2, 3, 5];
/** The rows left as they are, by the app the reader keeps that each is. */
const KEPT: ReadonlyMap<number, Glyph> = new Map([
  [1, 'messages'],
  [4, 'maps'],
]);
/** When the pointer sets off for the first, and how long after it for each next one. */
const FIRST = 0.04;
const NEXT = 0.2;
/** How long the pointer takes from one place to the next. */
const MOVE = 0.1;
/** The pointer, its tip at the origin, and where it waits before the first tick and after the last. */
const POINTER = 'M0 0 V11 L2.7 8.5 L4.5 12.5 L6.4 11.7 L4.6 7.8 H8.2 Z';
const REST = { x: 172, y: 118 };
/** The pointer's tip lands this far past a box's middle, so the tick stays in sight. */
const AIM = 2.5;
/** The ring a click sends out, from the box's edge to this far out. */
const CLICK_FROM = BOX.size / 2;
const CLICK_TO = BOX.size;
const CLICK_OPACITY = 0.5;

const LIST_TOP = WINDOW.y + TITLE_BAR + (WINDOW.height - TITLE_BAR - NAMES.length * PITCH) / 2;
const SQUARE_X = WINDOW.x + INSET + ICON / 2;
const NAME_X = WINDOW.x + INSET + ICON + NAME_GAP;
const BOX_X = WINDOW.x + WINDOW.width - INSET - BOX.size / 2;
/** Where the pointer goes, in turn: from its rest to each box ticked, and back. */
const STOPS = [REST, ...PICKS.map((row) => ({ x: BOX_X + AIM, y: rowY(row) + AIM })), REST];

const styles = create({
  box: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  boxTicked: {
    fill: accent.base,
    stroke: accent.base,
    strokeWidth: 1,
  },
  click: {
    fill: 'none',
    stroke: accent.base,
    strokeWidth: 1,
  },
  // The buttons, the bar's edge and the names, a step fainter than the window.
  faint: {
    fill: 'none',
    opacity: 0.5,
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeWidth: 1,
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
    strokeWidth: 1,
  },
  // The pointer, filled with the page so whatever it passes over gives way to it.
  pointer: {
    fill: colors.bg,
    stroke: colors.muted,
    strokeLinejoin: 'round',
    strokeWidth: 1,
  },
  tick: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.4,
  },
});

/** The middle of row `row` from the window's top. */
function rowY(row: number): number {
  return LIST_TOP + PITCH * (row + 0.5);
}

/** Where pick `order` is in its turn, once the pointer is on its box: the click, the box turning orange, and its tick. */
function tickAt(at: number, order: number) {
  const click = FIRST + order * NEXT + MOVE;
  return {
    click: stretch(at, click, click + 0.14),
    on: stretch(at, click, click + 0.06),
    ticked: stretch(at, click + 0.01, click + 0.11),
  };
}

/** Where the pointer's tip is `at` into the play, each move easing in as well as out. */
function pointerAt(at: number): { x: number; y: number } {
  return STOPS.slice(1).reduce((point, to, index) => {
    const from = STOPS[index] ?? REST;
    const start = FIRST + index * NEXT;
    const moved = stretch(at, start, start + MOVE, easeInOut);
    return { x: point.x + (to.x - from.x) * moved, y: point.y + (to.y - from.y) * moved };
  }, REST);
}

/**
 * The Mac app's window and the list of apps in it, a few of them feeds shown
 * by their own icons, and a pointer that goes down the list ticking the feeds
 * in orange one after another, then steps back, while the rest stay as they
 * are. It plays once each time `play` turns on and stands with nothing ticked
 * while it is off. With less motion it stands ticked.
 */
export function ChooseGraphic({
  play,
  ref,
}: {
  play: boolean;
  ref?: Ref<SVGSVGElement> | undefined;
}) {
  const { at, opacity } = usePlayhead(play, drawing.stepChoose);
  const picks = new Map(
    PICKS.map((row, order) => [row, { feed: FEEDS[order], ...tickAt(at, order) }]),
  );
  const pointer = pointerAt(at);

  return (
    <svg
      aria-hidden="true"
      opacity={opacity}
      ref={ref}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      {...props(styles.graphic)}
    >
      <rect
        height={WINDOW.height}
        rx={WINDOW.radius}
        width={WINDOW.width}
        x={WINDOW.x}
        y={WINDOW.y}
        {...props(styles.line)}
      />
      <path
        d={`M${WINDOW.x} ${WINDOW.y + TITLE_BAR} H${WINDOW.x + WINDOW.width}`}
        {...props(styles.faint)}
      />
      {[0, 1, 2].map((button) => (
        <circle
          cx={WINDOW.x + BUTTONS.left + button * BUTTONS.pitch}
          cy={WINDOW.y + TITLE_BAR / 2}
          key={button}
          r={BUTTONS.radius}
          {...props(styles.faint)}
        />
      ))}
      {NAMES.map((name, row) => {
        const pick = picks.get(row);
        const kept = KEPT.get(row);
        const y = rowY(row);
        return (
          <g key={row}>
            <g transform={`translate(${SQUARE_X} ${y})`}>
              {pick?.feed === undefined ? <AppSquare /> : <FeedIcon bundleId={pick.feed} />}
              {kept === undefined ? null : <AppGlyph glyph={kept} />}
            </g>
            <path d={`M${NAME_X} ${y} h${name}`} {...props(styles.faint)} />
            <g transform={`translate(${BOX_X} ${y})`}>
              <rect
                height={BOX.size}
                rx={BOX.radius}
                width={BOX.size}
                x={-BOX.size / 2}
                y={-BOX.size / 2}
                {...props(styles.box)}
              />
              {pick === undefined ? null : (
                <>
                  <rect
                    fillOpacity={WASH}
                    height={BOX.size}
                    opacity={pick.on}
                    rx={BOX.radius}
                    width={BOX.size}
                    x={-BOX.size / 2}
                    y={-BOX.size / 2}
                    {...props(styles.boxTicked)}
                  />
                  {pick.click > 0 && pick.click < 1 ? (
                    <circle
                      opacity={CLICK_OPACITY * (1 - pick.click)}
                      r={CLICK_FROM + (CLICK_TO - CLICK_FROM) * pick.click}
                      {...props(styles.click)}
                    />
                  ) : null}
                  {pick.ticked > 0 ? (
                    <path
                      d={TICK}
                      pathLength={1}
                      strokeDasharray="1 1"
                      strokeDashoffset={1 - pick.ticked}
                      {...props(styles.tick)}
                    />
                  ) : null}
                </>
              )}
            </g>
          </g>
        );
      })}
      <path
        d={POINTER}
        transform={`translate(${pointer.x} ${pointer.y})`}
        {...props(styles.pointer)}
      />
    </svg>
  );
}
