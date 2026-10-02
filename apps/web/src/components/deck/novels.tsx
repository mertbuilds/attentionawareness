import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useMotionValueEvent } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useState } from 'react';
import { HEIGHT, WIDTH } from './box.ts';

/**
 * How long each page takes, before the run is scaled to its length: every
 * page quicker than the one before, and the last few slowing again, so the
 * run lands rather than stops.
 */
const SPEED_UP = 0.68;
const SLOW_DOWN = 0.45;
const SETTLE = 0.6;
/** The page being written, on the right, square-cornered like paper, in the middle of the box. */
const PAGE = { height: 164, width: 122, x: 147, y: 26 };
const PAGE_MIDDLE = PAGE.y + PAGE.height / 2;
/** The text: a margin all round and a line every so often, in two paragraphs. */
const MARGIN = 16;
const FIRST_LINE = PAGE.y + 24;
const LINE_PITCH = 14.5;
const LINE_COUNT = 9;
/** A paragraph's first line is indented and its last one stops short. */
const INDENT = 11;
const SHORT = 0.55;
const PARAGRAPH_ENDS = new Set([4, 8]);
/** A word is a rounded bar this thick, with this much paper to the next. */
const WORD = 3.4;
const WORD_GAP = 6.5;
/**
 * The lengths the words take in turn. A word that does not fit goes to the
 * next line, the way text wraps, so every line ends ragged.
 */
const WORD_LENGTHS = [12, 7, 16, 9, 5, 13, 8, 17, 11, 7, 15, 9, 8, 12, 5, 16];
/** The share of a page's time spent writing it. The rest turns it over. */
const WRITING = 0.78;
/** How far the turning page's free edge grows toward the reader, top and bottom, at its steepest. */
const LIFT = 13;
/** The caret: how far it reaches either side of its line, and how far it stands off the last word. */
const CARET_REACH = 6;
const CARET_GAP = 2.5;
/**
 * The pile of finished manuscripts, left of the page, a slab each. Past this
 * many pages, a slab stands for more than one novel.
 */
const PILE_MAX = 24;
const PILE_X = 51;
const PILE_WIDTH = 67;
const PILE_PITCH = 5.3;
const PILE_BASE = PAGE.y + PAGE.height;
const SLAB = 2.4;
/** Stacked by hand, a slab sits up to two of these off the one under it, either way. */
const SLAB_SHIFT = 1.1;
/** A slab drops onto the pile from this high, over this share of a page, landing as the page is done. */
const DROP_HEIGHT = 11;
const DROP = 0.2;

type Word = { from: number; to: number };
/** A line of the page: where it starts and ends, and how much writing comes before it. */
type Line = { before: number; end: number; start: number; words: ReadonlyArray<Word>; y: number };

/** The page's text, laid out once. */
const LINES: ReadonlyArray<Line> = (() => {
  const left = PAGE.x + MARGIN;
  const right = PAGE.x + PAGE.width - MARGIN;
  let word = 0;
  let before = 0;
  return Array.from({ length: LINE_COUNT }, (_, index) => {
    const start = index === 0 || PARAGRAPH_ENDS.has(index - 1) ? left + INDENT : left;
    const limit = PARAGRAPH_ENDS.has(index) ? left + (right - left) * SHORT : right;
    const words: Array<Word> = [];
    let at = start;
    let length = WORD_LENGTHS[word % WORD_LENGTHS.length] ?? 0;
    while (at + length <= limit) {
      words.push({ from: at, to: at + length });
      at += length + WORD_GAP;
      word += 1;
      length = WORD_LENGTHS[word % WORD_LENGTHS.length] ?? 0;
    }
    const end = words.at(-1)?.to ?? start;
    const line = { before, end, start, words, y: FIRST_LINE + index * LINE_PITCH };
    before += end - start;
    return line;
  });
})();
/** How far the writing runs on a whole page, one line after the other. */
const TEXT_LENGTH = LINES.reduce((sum, line) => sum + line.end - line.start, 0);

/** The caret, gently pulsing at the end of the last page while it waits for the next. */
const pulse = keyframes({
  from: { opacity: 1 },
  to: { opacity: 0.2 },
});

const styles = create({
  caret: {
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.4,
  },
  caretIdle: {
    animationDirection: 'alternate',
    animationDuration: '900ms',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: pulse,
    },
    animationTimingFunction: 'ease-in-out',
  },
  drawing: {
    display: 'block',
    height: 'auto',
    maxWidth: 400,
    overflow: 'visible',
    width: '100%',
  },
  page: {
    fill: colors.bg,
    stroke: colors.muted,
    strokeWidth: 1,
  },
  // A finished manuscript, edge on: the novels the hours would have written.
  slab: {
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: SLAB,
  },
  text: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeOpacity: 0.6,
    strokeWidth: WORD,
  },
});

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function fixed(value: number): string {
  return value.toFixed(2);
}

/** How long each page takes, relative to the others. */
function pageWeights(pages: number): Array<number> {
  return Array.from(
    { length: pages },
    (_, page) => SPEED_UP ** page + SETTLE * SLOW_DOWN ** (pages - 1 - page),
  );
}

