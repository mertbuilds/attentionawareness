import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { cellAt, cellsBetween, enterTrail, glowStrength, gridOrigin } from '../lib/grid-cell.ts';
import type { Glow } from '../lib/grid-cell.ts';
import { LESS_MOTION } from '../lib/use-less-motion.ts';

/** The side of one square of the grid, in px: the 40 the share card is ruled at. */
export const GRID_CELL = 40;
/** How thick a line of the grid is, in px, at the left and the top of its square. */
export const GRID_LINE = 1;

/** How strong the orange of a square is at its fullest. */
const CELL_OPACITY = 0.32;
/** How fast a square lights as the pointer comes into it, in ms: the motion scale's `micro`. */
const FADE_IN = 80;
/**
 * How long a square takes to go out once the pointer has left it, in ms. It
 * keeps most of its colour for the first two thirds and lets go at the end, so
 * a stroke stays readable for a while, as a drawn line does.
 */
const FADE_OUT = 3000;
/**
 * The most squares alight or going out at once; past it the oldest is taken.
 * A stroke lights a square for every 40px it goes, so this is three seconds,
 * the whole of a fade, at 8000px a second: no stroke a hand can make is cut
 * before it has gone out by itself.
 */
const TRAIL_CAP = 600;
/**
 * The longest the pointer may have stood still, in ms, for its next square to
 * be joined to its last by a line. After a longer wait, or after it was off
 * the grid, out of the window or in a tab put away, a new stroke starts where
 * it is, and nothing is drawn across the hero.
 */
const STROKE_GAP = 100;

/** A pointer that can rest over the page without pressing it: a mouse. */
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

/** The hairline the graph paper is ruled in. Faint enough to read as paper. */
const LINE = `color-mix(in srgb, ${colors.fg} 8%, transparent)`;
/** One square of the grid. */
const SQUARE = `${GRID_CELL}px ${GRID_CELL}px`;
/** Solid under the hero, gone before it reaches an edge or the first section. */
const MASK = 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)';

