import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { animate, useMotionValue, useMotionValueEvent } from 'motion/react';
import type { MotionValue } from 'motion/react';
import { useEffect, useState } from 'react';
import { drawing, easing } from '../../lib/motion.stylex.ts';
import { useLessMotion } from '../cost-story.tsx';
import { HEIGHT, WIDTH } from './box.ts';

const CENTER = WIDTH / 2;
/** The shelf the tower stands on. */
const SHELF = { left: 40, right: 280, y: 200 };
/**
 * Each book's thickness, length and how far off the middle it lies, taken in
 * turn from runs of different lengths, so no pattern shows in the pile.
 */
const THICKNESS = [7, 5, 9, 6, 10, 5, 8];
const LENGTH = [152, 124, 170, 136, 112, 160, 144, 128, 176, 118, 148];
const SHIFT = [-6, 4, -2, 9, -10, 2, 7, -4, 0, 11, -8, 3, -1];
/** The books bound in orange, by their place up the tower. */
const ORANGE = new Set([3, 10, 15, 21]);
/** The air between one book and the next, so every outline reads on its own. */
const GAP = 1.5;
const CORNER = 1.5;
/** How far a book falls onto the pile, and how long it takes. */
const DROP = 14;
const DROP_MS = 600;
/** Where a band or a title sits on a spine. */
const BAND_INSET = 5;
const TITLE_SPAN = 0.15;
/** The whole pile, slow at both ends and a blur in the middle. */
const SECONDS = drawing.deck;
/** The top of the drawing fades out, and the tower goes on past it. */
const FADE = 'linear-gradient(to bottom, transparent, black 40%)';

/** One book lying in the pile, spine out, and what is drawn on its spine. */
type Book = {
  detail: 'band' | 'none' | 'title';
  height: number;
  orange: boolean;
  width: number;
  x: number;
  y: number;
};

const DETAILS: ReadonlyArray<Book['detail']> = ['none', 'band', 'title'];

/**
 * The pile, from the shelf up, until a book crosses the top edge: the fade
 * there hides where it stops, so it is never seen to end.
 */
const BOOKS: ReadonlyArray<Book> = (() => {
  const books: Array<Book> = [];
  let floor = SHELF.y - GAP;
  while (floor > 0) {
    const index = books.length;
    const height = THICKNESS[index % THICKNESS.length] ?? 0;
    const width = LENGTH[index % LENGTH.length] ?? 0;
    const shift = SHIFT[index % SHIFT.length] ?? 0;
    const y = floor - height;
    books.push({
      detail: DETAILS[index % DETAILS.length] ?? 'none',
      height,
      orange: ORANGE.has(index),
      width,
      x: CENTER - width / 2 + shift,
      y,
    });
    floor = y - GAP;
  }
  return books;
})();

const styles = create({
  // A book still to come: up over the pile and out of sight. It goes there at
  // once, so the pile starts over clean.
  book: {
    fill: 'none',
    opacity: 0,
    stroke: colors.muted,
    strokeWidth: 1,
    transform: `translateY(-${DROP}px)`,
  },
  // A book on the pile: it has dropped into place, slowing as it lands.
  bookLanded: {
    opacity: 1,
    transform: 'none',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: `${DROP_MS}ms`,
    },
    transitionProperty: 'opacity, transform',
    transitionTimingFunction: easing.smoothOut,
  },
  bookOrange: {
    stroke: accent.base,
  },
  // The bands and titles on the spines, a step fainter than the books.
  detail: {
    opacity: 0.5,
    strokeLinecap: 'round',
  },
  graphic: {
    display: 'block',
    height: 'auto',
    marginInline: 'auto',
    maskImage: FADE,
    maxWidth: 400,
    WebkitMaskImage: FADE,
    width: '100%',
  },
  shelf: {
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeWidth: 1,
  },
});

/** What is drawn on a book's spine: a band at each end, a title, or nothing. */
function Detail({ book }: { book: Book }) {
  const { detail, height, width, x, y } = book;
  if (detail === 'band') {
    return (
      <path
        d={[x + BAND_INSET, x + width - BAND_INSET]
          .map((at) => `M${at} ${y + CORNER} V${y + height - CORNER}`)
          .join(' ')}
        {...props(styles.detail)}
      />
    );
  }
  if (detail === 'title') {
    const middle = x + width / 2;
    return (
      <path
        d={`M${middle - width * TITLE_SPAN} ${y + height / 2} H${middle + width * TITLE_SPAN}`}
        {...props(styles.detail)}
      />
    );
  }
  return null;
}

/**
 * Book spines piling up on a shelf, a few bound in orange, one at a time at
 * first, then faster than they can be told apart, until the tower runs out
 * past the top edge and fades there. It plays once each time `play` comes on
 * and starts over when it goes off, or stands as far as `play` says when it is
 * played from outside; with less motion it stands piled high.
 */
export function BooksGraphic({ play }: { play: boolean | MotionValue<number> }) {
  const reduced = useLessMotion();
  // Done until the page says otherwise, so a page that has not run its script
  // shows the whole pile.
  const own = useMotionValue(1);
  const progress = typeof play === 'boolean' ? own : play;
  const [landed, setLanded] = useState(BOOKS.length);
  useMotionValueEvent(progress, 'change', (t) => setLanded(Math.ceil(t * BOOKS.length)));

  useEffect(() => {
    if (typeof play !== 'boolean') {
      return;
    }
    if (reduced) {
      own.set(1);
      return;
    }
    own.set(0);
    if (!play) {
      return;
    }
    const controls = animate(own, 1, { duration: SECONDS, ease: 'easeInOut' });
    return () => controls.stop();
  }, [own, play, reduced]);

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.graphic)}>
      {BOOKS.map((book, index) => (
        <g
          key={index}
          {...props(
            styles.book,
            book.orange && styles.bookOrange,
            index < landed && styles.bookLanded,
          )}
        >
          <rect height={book.height} rx={CORNER} width={book.width} x={book.x} y={book.y} />
          <Detail book={book} />
        </g>
      ))}
      <line x1={SHELF.left} x2={SHELF.right} y1={SHELF.y} y2={SHELF.y} {...props(styles.shelf)} />
    </svg>
  );
}
