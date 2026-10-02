import { colors, font } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useInView } from 'motion/react';
import { useRef } from 'react';
import { drawing } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';
import { SIGNATURES } from './signature-strokes.ts';
import type { Stroke } from './signature-strokes.ts';
import { stretch, usePlayhead } from './steps/playhead.ts';

/** The name is written as large as type this many pixels tall. */
const SIZE = 48;
/** How much of the signature has to be on screen before the pen starts. */
const SEEN = 0.8;
/**
 * The pen lifting between two strokes, as long as it takes to write this
 * many units of line.
 */
const LIFT = 600;
/** Constant pen speed: a stroke is drawn evenly from its start to its end. */
const even = (share: number) => share;

const styles = create({
  // The name in the page's ink, the place and date under it in the muted
  // one, both from the same pen.
  name: {
    stroke: colors.fg,
    strokeWidth: 30,
  },
  place: {
    stroke: colors.muted,
    strokeWidth: 24,
  },
  // Without strokes for its words, the signature is set as a quiet line.
  plain: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  // A signature stands at the end of the line, under the letter it closes.
  sign: {
    alignSelf: 'flex-end',
    margin: 0,
    maxWidth: '100%',
  },
  // Read by a screen reader and found by a search, never seen.
  spoken: {
    borderWidth: 0,
    clip: 'rect(0, 0, 0, 0)',
    height: '1px',
    margin: '-1px',
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: '1px',
  },
  written: {
    display: 'block',
    fill: 'none',
    height: 'auto',
    maxWidth: '100%',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
});

/**
 * Each stroke's stretch of the writing, as shares of it from 0 to 1: one
 * after another at one pen speed, with a lift of the pen between two.
 */
function timeline(strokes: ReadonlyArray<Stroke>) {
  const total =
    strokes.reduce((sum, stroke) => sum + stroke.length, 0) + LIFT * (strokes.length - 1);
  let at = 0;
  return strokes.map((stroke) => {
    const from = at / total;
    at += stroke.length;
    const to = at / total;
    at += LIFT;
    return { ...stroke, from, to };
  });
}

/**
 * Who wrote the story, from where and when, in handwriting that writes
 * itself the first time it comes on screen. A reader who asked for less
 * motion, and a page that has not run its script, get it already written.
 */
export function Signature() {
  const text = m.home_story_sign();
  const signature = SIGNATURES[text];
  const sign = useRef<HTMLParagraphElement>(null);
  const seen = useInView(sign, { amount: SEEN, once: true });
  const at = usePlayhead(seen, drawing.signature);

  if (signature === undefined) {
    return <p {...props(styles.plain)}>{text}</p>;
  }

  const strokes = timeline([...signature.name, ...signature.place]);
  return (
    <p ref={sign} {...props(styles.sign)}>
      <span {...props(styles.spoken)}>{text}</span>
      <svg
        aria-hidden="true"
        height={(signature.height * SIZE) / 1000}
        viewBox={`0 0 ${signature.width} ${signature.height}`}
        width={(signature.width * SIZE) / 1000}
        {...props(styles.written)}
      >
        {strokes.map((stroke, index) => {
          const drawn = stretch(at, stroke.from, stroke.to, even);
          return drawn > 0 ? (
            <path
              d={stroke.d}
              key={stroke.d}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - drawn}
              {...props(index < signature.name.length ? styles.name : styles.place)}
            />
          ) : null;
        })}
      </svg>
    </p>
  );
}
