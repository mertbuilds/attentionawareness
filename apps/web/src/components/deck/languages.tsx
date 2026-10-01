import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import { useEffect, useState } from 'react';
import { getLocale } from '../../paraglide/runtime.js';

/**
 * Hello, then the same word in one language after another, each in its own
 * script where it has one. The list comes round again if the count outruns it.
 */
const GREETINGS: ReadonlyArray<string> = [
  'hello',
  'hola',
  'bonjour',
  'привет',
  'こんにちは',
  'merhaba',
  '你好',
  'ciao',
  'مرحبا',
  'olá',
  'नमस्ते',
  'hallo',
  '안녕하세요',
  'γεια σου',
  'שלום',
  'hej',
  'สวัสดี',
  'cześć',
  'xin chào',
  'jambo',
  'ahoj',
  'வணக்கம்',
  'halo',
  'გამარჯობა',
  'szia',
  'բարեւ',
  'kia ora',
  'নমস্কার',
  'salut',
  'aloha',
  'sawubona',
  'hei',
];
/** The drawing's own box, four by three. */
const WIDTH = 320;
const HEIGHT = 240;
const CENTER = WIDTH / 2;
/** The bubble the word is said in, and its tail, hanging off the lower left. */
const BUBBLE = { bottom: 142, left: 32, radius: 6, right: 288, top: 30 };
const TAIL = { from: 84, tipX: 56, tipY: 158, to: 64 };
const WORD_Y = (BUBBLE.top + BUBBLE.bottom) / 2;
const WORD_SIZE = 32;
/** How far a word travels on its flip: the old one up and out, the new one up and in. */
const RISE = 22;
/** A tick for every language under the bubble, and the count under them. */
const TICKS = { bottom: 182, left: 48, right: 272, top: 172 };
const COUNT_Y = 204;
const COUNT_SIZE = 13;
/** The whole run, slow at both ends and a blur in the middle. */
const SECONDS = 2.4;
const EASE: [number, number, number, number] = [0.5, 0, 0.3, 1];
/** How much of its turn a word stands still before it flips to the next. */
const HOLD = 0.5;

const BUBBLE_PATH = [
  `M${BUBBLE.left + BUBBLE.radius} ${BUBBLE.top}`,
  `H${BUBBLE.right - BUBBLE.radius}`,
  `A${BUBBLE.radius} ${BUBBLE.radius} 0 0 1 ${BUBBLE.right} ${BUBBLE.top + BUBBLE.radius}`,
  `V${BUBBLE.bottom - BUBBLE.radius}`,
  `A${BUBBLE.radius} ${BUBBLE.radius} 0 0 1 ${BUBBLE.right - BUBBLE.radius} ${BUBBLE.bottom}`,
  `H${TAIL.from}`,
  `L${TAIL.tipX} ${TAIL.tipY}`,
  `L${TAIL.to} ${BUBBLE.bottom}`,
  `H${BUBBLE.left + BUBBLE.radius}`,
  `A${BUBBLE.radius} ${BUBBLE.radius} 0 0 1 ${BUBBLE.left} ${BUBBLE.bottom - BUBBLE.radius}`,
  `V${BUBBLE.top + BUBBLE.radius}`,
  `A${BUBBLE.radius} ${BUBBLE.radius} 0 0 1 ${BUBBLE.left + BUBBLE.radius} ${BUBBLE.top}`,
  'Z',
].join(' ');

