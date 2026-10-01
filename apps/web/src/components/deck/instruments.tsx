import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useState } from 'react';
import { drawing } from '../../lib/motion.stylex.ts';
import { HEIGHT, WIDTH } from './box.ts';

/** The whole run, from the first sound to the last. */
const RUN_SECONDS = drawing.deck;
/**
 * How long each step takes, before the run is scaled to its length: every
 * step quicker than the one before, and the last few slowing again, so the
 * run lands rather than stops.
 */
const SPEED_UP = 0.72;
const SLOW_DOWN = 0.45;
const SETTLE = 0.9;
/** The share of a step spent playing the instrument it stands on. The rest morphs it into the next. */
const PLAYING = 0.55;
/** The parts morph from left to right: the last starts this share of the morph after the first. */
const STAGGER = 0.3;
/** The instruments played in turn, up to this many. Past it, one stands for more than one. */
const SHOWN_MAX = 9;
const INSTRUMENTS = ['piano', 'guitar', 'drum'] as const;
/**
 * The drawing is twelve parts, one for each key of an octave: the white keys
 * C to B, then the black ones, drawn over them. Each is its key's place in
 * the scale, which orders them left to right in every instrument.
 */
const SCALE = [0, 2, 4, 5, 7, 9, 11, 1, 3, 6, 8, 10];
const WHITE_KEYS = 7;
/** The line every instrument stands on the middle of: the middle of the box. */
const MIDDLE = HEIGHT / 2;
/** The sound: a bar for each note, the tallest in the middle. */
const BARS_X = 49;
const BAR_PITCH = 18.5;
const BAR = 4;
const WAVE = [19, 35, 53, 40, 72, 51, 85, 61, 45, 67, 32, 21];
/** How quickly the bars of the first sound rise and fall, a little apart from each other. */
const WAVE_HERTZ = 1.4;
const WAVE_SPREAD = 1.3;
/** The keyboard: one octave, the black keys between the white ones they sit after. */
const KEYS_X = 48;
const KEYS_Y = MIDDLE - 53;
const WHITE_WIDTH = 32;
const WHITE_HEIGHT = 106;
const BLACK_WIDTH = 19;
const BLACK_HEIGHT = 64;
const BLACK_AFTER = [1, 2, 4, 5, 6];
/** How many keys the run has passed over once it is gone from the last. */
const RUN_LENGTH = SCALE.length + 2;
const RUN_LIT = 1.5;
/** The neck: six strings, thin to thick, across the nut and five frets closing up toward the body. */
const STRING_PARTS = [7, 8, 9, 10, 11, 6];
const STRINGS_X = 32;
const STRINGS_WIDTH = 256;
const STRING_PITCH = 15;
const STRINGS_Y = MIDDLE - (STRING_PITCH * 5) / 2;
const STRING = 0.8;
const STRING_THICKER = 0.16;
const FRETS = [40, 85, 128, 168, 207, 243];
const FRET_HEIGHT = 91;
const NUT = 2.4;
/** The strum: each string plucked this long after the one over it, ringing out and dying away. */
const STRUM = 0.07;
const PLUCK = 4.3;
const DECAY = 4;
const RING_HERTZ = 7;
/** The drum: its head, the shell under it, and the six lugs round the front, by their angle off the middle. */
const DRUM_X = WIDTH / 2;
const HEAD_Y = MIDDLE - 29;
const HEAD_RX = 83;
const HEAD_RY = 20;
const SHELL = 61;
const LUGS = [-75, -45, -15, 15, 45, 75];
const LUG_INSET = 5;
/** The head is struck as the drum comes on, and the ripples spread out across it, one after another. */
const HIT = 0.3;
const RIPPLE_FIRST = 8;
const RIPPLE_FROM = 0.12;
const RIPPLE_TO = 0.94;
const RIPPLE_AFTER = 0.12;
const RIPPLE_SPAN = 0.6;
/** Once it is done the last sound keeps breathing, each bar a little after the one before. */
const BREATH_AFTER = 0.09;

