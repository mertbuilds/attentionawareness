import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, keyframes, props } from '@stylexjs/stylex';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import type { MotionValue } from 'motion/react';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowsRotate } from 'reicon-react';
import {
  AVERAGE_HOURS,
  formatYears,
  heroMetrics,
  HORIZON_YEARS,
  WAKING_HOURS,
} from '../lib/attention-math.ts';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { BillFilters } from './bill-paper.tsx';
import { GridTexture } from './grid-texture.tsx';
import { InfoTip } from './info-tip.tsx';

/** The report the average day is taken from. */
const SOURCE_URL = 'https://datareportal.com/reports/digital-2024-global-overview-report';
/** The story's sentences, in the order the scroll plays them. */
const BEATS = 5;
/**
 * The scroll each beat takes, in hundredths of a screen so the heights come
 * out whole: a little under half a screen, except the last, which holds for
 * less, then the page carries it away with the rest of the stage.
 */
const BEAT_SCROLL = 45;
const LAST_BEAT_SCROLL = 30;
/** How far the stage stands pinned for, in hundredths of a screen. */
const SPAN = (BEATS - 1) * BEAT_SCROLL + LAST_BEAT_SCROLL;
/** How much of the story's progress one beat takes. */
const BEAT = BEAT_SCROLL / SPAN;
/**
 * The beat that walks around the Earth, and how far into it the walk is done,
 * early enough that the whole walk stands drawn for a moment before the next.
 */
const EARTH_BEAT = 2;
const WALKED_BY = 0.7;
/** How far into the story the progress rail has faded in. */
const RAIL_IN = 0.02;
/** How much of the stage has to be on screen before a figure counts. */
const SEEN = 0.6;
/** A figure counts up for this long, slowing into its value, well inside its beat. */
const COUNT_SECONDS = 1;
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** The reroll icon turns half a turn a press. */
const TURN_DEGREES = 180;
const TURN_SECONDS = 0.7;
const ICON_SIZE = 16;
/** The figures the story tells on its own, so "What else?" never offers them. */
const TOLD = new Set(['earth', 'languages']);
/**
 * What marks a figure's place in a sentence. The message is written with a
 * placeholder for each figure and split on this, so the words around a figure
 * keep their own order in every language instead of being stitched from
 * pieces.
 */
const SLOT = '\u0000';
/** The grid behind the stage, solid in the middle and gone before the edges. */
const GRID_MASK = 'radial-gradient(ellipse at 50% 50%, black 35%, transparent 80%)';
/** The last run of non-blank characters in a piece of a sentence: its last word. */
const LAST_WORD = /\S*$/u;
/** The globe and the walk around it, in the drawing's own 200-unit box. */
const BOX = 200;
const CENTER = BOX / 2;
const GLOBE_RADIUS = 52;
const MERIDIAN_SQUASH = 0.42;
const EQUATOR_SQUASH = 0.3;
/** The walk spirals out one lap a trip, from just off the globe to the edge. */
const ORBIT_INNER = 64;
const ORBIT_OUTER = 94;
const POINTS_PER_LAP = 72;
const WALKER_RADIUS = 3.5;
/** The scroll cue: a short track at the foot of the first beat, and the drop that runs down it. */
const CUE_HEIGHT = 48;
const CUE_DROP = 12;

/** One answer to "What else?": the sentence it is told in, and how it is counted. */
type Answer = { line: (inputs: { count: string }) => string; tip: () => string };

const ANSWERS: Record<string, Answer> = {
  books: { line: m.home_cost_books, tip: m.home_receipt_books_tip },
  degrees: { line: m.home_cost_degrees, tip: m.home_receipt_degrees_tip },
  instruments: { line: m.home_cost_instruments, tip: m.home_receipt_instruments_tip },
  marathons: { line: m.home_cost_marathons, tip: m.home_receipt_marathons_tip },
  novels: { line: m.home_cost_novels, tip: m.home_receipt_novels_tip },
  skills: { line: m.home_cost_skills, tip: m.home_receipt_skills_tip },
  travel: { line: m.home_cost_travel, tip: m.home_receipt_travel_tip },
};

