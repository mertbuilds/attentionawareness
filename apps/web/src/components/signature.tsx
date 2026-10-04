import { colors, font } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useId, useRef } from 'react';
import { layout } from '../lib/layout.ts';
import { drawing } from '../lib/motion.stylex.ts';
import { useSeen } from '../lib/use-seen.ts';
import { m } from '../paraglide/messages.js';
import { SIGNATURES } from './signature-glyphs.ts';
import type { Line } from './signature-glyphs.ts';
import { stretch, usePlayhead } from './steps/playhead.ts';

/** The name is written as large as type this many pixels tall. */
const SIZE = 29;
/**
 * The pen lifting between two strokes, as long as it takes to write this
 * many units of line, and moving down from the name to the place line.
 */
const LIFT = 120;
const NEW_LINE = 1200;
/** Constant pen speed: a stroke is drawn evenly from its start to its end. */
const even = (share: number) => share;

const styles = create({
  // Only how opaque the mask is counts, not its colour.
  mask: {
    maskType: 'alpha',
  },
  // A round nib that uncovers the letters wherever it has been.
  pen: {
    fill: 'none',
    stroke: colors.fg,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  // The name in the page's ink, the place and date under it in the muted
  // one, both from the same pen.
  name: {
    fill: colors.fg,
  },
  place: {
    fill: colors.muted,
  },
  // Without outlines for its words, the signature is set as a quiet line.
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
  written: {
    display: 'block',
    height: 'auto',
    maxWidth: '100%',
  },
});

/**
 * Each line's strokes with their stretch of the writing, as shares of it from
 * 0 to 1: one after another at one pen speed, the name's then the place
 * line's, with a lift of the pen between two.
 */
function timeline(lines: ReadonlyArray<Line>) {
  let at = 0;
  const strokes = lines.map(({ pens }, line) =>
    pens.map((pen, stroke) => {
      at += stroke > 0 ? LIFT : line > 0 ? NEW_LINE : 0;
      const from = at;
      at += pen.length;
      return { ...pen, from, to: at };
    }),
  );
  const total = at;
  return strokes.map((line) =>
    line.map((stroke) => ({ ...stroke, from: stroke.from / total, to: stroke.to / total })),
  );
}

/**
 * Who wrote the story, from where and when, in handwriting that a pen writes
 * the first time it comes on screen, stroke by stroke. A reader who asked for
 * less motion, and a page that has not run its script, get it already
 * written.
 */
export function Signature() {
  const text = m.home_story_sign();
  const signature = SIGNATURES[text];
  const sign = useRef<HTMLParagraphElement>(null);
  const seen = useSeen(sign, { once: true });
  const at = usePlayhead(seen, drawing.signature);
  const id = useId();

  if (signature === undefined) {
    return <p {...props(styles.plain)}>{text}</p>;
  }

  // The letters show through the strokes the pen has drawn so far, and whole
  // once it is done or where it never ran.
  const writing = at < 1;
  const lines = [
    { line: signature.name, style: styles.name },
    { line: signature.place, style: styles.place },
  ];
  const strokes = timeline(lines.map(({ line }) => line));
  return (
    <p ref={sign} {...props(styles.sign)}>
      <span {...props(layout.spoken)}>{text}</span>
      <svg
        aria-hidden="true"
        height={(signature.height * SIZE) / 1000}
        viewBox={`0 0 ${signature.width} ${signature.height}`}
        width={(signature.width * SIZE) / 1000}
        {...props(styles.written)}
      >
        {lines.map(({ line, style }, index) => {
          const ink = `${id}-ink-${index}`;
          return (
            <g key={ink}>
              {writing ? (
                <mask id={ink} {...props(styles.mask)}>
                  {(strokes[index] ?? []).map((stroke) => {
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
              <path d={line.d} mask={writing ? `url(#${ink})` : undefined} {...props(style)} />
            </g>
          );
        })}
      </svg>
    </p>
  );
}