const styles = create({
  bubble: {
    fill: 'none',
    stroke: colors.muted,
    strokeLinejoin: 'round',
    strokeWidth: 1,
  },
  count: {
    fill: accent.base,
    fontSize: COUNT_SIZE,
    fontVariantNumeric: 'tabular-nums',
  },
  graphic: {
    display: 'block',
    height: 'auto',
    marginInline: 'auto',
    maxWidth: 360,
    width: '100%',
  },
  // A language still to come: a faint tick.
  tick: {
    stroke: colors.border,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  // A language counted: the tick in orange.
  tickCounted: {
    stroke: accent.base,
  },
  word: {
    fill: colors.fg,
    fontSize: WORD_SIZE,
  },
});

/** The greeting at a place on the reel. */
function greeting(index: number): string {
  return GREETINGS[index % GREETINGS.length] ?? '';
}

/**
 * Where the reel stands `t` of the way through: a whole number while a word
 * holds, and the fraction of a flip on the way to the next.
 */
function reelAt(t: number, flips: number): number {
  const at = t * flips;
  const whole = Math.floor(at);
  const flip = Math.min(1, Math.max(0, (at - whole - HOLD) / (1 - HOLD)));
  return whole + flip * flip * (3 - 2 * flip);
}

/** Where a language's tick stands along the row. */
function tickX(index: number, amount: number): number {
  return amount > 1 ? TICKS.left + (index * (TICKS.right - TICKS.left)) / (amount - 1) : CENTER;
}

/**
 * "Hello" in a speech bubble, flipping through one language after another,
 * slowly at first, then in a blur, then slowly onto the last. Under it a tick
 * for every language turns orange as it is counted. It plays once each time
 * `play` comes on and starts over when it goes off; with less motion it stands
 * on the last word with every tick counted.
 */
export function LanguagesGraphic({ amount, play }: { amount: number; play: boolean }) {
  const reduced = useReducedMotion();
  // Done until the page says otherwise, so a page that has not run its script
  // shows the last word.
  const progress = useMotionValue(1);
  const reel = useTransform(progress, (t) => reelAt(t, amount));
  const flip = useTransform(reel, (at) => at - Math.floor(at));
  const leaving = useTransform(reel, (at) => greeting(Math.floor(at)));
  const coming = useTransform(reel, (at) => greeting(Math.floor(at) + 1));
  const leavingY = useTransform(flip, [0, 1], [WORD_Y, WORD_Y - RISE]);
  const comingY = useTransform(flip, [0, 1], [WORD_Y + RISE, WORD_Y]);
  const leavingOpacity = useTransform(flip, [0, 0.6], [1, 0]);
  const comingOpacity = useTransform(flip, [0.4, 1], [0, 1]);
  const [counted, setCounted] = useState(amount);
  useMotionValueEvent(reel, 'change', (at) => setCounted(Math.round(at)));

  useEffect(() => {
    if (reduced === true) {
      progress.set(1);
      return;
    }
    progress.set(0);
    if (!play) {
      return;
    }
    const controls = animate(progress, 1, { duration: SECONDS, ease: EASE });
    return () => controls.stop();
  }, [play, progress, reduced]);

  const format = new Intl.NumberFormat(getLocale(), {
    minimumIntegerDigits: String(amount).length,
    useGrouping: false,
  });

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.graphic)}>
      <path d={BUBBLE_PATH} {...props(styles.bubble)} />
      <motion.text
        dominantBaseline="central"
        textAnchor="middle"
        x={CENTER}
        y={leavingY}
        {...props(styles.word)}
        style={{ opacity: leavingOpacity }}
      >
        {leaving}
      </motion.text>
      <motion.text
        dominantBaseline="central"
        textAnchor="middle"
        x={CENTER}
        y={comingY}
        {...props(styles.word)}
        style={{ opacity: comingOpacity }}
      >
        {coming}
      </motion.text>
      {Array.from({ length: amount }, (_, index) => (
        <line
          key={index}
          x1={tickX(index, amount)}
          x2={tickX(index, amount)}
          y1={TICKS.top}
          y2={TICKS.bottom}
          {...props(styles.tick, index < counted && styles.tickCounted)}
        />
      ))}
      <text
        dominantBaseline="central"
        textAnchor="middle"
        x={CENTER}
        y={COUNT_Y}
        {...props(styles.count)}
      >
        {format.format(counted)}
      </text>
    </svg>
  );
}