type Scene = 'drum' | 'guitar' | 'piano' | 'played' | 'wave';
/** How a part is filled: not at all, or as a white or a black key. */
type Fill = 'black' | 'none' | 'white';
/**
 * Every part, in every instrument, is the same shape: a box whose corners
 * round off by the same two radii, and whose top and bottom edges can bow.
 * Square corners make a key, full radii an ellipse, no width a bar and no
 * height a string. A morph is the numbers in between, so a part turns into
 * the next without ever coming apart.
 */
type Part = {
  bow: number;
  fill: Fill;
  height: number;
  lit: boolean;
  opacity: number;
  rx: number;
  ry: number;
  stroke: number;
  width: number;
  x: number;
  y: number;
};

const LINE: Part = {
  bow: 0,
  fill: 'none',
  height: 0,
  lit: false,
  opacity: 1,
  rx: 0,
  ry: 0,
  stroke: 1,
  width: 0,
  x: 0,
  y: 0,
};

/** The sound, once it is done, slowly rising and falling. */
const breathe = keyframes({
  from: { transform: 'scaleY(1)' },
  to: { transform: 'scaleY(0.8)' },
});

const styles = create({
  breathe: {
    animationDirection: 'alternate',
    animationDuration: '1.4s',
    animationIterationCount: 'infinite',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: breathe,
    },
    animationTimingFunction: 'ease-in-out',
    transformBox: 'fill-box',
    transformOrigin: 'center',
  },
  drawing: {
    display: 'block',
    height: 'auto',
    maxWidth: 400,
    overflow: 'visible',
    width: '100%',
  },
  key: {
    fill: colors.muted,
  },
  // What is sounding: a key under the run, a string ringing, a ripple, the
  // last sound. It lights at once and fades back slowly.
  lit: {
    stroke: accent.base,
    transitionDuration: '60ms',
  },
  litKey: {
    fill: accent.base,
  },
  part: {
    fill: 'transparent',
    stroke: colors.muted,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '250ms, 400ms',
    },
    transitionProperty: 'fill, stroke',
    transitionTimingFunction: 'ease-out',
  },
});

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function fixed(value: number): string {
  return value.toFixed(2);
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** How long each step takes, relative to the others. */
function stepWeights(steps: number): Array<number> {
  return Array.from(
    { length: steps },
    (_, step) => SPEED_UP ** step + SETTLE * SLOW_DOWN ** (steps - 1 - step),
  );
}

/** How many steps in the run is `run` of the way through it, counting the part of the one under way. */
function stepsAt(run: number, weights: ReadonlyArray<number>): number {
  let left = run * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [step, weight] of weights.entries()) {
    if (left < weight) {
      return step + left / weight;
    }
    left -= weight;
  }
  return weights.length;
}

/** A bar of the sound, `swing` of its full height. */
function bar(note: number, swing: number, lit: boolean): Part {
  const height = (WAVE[note] ?? 0) * swing;
  return {
    ...LINE,
    height,
    lit,
    stroke: BAR,
    x: BARS_X + (note + 0.5) * BAR_PITCH,
    y: MIDDLE - height / 2,
  };
}

/** A key, lit while the run passes over it. */
function key(part: number, note: number, playing: number): Part {
  const run = playing * RUN_LENGTH - 1;
  const lit = playing > 0 && note <= run && run < note + RUN_LIT;
  if (part < WHITE_KEYS) {
    return {
      ...LINE,
      fill: 'white',
      height: WHITE_HEIGHT,
      lit,
      width: WHITE_WIDTH,
      x: KEYS_X + part * WHITE_WIDTH,
      y: KEYS_Y,
    };
  }
  const after = BLACK_AFTER[part - WHITE_KEYS] ?? 0;
  return {
    ...LINE,
    fill: 'black',
    height: BLACK_HEIGHT,
    lit,
    width: BLACK_WIDTH,
    x: KEYS_X + after * WHITE_WIDTH - BLACK_WIDTH / 2,
    y: KEYS_Y,
  };
}

