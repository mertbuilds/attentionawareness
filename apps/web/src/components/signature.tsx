import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useId, useRef } from 'react';
import { drawing } from '../lib/motion.stylex.ts';
import { useSeen } from '../lib/use-seen.ts';
import type { WideLine } from '../lib/use-seen.ts';
import { m } from '../paraglide/messages.js';
import { SIGNATURES } from './signature-glyphs.ts';
import type { Pen } from './signature-glyphs.ts';
import { stretch, usePlayhead } from './steps/playhead.ts';

/** The name is written as large as type this many pixels tall. */
const SIZE = 29;
/**
 * On a wide window the pen starts once this much of the sign-off is on
 * screen, as it did before `SEEN`.
 */
const WIDE_SEEN: WideLine = { amount: 0.8 };
/**
 * The pen lifting between two strokes, as long as it takes to write this
 * many units of line.
 */
const LIFT = 120;
/** Constant pen speed: a stroke is drawn evenly from its start to its end. */
const even = (share: number) => share;

const styles = create({
  // Only how opaque the mask is counts, not its colour.
  mask: {
    maskType: 'alpha',
  },
  // The name by hand, in the page's ink.
  name: {
    fill: colors.fg,
  },
  // A round nib that uncovers the letters wherever it has been.
  pen: {
    fill: 'none',
    stroke: colors.fg,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  // The sign-off stands at the end of the line, under the letter it closes.
  // Its lines start under one another, as a typed letter's do.
  sign: {
    alignSelf: 'flex-end',
    margin: 0,
    maxWidth: '100%',
  },
  // A typed line of the sign-off, on a line of its own.
  typed: {
    display: 'block',
  },
  written: {
    display: 'block',
    height: 'auto',
    maxWidth: '100%',
  },
});

/**
 * The strokes with their stretch of the writing, as shares of it from 0 to
 * 1: one after another at one pen speed, with a lift of the pen between two.
 */
function timeline(pens: ReadonlyArray<Pen>) {
  let at = 0;
  const strokes = pens.map((pen, stroke) => {
    at += stroke > 0 ? LIFT : 0;
    const from = at;
    at += pen.length;
    return { ...pen, from, to: at };
  });
  const total = at;
  return strokes.map((stroke) => ({ ...stroke, from: stroke.from / total, to: stroke.to / total }));
}

/**
 * Who wrote the story, from where and when, as a typed letter is signed: the
 * name by hand, which a pen writes the first time it comes on screen, stroke
 * by stroke, and under it the name again and the place and date, typed, in
 * the face and the ink `style` gives the letter's lines. A reader who asked
 * for less motion, and a page that has not run its script, get the name
 * already written. A name the pen has no outlines for is typed only.
 */
export function Signature({ style }: { style?: StyleXStyles }) {
  const text = m.home_story_sign();
  // The name comes before the first comma, the place and date after it.
  const comma = text.indexOf(',');
  const name = (comma === -1 ? text : text.slice(0, comma)).trim();
  const place = comma === -1 ? '' : text.slice(comma + 1).trim();
  const signature = SIGNATURES[name];
  const sign = useRef<HTMLParagraphElement>(null);
  const seen = useSeen(sign, { desktop: WIDE_SEEN, once: true });
  const at = usePlayhead(seen, drawing.signature);
  const id = useId();
  const ink = `${id}-ink`;

  // The letters show through the strokes the pen has drawn so far, and whole
  // once it is done or where it never ran.
  const writing = at < 1;
  return (
    <p ref={sign} {...props(styles.sign, style)}>
      {signature === undefined ? null : (
        <svg
          aria-hidden="true"
          height={(signature.height * SIZE) / 1000}
          viewBox={`0 0 ${signature.width} ${signature.height}`}
          width={(signature.width * SIZE) / 1000}
          {...props(styles.written)}
        >
          {writing ? (
            <mask id={ink} {...props(styles.mask)}>
              {timeline(signature.name.pens).map((stroke) => {
                const drawn = stretch(at, stroke.from, stroke.to, even);
                return drawn > 0 ? (
                  <path
                    d={stroke.d}
                    key={stroke.d}
                    pathLength={1}
                    strokeDasharray="1 1"
                    strokeDashoffset={1 - drawn}
                    strokeWidth={stroke.width}
                    {...props(styles.pen)}
                  />
                ) : null;
              })}
            </mask>
          ) : null}
          <path
            d={signature.name.d}
            mask={writing ? `url(#${ink})` : undefined}
            {...props(styles.name)}
          />
        </svg>
      )}
      <span {...props(styles.typed)}>{name}</span>
      {place === '' ? null : <span {...props(styles.typed)}>{place}</span>}
    </p>
  );
}
