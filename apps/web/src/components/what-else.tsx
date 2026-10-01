import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { animate, motion, useInView, useMotionValue } from 'motion/react';
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import type { FocusEvent, PointerEvent } from 'react';
import { ArrowsRotate } from 'reicon-react';
import { AVERAGE_HOURS, heroMetrics, HOURS_PER_SKILL } from '../lib/attention-math.ts';
import { blur, distance, drawing, duration, easing } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { Figure, Mark, Sentence, slot, useLessMotion } from './cost-story.tsx';
import { DECK_GRAPHICS } from './deck/index.ts';
import type { SkillLabels } from './deck/skills.tsx';

/** How much of the deck has to be on screen before it plays. */
const SEEN = 0.6;
/** `easing.smoothOut`, the curve things move into place on, as motion takes a curve. */
const SMOOTH_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/**
 * An answer's sentence goes out and the next comes in after it, a quick swap
 * each, and the next drawing waits for it to land.
 */
const SWAP_MS = 2 * Number.parseFloat(duration.quick);
/** The reroll icon turns half a turn an answer. */
const TURN_DEGREES = 180;
const TURN_SECONDS = 0.7;
const ICON_SIZE = 16;
/** The figures the story tells on its own, so "What else?" never offers them. */
const TOLD = new Set(['earth']);

/**
 * One answer to "What else?": the sentence it is told in, how it is counted,
 * how long its drawing plays if not an answer's usual time, and the words
 * drawn on it, if any.
 */
type Answer = {
  labels?: () => SkillLabels;
  line: (inputs: { count: string }) => string;
  seconds?: number;
  tip: () => string;
};
/** An answer the hours reach, with how many of it they would have bought. */
type Counted = Answer & { amount: number; key: string };

const ANSWERS: Record<string, Answer> = {
  books: { line: m.home_cost_books, tip: m.home_receipt_books_tip },
  degrees: { line: m.home_cost_degrees, tip: m.home_receipt_degrees_tip },
  instruments: {
    line: m.home_cost_instruments,
    seconds: drawing.instruments,
    tip: m.home_receipt_instruments_tip,
  },
  languages: { line: m.home_cost_languages, tip: m.home_receipt_languages_tip },
  marathons: { line: m.home_cost_marathons, tip: m.home_receipt_marathons_tip },
  novels: { line: m.home_cost_novels, tip: m.home_receipt_novels_tip },
  skills: {
    labels: () => ({
      hours: m.home_cost_skills_hours({
        hours: new Intl.NumberFormat(getLocale()).format(HOURS_PER_SKILL),
      }),
      names: [
        m.home_cost_skills_software(),
        m.home_cost_skills_drawing(),
        m.home_cost_skills_photography(),
        m.home_cost_skills_chess(),
      ],
    }),
    line: m.home_cost_skills,
    tip: m.home_receipt_skills_tip,
  },
  travel: { line: m.home_cost_travel, tip: m.home_receipt_travel_tip },
};

/**
 * A new answer to "What else?" takes the old one's place the way any text
 * swaps: the old sentence goes up a hair and out of focus, then the new one
 * comes up into its place. The drawings cross over each other meanwhile.
 */
const lineOut = keyframes({
  from: { filter: 'blur(0)', opacity: 1, transform: 'none' },
  to: {
    filter: `blur(${blur.small})`,
    opacity: 0,
    transform: `translateY(calc(-1 * ${distance.micro}))`,
  },
});
const lineIn = keyframes({
  from: { filter: `blur(${blur.small})`, opacity: 0, transform: `translateY(${distance.micro})` },
  to: { filter: 'blur(0)', opacity: 1, transform: 'none' },
});
const artOut = keyframes({
  from: { filter: 'blur(0)', opacity: 1 },
  to: { filter: `blur(${blur.small})`, opacity: 0 },
});
const artIn = keyframes({
  from: { filter: `blur(${blur.small})`, opacity: 0 },
  to: { filter: 'blur(0)', opacity: 1 },
});