/** A string, ringing once the strum reaches it, or a fret. */
function fretboard(part: number, playing: number, seconds: number): Part {
  const string = STRING_PARTS.indexOf(part);
  if (string === -1) {
    return {
      ...LINE,
      height: FRET_HEIGHT,
      stroke: part === 0 ? NUT : 1,
      x: FRETS[part] ?? 0,
      y: MIDDLE - FRET_HEIGHT / 2,
    };
  }
  const since = playing - string * STRUM;
  const swing = since < 0 ? 0 : PLUCK * Math.exp(-DECAY * since);
  return {
    ...LINE,
    bow: swing * Math.sin(2 * Math.PI * (RING_HERTZ + string) * seconds),
    lit: swing > PLUCK / 3,
    stroke: STRING + string * STRING_THICKER,
    width: STRINGS_WIDTH,
    x: STRINGS_X,
    y: STRINGS_Y + string * STRING_PITCH,
  };
}

/** An ellipse on the drum's head, `scale` of the head's size. */
function onHead(scale: number): Part {
  return {
    ...LINE,
    height: 2 * HEAD_RY * scale,
    rx: HEAD_RX * scale,
    ry: HEAD_RY * scale,
    width: 2 * HEAD_RX * scale,
    x: DRUM_X - HEAD_RX * scale,
    y: HEAD_Y - HEAD_RY * scale,
  };
}

/**
 * A part of the drum: B is the shell, C sharp the head, the other black keys
 * the ripples across it, and the white keys C to A the lugs round the front.
 */
function drum(part: number, playing: number): Part {
  if (part === 6) {
    return { ...onHead(1), height: 2 * HEAD_RY + SHELL };
  }
  if (part === 7) {
    return { ...onHead(1), lit: playing < HIT };
  }
  if (part >= RIPPLE_FIRST) {
    const spread = clamp((playing - (part - RIPPLE_FIRST) * RIPPLE_AFTER) / RIPPLE_SPAN);
    const scale = mix(RIPPLE_FROM, RIPPLE_TO, 1 - (1 - spread) ** 2);
    return { ...onHead(scale), lit: true, opacity: 1 - spread };
  }
  const angle = ((LUGS[part] ?? 0) * Math.PI) / 180;
  return {
    ...LINE,
    height: SHELL - 2 * LUG_INSET,
    x: DRUM_X + HEAD_RX * Math.sin(angle),
    y: HEAD_Y + HEAD_RY * Math.cos(angle) + LUG_INSET,
  };
}

/** A part as it stands in a scene, `playing` of the way through playing it. */
function partIn(scene: Scene, part: number, playing: number, seconds: number): Part {
  const note = SCALE[part] ?? 0;
  switch (scene) {
    case 'wave':
      return bar(
        note,
        0.6 + 0.4 * Math.sin(2 * Math.PI * WAVE_HERTZ * seconds + note * WAVE_SPREAD),
        false,
      );
    case 'piano':
      return key(part, note, playing);
    case 'guitar':
      return fretboard(part, playing, seconds);
    case 'drum':
      return drum(part, playing);
    case 'played':
      return bar(note, 1, true);
  }
}

/** A part `t` of the way from one shape to the next. Its fill and light change over at halfway. */
function between(from: Part, to: Part, t: number): Part {
  const after = t >= 0.5 ? to : from;
  return {
    bow: mix(from.bow, to.bow, t),
    fill: after.fill,
    height: mix(from.height, to.height, t),
    lit: after.lit,
    opacity: mix(from.opacity, to.opacity, t),
    rx: mix(from.rx, to.rx, t),
    ry: mix(from.ry, to.ry, t),
    stroke: mix(from.stroke, to.stroke, t),
    width: mix(from.width, to.width, t),
    x: mix(from.x, to.x, t),
    y: mix(from.y, to.y, t),
  };
}

/**
 * A part's outline, clockwise from its top left: a curve along the top, each
 * corner an elliptical arc, which is a straight line when its radius is none.
 */