/** A new answer to "What else?" comes up out of focus, and the old one goes the other way. */
const answerIn = keyframes({
  from: { filter: 'blur(6px)', opacity: 0, transform: 'translateY(16px)' },
  to: { filter: 'blur(0)', opacity: 1, transform: 'none' },
});
const answerOut = keyframes({
  from: { filter: 'blur(0)', opacity: 1, transform: 'none' },
  to: { filter: 'blur(6px)', opacity: 0, transform: 'translateY(-16px)' },
});

/** The drop falls from above the track to below it, and starts over. */
const cueFall = keyframes({
  from: { transform: `translateY(-${CUE_DROP}px)` },
  to: { transform: `translateY(${CUE_HEIGHT}px)` },
});

const styles = create({
  // One sentence of the story. They all stand in the same cell, so the stage
  // is as tall as the tallest and nothing moves when one takes over from the
  // next. With less motion they stand one under the other instead.
  beat: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s6,
    },
    gridArea: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: '1 / 1',
    },
    textAlign: 'center',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '700ms',
    },
    transitionProperty: 'opacity, transform, filter',
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    width: '100%',
  },
  // Still to come: under the line, out of focus, and out of the pointer's way.
  beatNext: {
    filter: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'blur(8px)',
    },
    opacity: {
      '@media (prefers-reduced-motion: reduce)': 1,
      default: 0,
    },
    pointerEvents: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: 'none',
    },
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'translateY(40px)',
    },
  },
  // Already told: gone the other way, up and out.
  beatPast: {
    filter: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'blur(8px)',
    },
    opacity: {
      '@media (prefers-reduced-motion: reduce)': 1,
      default: 0,
    },
    pointerEvents: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: 'none',
    },
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'translateY(-40px)',
    },
  },
  beats: {
    alignItems: 'center',
    display: 'grid',
    justifyItems: 'center',
    rowGap: {
      '@media (prefers-reduced-motion: reduce)': spacing.s16,
      default: 0,
    },
    width: '100%',
  },
  // The way on, pinned with the stage just over the progress rail. It stands
  // while the first beat does and fades as the second comes on, so it is never
  // seen past the first beat. With less motion the beats already stand one
  // under the other, and there is nothing to point at.
  cue: {
    backgroundColor: colors.border,
    borderRadius: 999,
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'block',
    },
    height: CUE_HEIGHT,
    insetBlockEnd: `calc(${spacing.s8} + ${spacing.s4})`,
    insetInlineStart: '50%',
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translateX(-50%)',
    transitionDuration: '400ms',
    transitionProperty: 'opacity, visibility',
    transitionTimingFunction: 'ease-out',
    width: 2,
  },
  cueDrop: {
    animationDuration: '1.8s',
    animationIterationCount: 'infinite',
    animationName: cueFall,
    animationTimingFunction: 'cubic-bezier(0.65, 0, 0.35, 1)',
    backgroundColor: accent.base,
    display: 'block',
    height: CUE_DROP,
    width: '100%',
  },
  // Past the first beat: faded out of sight.
  cueGone: {
    opacity: 0,
    visibility: 'hidden',
  },
  // The count, stood over the room its last value takes, so the sentence
  // around it never reflows while it climbs.
  figure: {
    color: accent.base,
    display: 'inline-grid',
    fontVariantNumeric: 'tabular-nums',
  },
  figureCount: {
    gridArea: '1 / 1',
    textAlign: 'end',
  },
  // Drawn rather than written, so the sentence's text holds the number once.
  figureRoom: {
    '::before': {
      content: 'attr(data-room)',
    },
    gridArea: '1 / 1',
    visibility: 'hidden',
  },
  globe: {
    fill: 'none',
    stroke: colors.muted,
    strokeWidth: 1,
  },
  globeFaint: {
    opacity: 0.5,
  },
  // The page's graph paper, pinned with the stage and as wide as the window,
  // so the story is told on it from the first beat to the last.
  grid: {
    height: '100%',
    insetInlineEnd: 'auto',
    insetInlineStart: 'calc(50% - 50vw)',
    maskImage: GRID_MASK,
    WebkitMaskImage: GRID_MASK,
    width: '100vw',
  },
  // Large and light: the story is read one sentence a screen, so each one is
  // set as big as the first screen's claim and a weight under it.
  line: {
    color: colors.fg,
    fontSize: {
      '@media (min-width: 640px)': 'clamp(36px, 4.6vw, 56px)',
      default: 'clamp(28px, 7.5vw, 36px)',
    },
    fontWeight: font.weightRegular,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
    margin: 0,
    maxWidth: 720,
    textWrap: 'balance',
  },
  // The small i after a figure, a breath away from the word before it.
  mark: {
    display: 'inline-flex',
    marginInlineStart: '0.3em',
    verticalAlign: 'middle',
  },
  // The i and the word before it, never split across two lines.
  markWord: {
    whiteSpace: 'nowrap',
  },
  orbit: {
    display: 'block',
    height: 'auto',
    overflow: 'visible',
    width: {
      '@media (min-width: 640px)': 200,
      default: 160,
    },
  },
  orbitLine: {
    fill: 'none',
    stroke: accent.base,
    strokeLinecap: 'round',
    strokeWidth: 1.5,
  },
  // The answer's own room, two lines tall at the story's size, so the button
  // under it stays put while one answer trades places with the next. Both
  // stand in the same cell while they do.
  pick: {
    alignItems: 'center',
    display: 'grid',
    fontSize: {
      '@media (min-width: 640px)': 'clamp(36px, 4.6vw, 56px)',
      default: 'clamp(28px, 7.5vw, 36px)',
    },
    justifyItems: 'center',
    minHeight: '2.3em',
    width: '100%',
  },
  pickIn: {
    animationDelay: '100ms',
    animationDuration: '450ms',
    animationFillMode: 'both',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: answerIn,
    },
    animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
    gridArea: '1 / 1',
  },
  pickOut: {
    animationDuration: '300ms',
    animationFillMode: 'forwards',
    animationName: answerOut,
    animationTimingFunction: 'ease-in',
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'block',
    },
    gridArea: '1 / 1',
    pointerEvents: 'none',
  },
  // How far along the story is, a hairline at the foot of the stage.
  rail: {
    backgroundColor: colors.border,
    borderRadius: 999,
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'block',
    },
    height: 2,
    insetBlockEnd: spacing.s8,
    insetInlineStart: '50%',
    overflow: 'hidden',
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: 96,
  },
  railFill: {
    backgroundColor: accent.base,
    display: 'block',
    height: '100%',
    transformOrigin: 'left',
    width: '100%',
  },
  reroll: {
    display: 'inline-flex',
  },
  // The screen the story is told on. It stands still while the section
  // scrolls under it, and clears the brand bar at the top.
  stage: {
    alignItems: 'center',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    height: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: firstThatWorks('100dvh', '100svh', '100vh'),
    },
    insetBlockStart: 0,
    justifyContent: 'center',
    paddingBlockEnd: {
      '@media (prefers-reduced-motion: reduce)': 0,
      default: spacing.s16,
    },
    paddingBlockStart: {
      '@media (prefers-reduced-motion: reduce)': spacing.s16,
      default: `calc(${spacing.s16} + ${wip.height})`,
    },
    position: {
      '@media (prefers-reduced-motion: reduce)': 'relative',
      default: 'sticky',
    },
  },
  // The stage and the scroll it is pinned through: one screen for the stage,
  // and the scroll the beats take turns in.
  story: {
    height: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: firstThatWorks(`${SPAN + 100}svh`, `${SPAN + 100}vh`),
    },
    // Pinned, the stage clears the brand bar itself. Standing in the column,
    // a jump to the story stops short of it instead.
    scrollMarginBlockStart: {
      '@media (prefers-reduced-motion: reduce)': `calc(${spacing.s16} + ${wip.height})`,
      default: 0,
    },
  },
  walker: {
    fill: accent.base,
  },
});