const styles = create({
  // The lit squares, all painted on one sheet the size of the grid. It lies
  // inside the grid, so the grid's mask fades it where it fades the lines.
  // Its colour is the paint and its opacity the strength of a full square.
  canvas: {
    color: accent.base,
    height: '100%',
    inset: 0,
    opacity: CELL_OPACITY,
    position: 'absolute',
    width: '100%',
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
});

const CANVAS_CLASS = props(styles.canvas).className ?? '';

/**
 * Lights the square of `grid` under the mouse and lets the ones it left go
 * out, until what it returns is called. The squares are painted on one canvas
 * inside the grid, from the grid's own square, line and `background-position`,
 * so hundreds of them cost one sheet and one pass a frame. React never hears
 * of a move, and no frame is asked for once the last square has gone out.
 */
function lightSquares(grid: HTMLElement): () => void {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('class', CANVAS_CLASS);
  const context = canvas.getContext('2d');
  if (context === null) {
    return () => {};
  }
  grid.append(canvas);
  // Where the grid's own background starts, as the browser computed it: a
  // page may move it (`center top` under the hero), and the squares follow.
  const computed = getComputedStyle(grid);
  const [positionX = '0%'] = computed.backgroundPositionX.split(',');
  const [positionY = '0%'] = computed.backgroundPositionY.split(',');
  const paint = getComputedStyle(canvas).color;

  const glows = new Map<string, Glow & { col: number; row: number }>();
  let trail: Array<string> = [];
  let lit: string | undefined;
  let point: { x: number; y: number } | undefined;
  // When the pointer last moved, when the last frame was drawn, and the move
  // that frame had seen: all on the clock the frames keep.
  let movedAt = 0;
  let drawnAt = 0;
  let drawnMoveAt = 0;
  let frame = 0;

  // The pointer comes into a square at `at`, and leaves the one it was in.
  const enter = (col: number, row: number, at: number) => {
    leave(at);
    const key = `${col}:${row}`;
    const entered = enterTrail(trail, key, TRAIL_CAP);
    trail = entered.trail;
    if (entered.dropped !== undefined) {
      glows.delete(entered.dropped);
    }
    // A square still going out lights again from the strength it has.
    const back = glows.get(key);
    glows.set(key, {
      at,
      col,
      from: back === undefined ? 0 : glowStrength(back, at, FADE_IN, FADE_OUT),
      left: undefined,
      row,
    });
    lit = key;
  };
  const leave = (at: number) => {
    const left = lit === undefined ? undefined : glows.get(lit);
    if (left !== undefined) {
      left.left = at;
    }
    lit = undefined;
  };

  const queue = () => {
    if (frame === 0) {
      frame = requestAnimationFrame((now) => draw(now));
    }
  };
  const draw = (now: number) => {
    frame = 0;
    const box = grid.getBoundingClientRect();
    const originX = gridOrigin(positionX, box.width, GRID_CELL);
    const originY = gridOrigin(positionY, box.height, GRID_CELL);
    if (originX === undefined || originY === undefined || box.width === 0 || box.height === 0) {
      return;
    }
    const cell =
      point === undefined ? undefined : cellAt(point, box, { cell: GRID_CELL, originX, originY });
    const key = cell === undefined ? undefined : `${cell.col}:${cell.row}`;
    if (key !== lit) {
      const last = lit === undefined ? undefined : glows.get(lit);
      if (cell === undefined) {
        leave(now);
      } else if (last === undefined || movedAt - drawnMoveAt > STROKE_GAP) {
        enter(cell.col, cell.row, now);
      } else {
        // The squares the pointer crossed since the last frame, each come
        // into a little after the one before it over the time between the
        // two frames, so the stroke goes out from its start to its end.
        const path = cellsBetween(last, cell);
        const start = Math.max(drawnAt, now - STROKE_GAP);
        for (const [index, step] of path.entries()) {
          enter(step.col, step.row, start + ((now - start) * (index + 1)) / path.length);
        }
      }
    }
    drawnAt = now;
    drawnMoveAt = movedAt;

    // One canvas pixel for one screen pixel, at any zoom.
    const width = Math.round(box.width * window.devicePixelRatio);
    const height = Math.round(box.height * window.devicePixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const scaleX = width / box.width;
    const scaleY = height / box.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = paint;
    const side = GRID_CELL - GRID_LINE;
    for (const [glowKey, glow] of glows) {
      const strength = glowStrength(glow, now, FADE_IN, FADE_OUT);
      if (glow.left !== undefined && now - glow.left >= FADE_OUT) {
        glows.delete(glowKey);
        continue;
      }
      // The room between the lines: a square's lines are its left and its top.
      context.globalAlpha = strength;
      context.fillRect(
        (originX + glow.col * GRID_CELL + GRID_LINE) * scaleX,
        (originY + glow.row * GRID_CELL + GRID_LINE) * scaleY,
        side * scaleX,
        side * scaleY,
      );
    }
    // A square that is lighting or going out needs the next frame; a square
    // at rest under a still pointer does not.
    const resting = lit === undefined ? undefined : glows.get(lit);
    const moving =
      glows.size > 1 ||
      (resting !== undefined && glowStrength(resting, now, FADE_IN, FADE_OUT) < 1) ||
      (resting === undefined && glows.size > 0);
    if (moving) {
      queue();
    }
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') {
      return;
    }
    point = { x: event.clientX, y: event.clientY };
    movedAt = event.timeStamp;
    queue();
  };
  const onLeave = () => {
    point = undefined;
    queue();
  };

  // On the window, since the grid lies under the words, the buttons and the
  // phone and is itself unclickable. The page moving under a still pointer
  // changes the square as well, and a window of a new size moves the grid.
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave, { passive: true });
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', queue);
    window.removeEventListener('resize', queue);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    cancelAnimationFrame(frame);
    canvas.remove();
  };
}

/**
 * Runs `lightSquares` on the grid in `ref` while `interactive` is set, the
 * grid is in the window, the reader has a mouse and did not ask for less
 * motion. Otherwise nothing listens and the grid holds no canvas.
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