/** How many pages in the run is `run` of the way through it, counting the part of the one under way. */
function pagesAt(run: number, weights: ReadonlyArray<number>): number {
  let left = run * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [page, weight] of weights.entries()) {
    if (left < weight) {
      return page + left / weight;
    }
    left -= weight;
  }
  return weights.length;
}

/** When a page is done, in pages: the last is all writing, and every other one turns after it. */
function doneAt(page: number, pages: number): number {
  return page + (page === pages - 1 ? 1 : WRITING);
}

/**
 * A point of the page turned `angle` about its left edge: it closes in on
 * that edge while the far side grows toward the reader.
 */
function turn(x: number, y: number, angle: number): string {
  const along = x - PAGE.x;
  const lift = ((y - PAGE_MIDDLE) / (PAGE.height / 2)) * (along / PAGE.width) * LIFT;
  return `${fixed(PAGE.x + along * Math.cos(angle))} ${fixed(y + lift * Math.sin(angle))}`;
}

/** The page's edge, turned `angle` about its left side. */
function leafPath(angle: number): string {
  const right = PAGE.x + PAGE.width;
  const bottom = PAGE.y + PAGE.height;
  return `M${turn(PAGE.x, PAGE.y, angle)} L${turn(right, PAGE.y, angle)} L${turn(right, bottom, angle)} L${turn(PAGE.x, bottom, angle)} Z`;
}

/** The words written once `written` of the page is, as one path, on a page turned `angle`. */
function textPath(written: number, angle: number): string {
  const ahead = written * TEXT_LENGTH;
  return LINES.flatMap((line) =>
    line.words.flatMap((word) => {
      const reach = Math.min(word.to, line.start + ahead - line.before);
      if (reach <= word.from) {
        return [];
      }
      const from = word.from + WORD / 2;
      const to = Math.max(from, reach - WORD / 2);
      return [`M${turn(from, line.y, angle)} L${turn(to, line.y, angle)}`];
    }),
  ).join(' ');
}

/** Where the writing has got to once `written` of the page is: just after the last word on its line. */
function headAt(written: number): { x: number; y: number } {
  const ahead = written * TEXT_LENGTH;
  const line = LINES.findLast((candidate) => candidate.before <= ahead);
  if (line === undefined) {
    return { x: PAGE.x + MARGIN, y: FIRST_LINE };
  }
  return { x: Math.min(line.end, line.start + ahead - line.before), y: line.y };
}

/** The run's progress, from 0 to 1, as `play` says. */
function useRun(play: MotionValue<number>): number {
  const [run, setRun] = useState(() => play.get());
  useMotionValueEvent(play, 'change', setRun);
  return run;
}

/**
 * A manuscript writing itself: lines of words typed in left to right, the page
 * turned over when it is full and the next one started, faster and faster.
 * Every finished page drops onto the pile beside it, in orange. It is written
 * as far as `play` says, from 0 to 1.
 */
export function NovelsGraphic({ amount, play }: { amount: number; play: MotionValue<number> }) {
  const run = useRun(play);
  const pages = Math.max(0, Math.min(PILE_MAX, amount));
  const at = pagesAt(run, pageWeights(pages));
  const page = Math.max(0, Math.min(Math.floor(at), pages - 1));
  const last = page === pages - 1;
  const into = at - page;
  const written = pages === 0 ? 0 : Math.min(1, into / (last ? 1 : WRITING));
  // The turn starts slowly and falls the rest of the way, the way a page does.
  const turned = last ? 0 : clamp((into - WRITING) / (1 - WRITING));
  const angle = (Math.PI / 2) * turned ** 2;
  const head = headAt(written);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.drawing)}>
      {Array.from({ length: pages }, (_, slab) => {
        const landed = clamp((at - doneAt(slab, pages)) / DROP + 1);
        if (landed === 0) {
          return null;
        }
        const y = PILE_BASE - SLAB / 2 - slab * PILE_PITCH - DROP_HEIGHT * (1 - landed) ** 2;
        // Stacked by hand, so no slab sits quite square on the one under it.
        const shift = (((slab * 7) % 5) - 2) * SLAB_SHIFT;
        return (
          <line
            key={slab}
            opacity={landed}
            x1={PILE_X + shift}
            x2={PILE_X + PILE_WIDTH + shift}
            y1={y}
            y2={y}
            {...props(styles.slab)}
          />
        );
      })}
      <rect height={PAGE.height} width={PAGE.width} x={PAGE.x} y={PAGE.y} {...props(styles.page)} />
      {turned > 0 ? (
        // The written page turning over, with the next one blank under it.
        <g opacity={Math.min(1, Math.cos(angle) * 4)}>
          <path d={leafPath(angle)} {...props(styles.page)} />
          <path d={textPath(1, angle)} opacity={Math.cos(angle)} {...props(styles.text)} />
        </g>
      ) : (
        <>
          <path d={textPath(written, 0)} {...props(styles.text)} />
          <line
            x1={head.x + CARET_GAP}
            x2={head.x + CARET_GAP}
            y1={head.y - CARET_REACH}
            y2={head.y + CARET_REACH}
            {...props(styles.caret, run === 1 && styles.caretIdle)}
          />
        </>
      )}
    </svg>
  );
}