const styles = create({
  // The drawing, as wide as the column on a phone and a set width beside the
  // words on a wide screen. The one on its way out stands in the same cell
  // while the next comes in.
  answerArt: {
    display: 'grid',
    width: {
      '@media (min-width: 640px)': 320,
      default: '100%',
    },
  },
  // The sentence's own room, two lines tall, so the button under it stays put
  // while one answer trades places with the next.
  answerRoom: {
    alignItems: 'center',
    display: 'grid',
    fontSize: {
      '@media (min-width: 640px)': 'clamp(28px, 3.6vw, 36px)',
      default: 'clamp(24px, 6.5vw, 28px)',
    },
    justifyItems: {
      '@media (min-width: 640px)': 'start',
      default: 'center',
    },
    minHeight: '2.4em',
    width: '100%',
  },
  // A drawing coming in for "Show another", out of focus to sharp, while the
  // last one goes the other way over it.
  artIn: {
    animationDuration: duration.slow,
    animationFillMode: 'both',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: artIn,
    },
    animationTimingFunction: easing.smoothOut,
  },
  artOut: {
    animationDuration: duration.slow,
    animationFillMode: 'forwards',
    animationName: artOut,
    animationTimingFunction: easing.smoothOut,
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'flex',
    },
    pointerEvents: 'none',
  },
  // The time left before the next answer takes this one's place: a hairline
  // under the button, along its straight edge, filling in orange. With less
  // motion nothing plays on its own, and there is nothing to count down.
  countdown: {
    backgroundColor: colors.border,
    borderRadius: 999,
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'block',
    },
    height: 2,
    marginInline: spacing.s4,
    overflow: 'hidden',
  },
  countdownFill: {
    backgroundColor: accent.base,
    display: 'block',
    height: '100%',
    transformOrigin: 'left',
    width: '100%',
  },
  // An answer, at the size of the facts around it.
  line: {
    color: colors.fg,
    fontWeight: font.weightRegular,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  // A sentence coming in for "Show another", once the last has gone out.
  lineIn: {
    animationDelay: duration.quick,
    animationDuration: duration.quick,
    animationFillMode: 'both',
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: lineIn,
    },
    animationTimingFunction: easing.inOut,
  },
  lineOut: {
    animationDuration: duration.quick,
    animationFillMode: 'forwards',
    animationName: lineOut,
    animationTimingFunction: easing.inOut,
    display: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'block',
    },
    pointerEvents: 'none',
  },
  // The question the answers are to, a step quieter than they are.
  question: {
    color: colors.muted,
    fontSize: {
      '@media (min-width: 640px)': 'clamp(28px, 3.6vw, 36px)',
      default: 'clamp(24px, 6.5vw, 28px)',
    },
  },
  reroll: {
    display: 'inline-flex',
  },
  // "Show another", a solid button sized for a thumb, over its countdown.
  rerollButton: {
    fontSize: font.sizeSm,
    gap: spacing.s2,
    height: 40,
    paddingInline: spacing.s4,
  },
  rerollPart: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  // The answer up and the one on its way out, in the same cell while they
  // trade places: the drawings, and the sentences beside them.
  swapArt: {
    display: 'flex',
    gridArea: '1 / 1',
    justifyContent: 'center',
    width: '100%',
  },
  swapLine: {
    gridArea: '1 / 1',
  },
  // The question, the answer and the button, at the start of their column
  // beside the drawing, and in the middle under it on a phone.
  words: {
    alignItems: {
      '@media (min-width: 640px)': 'flex-start',
      default: 'center',
    },
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
});

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function tabHidden(): boolean {
  return document.visibilityState === 'hidden';
}

function hiddenOnServer(): boolean {
  return false;
}

/** One answer to "What else?" drawn, playing while `play` is on. */
function AnswerGraphic({ answer, play }: { answer: Counted; play: boolean }) {
  const Graphic = DECK_GRAPHICS[answer.key];
  return Graphic === undefined ? null : (
    <Graphic amount={answer.amount} labels={answer.labels?.()} play={play} />
  );
}

/**
 * "What else?": the rest of what the same hours would have bought, one at a
 * time, each drawn beside its sentence like the facts around it. It starts
 * playing itself the first time it is on screen, and holds wherever it is
 * while it is off screen, while the reader's pointer or keyboard is on it,
 * while its tip is open and while the tab is put away. `style` lays it out as
 * one of the facts.
 */
