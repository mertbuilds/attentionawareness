import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { cellAt, enterTrail, gridOrigin } from '../lib/grid-cell.ts';
import { duration, easing } from '../lib/motion.stylex.ts';
import { LESS_MOTION } from '../lib/use-less-motion.ts';

/** The side of one square of the grid, in px: the 40 the share card is ruled at. */
export const GRID_CELL = 40;
/** How thick a line of the grid is, in px, at the left and the top of its square. */
export const GRID_LINE = 1;

/** How strong the orange of the square under the pointer is. */
const CELL_OPACITY = 0.2;
/** How fast a square lights as the pointer comes into it. */
const FADE_IN = duration.micro;
/** How slowly a square goes out once the pointer has left it. */
const FADE_OUT = '700ms';
/** The most squares alight or going out at once; past it the oldest is taken. */
const TRAIL_CAP = 24;

/** A pointer that can rest over the page without pressing it: a mouse. */
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

/** The hairline the graph paper is ruled in. Faint enough to read as paper. */
const LINE = `color-mix(in srgb, ${colors.fg} 8%, transparent)`;
/** One square of the grid. */
const SQUARE = `${GRID_CELL}px ${GRID_CELL}px`;
/** Solid under the hero, gone before it reaches an edge or the first section. */
const MASK = 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)';