/** One of the keys, at random. Only ever called from a press, never in a render. */
function drawOne(keys: ReadonlyArray<string>): string | undefined {
  return keys[Math.floor(Math.random() * keys.length)];
}

/** A figure's placeholder: its index, between two slot marks. */
function slot(index: number): string {
  return `${SLOT}${index}${SLOT}`;
}

/**
 * A sentence with figures in it, and the small i that says how it is counted.
 * Split on the slot mark, every other piece is a figure's index and the pieces
 * between are the words around it. The i ends the sentence and holds on to its
 * last word: a browser would otherwise start a line with it.
 */
function Sentence({
  figures,
  mark,
  text,
}: {
  figures: ReadonlyArray<ReactNode>;
  mark: ReactNode;
  text: string;
}) {
  const pieces = text.split(SLOT);
  return pieces.map((piece, index) => {
    if (index % 2 === 1) {
      return <Fragment key={index}>{figures[Number(piece)]}</Fragment>;
    }
    if (index < pieces.length - 1) {
      return <Fragment key={index}>{piece}</Fragment>;
    }
    const cut = piece.search(LAST_WORD);
    return (
      <Fragment key={index}>
        {piece.slice(0, cut)}
        <span {...props(styles.markWord)}>
          {piece.slice(cut)}
          {mark}
        </span>
      </Fragment>
    );
  });
}