export function WhatElse({ style }: { style: StyleXStyles }) {
  const deck = useRef<HTMLLIElement>(null);
  const reduced = useLessMotion();
  const seen = useInView(deck, { amount: SEEN });
  // The deck has been on screen, and its drawings play from then on.
  const started = useInView(deck, { amount: SEEN, once: true });
  const answers = heroMetrics(AVERAGE_HOURS).flatMap((metric): Array<Counted> => {
    const answer = ANSWERS[metric.key];
    return answer === undefined || TOLD.has(metric.key) || metric.amount === 0
      ? []
      : [{ ...answer, amount: metric.amount, key: metric.key }];
  });
  const [pick, setPick] = useState(answers[0]?.key ?? '');
  // The answer the last swap took away, on its way out.
  const [previous, setPrevious] = useState<string | null>(null);
  const [turns, setTurns] = useState(0);
  // The answer up has swapped in, and its drawing may play.
  const [landed, setLanded] = useState(true);
  // What holds the deck where it is: the reader's pointer or keyboard on it,
  // its tip open, the tab put away, or the deck off screen.
  const [pointing, setPointing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const hidden = useSyncExternalStore(subscribeVisibility, tabHidden, hiddenOnServer);
  // How far the answer up has stood, from 0 to 1, until the next takes its place.
  const countdown = useMotionValue(0);
  const held = pointing || focused || tipOpen || hidden || !seen;
  // The deck is playing itself with nothing holding it.
  const autoplay = started && !reduced && !held;
  // The answer up has swapped in and its drawing plays, so its countdown may run.
  const counting = started && landed && !reduced;
  // What the countdown does once it runs out: show the answer after whichever is up by then.
  const onTime = useEffectEvent(() => showNext());
  const answer = answers.find((candidate) => candidate.key === pick);
  const leaving = answers.find((candidate) => candidate.key === previous);
  // How long the answer up stands once its drawing starts: the drawing, then a hold on its end.
  const answerSeconds = (answer?.seconds ?? drawing.deck) + drawing.deckHold;

  // A new answer's drawing waits for its sentence to swap in, so it starts
  // drawing once the reader can see what it stands for.
  useEffect(() => {
    if (landed) {
      return;
    }
    const timer = setTimeout(() => setLanded(true), SWAP_MS);
    return () => clearTimeout(timer);
  }, [landed, turns]);

  // The deck plays itself: once an answer's drawing has played and stood a
  // moment on its end, the next takes its place, through all of them in
  // order and round again. The countdown runs while the drawing does, waits
  // while something holds the deck and goes on from there, and starts over
  // with each answer. With less motion nothing moves on its own.
  useEffect(() => {
    if (!counting) {
      countdown.set(0);
      return;
    }
    if (held) {
      return;
    }
    const controls = animate(countdown, 1, {
      duration: (1 - countdown.get()) * answerSeconds,
      ease: 'linear',
      onComplete: () => onTime(),
    });
    return () => controls.stop();
  }, [answerSeconds, countdown, counting, held]);

  /** The answer after the one up, in order, and the first again after the last. */
  function showNext() {
    const next =
      answers[(answers.findIndex((candidate) => candidate.key === pick) + 1) % answers.length];
    if (next === undefined || next.key === pick) {
      return;
    }
    setPrevious(pick);
    setPick(next.key);
    setTurns((turn) => turn + 1);
    setLanded(false);
    setTipOpen(false);
  }

  // The deck is held while a pointer is moved onto it, or the keyboard has
  // moved into it. A pointer left standing where the deck scrolls in under it
  // does not hold it. A finger does not hover, and a click leaves no keyboard
  // focus: both are a press, and the deck goes on after it.
  const holdsDeck = {
    onBlur: () => setFocused(false),
    onFocus: (event: FocusEvent) => setFocused(event.target.matches(':focus-visible')),
    onPointerLeave: () => setPointing(false),
    onPointerMove: (event: PointerEvent) => setPointing(event.pointerType !== 'touch'),
  };

  return (
    <li ref={deck} {...props(style)}>
      {/* The answer up is keyed by the press as well, so every press plays the
      swap again, even for an answer that has been up before. The one on its
      way out keeps the key it was up under, so it leaves as it stood, drawing
      and all, and is gone once its drawing has faded. */}
      <div {...holdsDeck} {...props(styles.answerArt)}>
        {leaving === undefined ? null : (
          <div
            aria-hidden="true"
            key={`${leaving.key}-${turns - 1}`}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget) {
                setPrevious(null);
              }
            }}
            {...props(styles.swapArt, styles.artOut)}
          >
            <AnswerGraphic answer={leaving} play={started} />
          </div>
        )}
        {answer === undefined ? null : (
          <div key={`${answer.key}-${turns}`} {...props(styles.swapArt, turns > 0 && styles.artIn)}>
            <AnswerGraphic answer={answer} play={started && landed} />
          </div>
        )}
      </div>
      <div {...holdsDeck} {...props(styles.words)}>
        <p {...props(styles.line, styles.question)}>{m.home_cost_more()}</p>
        {/* A screen reader is told of an answer only while the deck is not
        playing itself, so it is not read a new one every few seconds. */}
        <div aria-live={autoplay ? 'off' : 'polite'} {...props(styles.answerRoom)}>
          {leaving === undefined ? null : (
            <p
              aria-hidden="true"
              key={`${leaving.key}-${turns - 1}`}
              {...props(styles.line, styles.swapLine, styles.lineOut)}
            >
              <Sentence
                figures={[<Figure key="count" value={leaving.amount} />]}
                mark={null}
                text={leaving.line({ count: slot(0) })}
              />
            </p>
          )}
          {answer === undefined ? null : (
            <p
              key={`${answer.key}-${turns}`}
              {...props(styles.line, styles.swapLine, turns > 0 && styles.lineIn)}
            >
              <Sentence
                figures={[<Figure key="count" value={answer.amount} />]}
                mark={
                  <Mark label={m.home_receipt_tip_label()} onOpenChange={setTipOpen}>
                    {answer.tip()}
                  </Mark>
                }
                text={answer.line({ count: slot(0) })}
              />
            </p>
          )}
        </div>
        <div {...props(styles.rerollPart)}>
          <Button onClick={showNext} style={styles.rerollButton}>
            <motion.span
              animate={{ rotate: turns * TURN_DEGREES }}
              transition={reduced ? { duration: 0 } : { duration: TURN_SECONDS, ease: SMOOTH_OUT }}
              {...props(styles.reroll)}
            >
              <ArrowsRotate aria-hidden="true" size={ICON_SIZE} />
            </motion.span>
            {m.home_cost_reroll()}
          </Button>
          <span aria-hidden="true" {...props(styles.countdown)}>
            <motion.span {...props(styles.countdownFill)} style={{ scaleX: countdown }} />
          </span>
        </div>
      </div>
    </li>
  );
}