const styles = create({
  // A lit square: a row of the grid one square tall, with the square drawn in
  // it as a background the size of the grid's own tile and placed by the
  // grid's own `background-position`, so the browser sets both by one sum and
  // they cannot part by a fraction of a pixel. The tile is clear over the
  // square's left line and starts under its top line, so the orange fills the
  // room between the lines.
  cell: {
    backgroundImage: `linear-gradient(90deg, transparent ${GRID_LINE}px, ${accent.base} ${GRID_LINE}px)`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${GRID_CELL}px ${GRID_CELL - GRID_LINE}px`,
    insetInline: 0,
    opacity: 0,
    position: 'absolute',
    transitionDuration: FADE_OUT,
    transitionProperty: 'opacity',
    transitionTimingFunction: easing.out,
  },
  grid: {
    backgroundImage: `linear-gradient(${LINE} ${GRID_LINE}px, transparent ${GRID_LINE}px), linear-gradient(90deg, ${LINE} ${GRID_LINE}px, transparent ${GRID_LINE}px)`,
    backgroundSize: SQUARE,
    // The first screen and no further. `svh` so a phone's collapsing toolbar
    // does not resize the ruling under the reader's thumb.
    height: firstThatWorks('100svh', '100vh'),
    // The page's own edges, not the viewport's: `100vw` would count the
    // scrollbar and push the page sideways.
    insetBlockStart: 0,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    maskImage: MASK,
    pointerEvents: 'none',
    position: 'absolute',
    WebkitMaskImage: MASK,
    // Under everything the page draws, over the page's own background: the
    // page root isolates, so this stays inside it.
    zIndex: -1,
  },
  lit: {
    opacity: CELL_OPACITY,
    transitionDuration: FADE_IN,
  },
});

const CELL_CLASS = props(styles.cell).className ?? '';
const LIT_CLASS = props(styles.cell, styles.lit).className ?? '';

/**
 * Lights the square of `grid` under the mouse and lets the ones it left go
 * out, until what it returns is called. The squares are a few elements inside
 * the grid, made as they are needed and used again past `TRAIL_CAP`, so the
 * grid's own mask fades them where it fades the lines. React never hears of
 * a move: one read and a few writes for each frame the pointer moved in.
 */
function lightSquares(grid: HTMLElement): () => void {
  // Where the grid's own background starts, as the browser computed it: a
  // page may move it (`center top` under the hero), and the squares follow.
  const computed = getComputedStyle(grid);
  const [positionX = '0%'] = computed.backgroundPositionX.split(',');
  const [positionY = '0%'] = computed.backgroundPositionY.split(',');

  const squares = new Map<string, HTMLElement>();
  let trail: Array<string> = [];
  let lit: string | undefined;
  let point: { x: number; y: number } | undefined;
  let frame = 0;

  const draw = () => {
    frame = 0;
    const box = grid.getBoundingClientRect();
    const originX = gridOrigin(positionX, box.width, GRID_CELL);
    const originY = gridOrigin(positionY, box.height, GRID_CELL);
    const cell =
      point === undefined || originX === undefined || originY === undefined
        ? undefined
        : cellAt(point, box, { cell: GRID_CELL, originX, originY });
    const key = cell === undefined ? undefined : `${cell.col}:${cell.row}`;
    if (key === lit) {
      return;
    }
    if (lit !== undefined) {
      squares.get(lit)?.setAttribute('class', CELL_CLASS);
      lit = undefined;
    }
    if (cell === undefined || key === undefined || originY === undefined) {
      return;
    }
    const entered = enterTrail(trail, key, TRAIL_CAP);
    trail = entered.trail;
    let square = squares.get(key);
    if (square === undefined) {
      // The oldest square's element when the trail is full, else a new one.
      const taken = entered.dropped === undefined ? undefined : squares.get(entered.dropped);
      if (entered.dropped !== undefined) {
        squares.delete(entered.dropped);
      }
      square = taken ?? document.createElement('div');
      square.setAttribute('class', CELL_CLASS);
      const rowTop = originY + cell.row * GRID_CELL;
      square.style.top = `${cell.top}px`;
      square.style.height = `${cell.height}px`;
      square.style.backgroundPosition = `calc(${positionX.trim()} + ${cell.col * GRID_CELL}px) ${rowTop - cell.top + GRID_LINE}px`;
      if (taken === undefined) {
        grid.append(square);
        // A new element has to be drawn dark once, or it lights with no fade.
        void getComputedStyle(square).opacity;
      }
      squares.set(key, square);
    }
    square.setAttribute('class', LIT_CLASS);
    lit = key;
  };
  const queue = () => {
    if (frame === 0) {
      frame = requestAnimationFrame(draw);
    }
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    point = { x: event.clientX, y: event.clientY };
    queue();
  };
  const onLeave = () => {
    point = undefined;
    queue();
  };

  // On the window, since the grid lies under the words, the buttons and the
  // phone and is itself unclickable. The page moving under a still pointer
  // changes the square as well.
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', queue, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave, { passive: true });
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', queue);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    cancelAnimationFrame(frame);
    for (const square of squares.values()) {
      square.remove();
    }
  };
}

/**
 * Runs `lightSquares` on the grid in `ref` while `interactive` is set, the
 * grid is in the window, the reader has a mouse and did not ask for less
 * motion. Otherwise nothing listens and the grid holds no elements.
 */
function useLitSquares(ref: RefObject<HTMLElement | null>, interactive: boolean): void {
  useEffect(() => {
    const grid = ref.current;
    if (!interactive || grid === null) {
      return;
    }
    const hover = window.matchMedia(HOVER_QUERY);
    const lessMotion = window.matchMedia(LESS_MOTION);
    let inWindow = false;
    let stop: (() => void) | undefined;
    const sync = () => {
      const wanted = inWindow && hover.matches && !lessMotion.matches;
      if (wanted && stop === undefined) {
        stop = lightSquares(grid);
      } else if (!wanted && stop !== undefined) {
        stop();
        stop = undefined;
      }
    };
    const watch = new IntersectionObserver((entries) => {
      inWindow = entries.at(-1)?.isIntersecting === true;
      sync();
    });
    watch.observe(grid);
    hover.addEventListener('change', sync);
    lessMotion.addEventListener('change', sync);
    return () => {
      watch.disconnect();
      hover.removeEventListener('change', sync);
      lessMotion.removeEventListener('change', sync);
      stop?.();
    };
  }, [interactive, ref]);
}

/**
 * The share card's graph paper, in the page's own colours, behind the first
 * screen of a page. It is a background and nothing else: out of flow, unclickable
 * and unreadable, so it moves nothing on the page it sits behind. It goes first
 * inside a page root that is `position: relative` and `isolation: isolate`,
 * or inside any other positioned box that `style` sizes it to.
 *
 * With `interactive`, the square under a mouse lights in the accent and goes
 * out behind it. The server draws the same empty element either way.
 */
export function GridTexture({
  interactive = false,
  style,
}: {
  interactive?: boolean;
  style?: StyleXStyles;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLitSquares(ref, interactive);
  return <div aria-hidden="true" ref={ref} {...props(styles.grid, style)} />;
}