/**
 * A number that counts up from zero each time its beat comes on. It waits at
 * zero until then, and stands at its value from the start for a reader who
 * asked for less motion, or whose page has not run its script. One that does
 * not wait, like an answer on its way out, stands at its value too.
 */
function Figure({
  decimals = 0,
  run,
  value,
  waits = true,
}: {
  decimals?: number;
  run: boolean;
  value: number;
  waits?: boolean;
}) {
  const reduced = useReducedMotion();
  const format = new Intl.NumberFormat(getLocale(), {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
  const count = useMotionValue(value);
  const shown = useTransform(count, (latest) => format.format(latest));

  useEffect(() => {
    if (reduced !== true && waits) {
      count.set(0);
    }
  }, [count, reduced, waits]);

  useEffect(() => {
    if (reduced === true) {
      count.set(value);
      return;
    }
    if (!run) {
      return;
    }
    count.set(0);
    const controls = animate(count, value, { duration: COUNT_SECONDS, ease: EASE_OUT });
    return () => controls.stop();
  }, [count, reduced, run, value]);

  return (
    <span {...props(styles.figure)}>
      <span aria-hidden="true" data-room={format.format(value)} {...props(styles.figureRoom)} />
      <motion.span {...props(styles.figureCount)}>{shown}</motion.span>
    </span>
  );
}

/** The small i after a figure, and how it is counted. */
function Mark({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span {...props(styles.mark)}>
      <InfoTip label={label}>{children}</InfoTip>
    </span>
  );
}

/** Where the walk is `t` of the way along: one lap a trip, spiralling out. */
function orbitPoint(laps: number, t: number): { x: number; y: number } {
  const angle = t * laps * 2 * Math.PI - Math.PI / 2;
  const radius = ORBIT_INNER + (ORBIT_OUTER - ORBIT_INNER) * t;
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

/** The whole walk as one path, starting at the top and going clockwise. */
function orbitPath(laps: number): string {
  const steps = Math.max(1, laps) * POINTS_PER_LAP;
  return Array.from({ length: steps + 1 }, (_, step) => {
    const { x, y } = orbitPoint(laps, step / steps);
    return `${step === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

/**
 * A plain globe, and the walks around it drawn as the reader scrolls: one lap
 * for every trip around the Earth, with the walker at the head of the line.
 * With less motion the walk stands drawn whole.
 */
function Orbit({ laps, walked }: { laps: number; walked: MotionValue<number> }) {
  const reduced = useReducedMotion();
  const walkerX = useTransform(walked, (t) => orbitPoint(laps, t).x);
  const walkerY = useTransform(walked, (t) => orbitPoint(laps, t).y);
  const walkerOpacity = useTransform(walked, [0, 0.02], [0, 1]);
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${BOX} ${BOX}`} {...props(styles.orbit)}>
      <circle cx={CENTER} cy={CENTER} r={GLOBE_RADIUS} {...props(styles.globe)} />
      <ellipse
        cx={CENTER}
        cy={CENTER}
        rx={GLOBE_RADIUS * MERIDIAN_SQUASH}
        ry={GLOBE_RADIUS}
        {...props(styles.globe, styles.globeFaint)}
      />
      <ellipse
        cx={CENTER}
        cy={CENTER}
        rx={GLOBE_RADIUS}
        ry={GLOBE_RADIUS * EQUATOR_SQUASH}
        {...props(styles.globe, styles.globeFaint)}
      />
      <motion.path
        d={orbitPath(laps)}
        {...props(styles.orbitLine)}
        style={{ pathLength: reduced === true ? 1 : walked }}
      />
      {reduced === true ? null : (
        <motion.circle
          cx={walkerX}
          cy={walkerY}
          r={WALKER_RADIUS}
          {...props(styles.walker)}
          style={{ opacity: walkerOpacity }}
        />
      )}
    </svg>
  );
}

/**
 * Act one: what the average day costs, told one sentence a screen. The stage
 * stands pinned while the section scrolls under it, each beat takes over from
 * the last, and its figure counts up as it comes on. The Earth beat draws its
 * walk with the scroll itself. "What else?" ends it with the rest of what the
 * same hours would have bought, one at a time.
 */
export function CostStory({ id }: { id: string }) {
  const story = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const seen = useInView(stage, { amount: SEEN });
  const { scrollYProgress } = useScroll({ offset: ['start start', 'end end'], target: story });
  const [active, setActive] = useState(0);
  // The progress rail comes in once the story has started to move.
  // A function rather than a range: motion hands a range on the scroll itself
  // to the browser's scroll timeline, which read this one backwards.
  const railOpacity = useTransform(scrollYProgress, (progress) => Math.min(1, progress / RAIL_IN));
  const walked = useTransform(
    scrollYProgress,
    [EARTH_BEAT * BEAT, (EARTH_BEAT + WALKED_BY) * BEAT],
    [0, 1],
  );

  const metrics = heroMetrics(AVERAGE_HOURS);
  const amountOf = (key: string) => metrics.find((metric) => metric.key === key)?.amount ?? 0;
  const earth = amountOf('earth');
  const answers = metrics.flatMap((metric) => {
    const answer = ANSWERS[metric.key];
    return answer === undefined || TOLD.has(metric.key) || metric.amount === 0
      ? []
      : [{ ...answer, amount: metric.amount, key: metric.key }];
  });
  const first = answers[0]?.key ?? '';
  const [pick, setPick] = useState(first);
  // The answer the last press took away, on its way out.
  const [previous, setPrevious] = useState<string | null>(null);
  // The answers this round has shown, so every one comes up before any repeats.
  const [shown, setShown] = useState<ReadonlyArray<string>>([first]);
  const [turns, setTurns] = useState(0);
  const answer = answers.find((candidate) => candidate.key === pick);
  const leaving = answers.find((candidate) => candidate.key === previous);
  // The waking years, as the page prints them, counted at the same precision.
  const years = Number(formatYears(AVERAGE_HOURS));

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    setActive(Math.min(BEATS - 1, Math.floor(latest / BEAT)));
  });

  // A beat reached from the keyboard is scrolled to, so what has focus is the
  // sentence on the stage rather than one faded out of sight.
  function reveal(index: number) {
    const element = story.current;
    if (element === null || reduced === true || index === active) {
      return;
    }
    const range = element.offsetHeight - window.innerHeight;
    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (index + 0.25) * BEAT * range });
  }

  function reroll() {
    const keys = answers.map((candidate) => candidate.key);
    const fresh = keys.filter((key) => !shown.includes(key));
    const next = drawOne(fresh.length > 0 ? fresh : keys.filter((key) => key !== pick));
    if (next === undefined) {
      return;
    }
    setShown(fresh.length > 0 ? [...shown, next] : [pick, next]);
    setPrevious(pick);
    setPick(next);
    setTurns((turn) => turn + 1);
  }

  function beat(index: number) {
    return {
      onFocus: () => reveal(index),
      ...props(styles.beat, index < active && styles.beatPast, index > active && styles.beatNext),
    };
  }

  const on = (index: number) => seen && active === index;
  const tipLabel = m.home_receipt_tip_label();

  return (
    <section id={id} ref={story} {...props(styles.story)}>
      <BillFilters />
      <div ref={stage} {...props(styles.stage)}>
        <GridTexture style={styles.grid} />
        <div {...props(styles.beats)}>
          <div {...beat(0)}>
            {/* The page's heading: the first thing it says. */}
            <h1 {...props(styles.line)}>
              <Sentence
                figures={[<Figure key="hours" run={on(0)} value={AVERAGE_HOURS} />]}
                mark={
                  <Mark label={m.home_cost_source_label()}>
                    <a href={SOURCE_URL} rel="noreferrer" target="_blank">
                      {m.home_gate_source()}
                    </a>
                  </Mark>
                }
                text={m.home_cost_average({ hours: slot(0) })}
              />
            </h1>
          </div>

          <div {...beat(1)}>
            <p {...props(styles.line)}>
              <Sentence
                figures={[
                  <Figure
                    decimals={Number.isInteger(years) ? 0 : 1}
                    key="years"
                    run={on(1)}
                    value={years}
                  />,
                ]}
                mark={
                  <Mark label={tipLabel}>
                    {m.home_receipt_total_tip({
                      hours: AVERAGE_HOURS,
                      percent: Math.round((AVERAGE_HOURS / WAKING_HOURS) * 100),
                      years: formatYears(AVERAGE_HOURS),
                    })}
                  </Mark>
                }
                text={m.home_cost_years({ horizon: HORIZON_YEARS, years: slot(0) })}
              />
            </p>
          </div>

          <div {...beat(EARTH_BEAT)}>
            <Orbit laps={earth} walked={walked} />
            <p {...props(styles.line)}>
              <Sentence
                figures={[<Figure key="earth" run={on(EARTH_BEAT)} value={earth} />]}
                mark={<Mark label={tipLabel}>{m.home_receipt_earth_tip()}</Mark>}
                text={m.home_cost_earth({ count: slot(0) })}
              />
            </p>
          </div>

          <div {...beat(3)}>
            <p {...props(styles.line)}>
              <Sentence
                figures={[<Figure key="languages" run={on(3)} value={amountOf('languages')} />]}
                mark={<Mark label={tipLabel}>{m.home_receipt_languages_tip()}</Mark>}
                text={m.home_cost_languages({ count: slot(0) })}
              />
            </p>
          </div>

          <div {...beat(4)}>
            <p {...props(styles.line)}>{m.home_cost_more()}</p>
            <div aria-live="polite" {...props(styles.pick)}>
              {/* Keyed by the press as well, so every press plays the swap
              again, even for an answer that has been up before. */}
              {leaving === undefined ? null : (
                <p
                  aria-hidden="true"
                  key={`${leaving.key}-${turns}`}
                  {...props(styles.line, styles.pickOut)}
                >
                  <Sentence
                    figures={[
                      <Figure key={leaving.key} run={false} value={leaving.amount} waits={false} />,
                    ]}
                    mark={null}
                    text={leaving.line({ count: slot(0) })}
                  />
                </p>
              )}
              {answer === undefined ? null : (
                <p key={`${answer.key}-${turns}`} {...props(styles.line, styles.pickIn)}>
                  <Sentence
                    figures={[<Figure key={answer.key} run={on(4)} value={answer.amount} />]}
                    mark={<Mark label={tipLabel}>{answer.tip()}</Mark>}
                    text={answer.line({ count: slot(0) })}
                  />
                </p>
              )}
            </div>
            <Button onClick={reroll} variant="outline">
              <motion.span
                animate={{ rotate: turns * TURN_DEGREES }}
                transition={
                  reduced === true ? { duration: 0 } : { duration: TURN_SECONDS, ease: EASE_OUT }
                }
                {...props(styles.reroll)}
              >
                <ArrowsRotate aria-hidden="true" size={ICON_SIZE} />
              </motion.span>
              {m.home_cost_reroll()}
            </Button>
          </div>
        </div>
        <span aria-hidden="true" {...props(styles.cue, active > 0 && styles.cueGone)}>
          <span {...props(styles.cueDrop)} />
        </span>
        <motion.span aria-hidden="true" {...props(styles.rail)} style={{ opacity: railOpacity }}>
          <motion.span {...props(styles.railFill)} style={{ scaleX: scrollYProgress }} />
        </motion.span>
      </div>
    </section>
  );
}