function outline({ bow, height, rx, ry, width, x, y }: Part): string {
  const right = x + width;
  const bottom = y + height;
  const middle = x + width / 2;
  const corner = `A${fixed(rx)} ${fixed(ry)} 0 0 1`;
  return [
    `M${fixed(x + rx)} ${fixed(y)}`,
    `Q${fixed(middle)} ${fixed(y + 2 * bow)} ${fixed(right - rx)} ${fixed(y)}`,
    `${corner} ${fixed(right)} ${fixed(y + ry)}`,
    `L${fixed(right)} ${fixed(bottom - ry)}`,
    `${corner} ${fixed(right - rx)} ${fixed(bottom)}`,
    `Q${fixed(middle)} ${fixed(bottom + 2 * bow)} ${fixed(x + rx)} ${fixed(bottom)}`,
    `${corner} ${fixed(x)} ${fixed(bottom - ry)}`,
    `L${fixed(x)} ${fixed(y + ry)}`,
    `${corner} ${fixed(x + rx)} ${fixed(y)}`,
    'Z',
  ].join(' ');
}

/**
 * The run's progress, from 0 to 1. It plays once from the start each time
 * `play` turns on, and goes back to the start when it turns off. It stands at
 * the end for a reader who asked for less motion, and for a page that has not
 * run its script.
 */
function useRun(play: boolean): number {
  const reduced = useReducedMotion();
  const progress = useMotionValue(1);
  const [run, setRun] = useState(1);
  useMotionValueEvent(progress, 'change', setRun);

  // Before the browser paints, so a drawing put on the page never shows its
  // end for a frame before it starts.
  useLayoutEffect(() => {
    if (reduced === true) {
      progress.set(1);
      return;
    }
    progress.set(0);
    if (!play) {
      return;
    }
    const controls = animate(progress, 1, { duration: RUN_SECONDS, ease: 'linear' });
    return () => controls.stop();
  }, [play, progress, reduced]);

  return run;
}

/**
 * A sound that turns into one instrument after another: piano keys lit in a
 * run, guitar strings strummed, a drum struck and rippling, round and round,
 * faster each time. It ends as the sound it started from, in orange.
 */
export function InstrumentsGraphic({ amount, play }: { amount: number; play: boolean }) {
  const run = useRun(play);
  const shown = Math.max(0, Math.min(SHOWN_MAX, amount));
  const scenes: ReadonlyArray<Scene> = [
    'wave',
    ...Array.from(
      { length: shown },
      (_, index) => INSTRUMENTS[index % INSTRUMENTS.length] ?? 'piano',
    ),
    'played',
  ];
  const at = stepsAt(run, stepWeights(scenes.length - 1));
  const step = Math.min(Math.floor(at), scenes.length - 2);
  const into = at - step;
  const playing = Math.min(1, into / PLAYING);
  const morph = clamp((into - PLAYING) / (1 - PLAYING));
  const seconds = run * RUN_SECONDS;
  const from = scenes[step] ?? 'wave';
  const to = scenes[step + 1] ?? 'played';

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} {...props(styles.drawing)}>
      {SCALE.map((note, index) => {
        const t = easeInOut(clamp((morph - (note / (SCALE.length - 1)) * STAGGER) / (1 - STAGGER)));
        const part = between(
          partIn(from, index, playing, seconds),
          partIn(to, index, 0, seconds),
          t,
        );
        // A key's fill goes over the first quarter of a morph and comes back
        // over the last, so a shape on its way between two is only ever drawn
        // in outline.
        const solid = part.fill === 'none' ? 0 : clamp(Math.abs(t - 0.5) * 4 - 1);
        return (
          <path
            d={outline(part)}
            fillOpacity={solid}
            key={index}
            opacity={part.opacity}
            strokeWidth={part.stroke}
            {...props(
              styles.part,
              part.fill === 'black' && styles.key,
              part.lit && styles.lit,
              part.lit && part.fill !== 'none' && styles.litKey,
              run === 1 && styles.breathe,
            )}
            style={{ animationDelay: `${note * BREATH_AFTER}s` }}
          />
        );
      })}
    </svg>
  );
}
