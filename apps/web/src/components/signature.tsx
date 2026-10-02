import { colors, font } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { cubicBezier, useInView } from 'motion/react';
import { useId, useRef } from 'react';
import { drawing } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';
import { SIGNATURES } from './signature-glyphs.ts';
import { stretch, usePlayhead } from './steps/playhead.ts';

/** The name is written as large as type this many pixels tall. */
const SIZE = 48;
/** How much of the signature has to be on screen before the pen starts. */
const SEEN = 0.8;
/**
 * The share of the writing the name takes. The pen lifts, then writes the
 * place and date from `PLACE_FROM` to the end.
 */
const NAME_TO = 0.64;
const PLACE_FROM = 0.7;
/** How wide the ink at the pen's tip fades in, in the signature's units. */
const TIP = 160;
/** A hand's pace: it sets off slowly, writes evenly, and settles at the end. */
const pen = cubicBezier(0.4, 0.1, 0.45, 1);

const styles = create({
  // Only how opaque the mask is counts, not its colour.
  mask: {
    maskType: 'alpha',
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
    height: 'auto',
    maxWidth: '100%',
  },
});

/**
 * Who wrote the story, from where and when, in handwriting that is written
 * from left to right the first time it comes on screen. A reader who asked
 * for less motion, and a page that has not run its script, get it already
 * written.
 */
export function Signature() {
  const text = m.home_story_sign();
  const signature = SIGNATURES[text];
  const sign = useRef<HTMLParagraphElement>(null);
  const seen = useInView(sign, { amount: SEEN, once: true });
  const at = usePlayhead(seen, drawing.signature);
  const id = useId();

  if (signature === undefined) {
    return <p {...props(styles.plain)}>{text}</p>;
  }

  const lines = [
    { line: signature.name, style: styles.name, written: stretch(at, 0, NAME_TO, pen) },
    { line: signature.place, style: styles.place, written: stretch(at, PLACE_FROM, 1, pen) },
  ];
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
        {lines.map(({ line, style, written }, index) => {
          // The ink shows up to the pen's tip, which crosses the line from
          // its first letter until the tip's fade has passed its last.
          const tip = line.left + written * (line.right - line.left + TIP);
          const ink = `${id}-ink-${index}`;
          return (
            <g key={ink}>
              <linearGradient
                gradientUnits="userSpaceOnUse"
                id={`${ink}-tip`}
                x1={tip - TIP}
                x2={tip}
                y1={0}
                y2={0}
              >
                <stop offset={0} />
                <stop offset={1} stopOpacity={0} />
              </linearGradient>
              <mask id={ink} {...props(styles.mask)}>
                <rect fill={`url(#${ink}-tip)`} height="100%" width="100%" />
              </mask>
              <path d={line.d} mask={`url(#${ink})`} {...props(style)} />
            </g>
          );
        })}
      </svg>
    </p>
  );
}
