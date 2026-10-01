import { Button } from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { animate, motion, useInView, useMotionValue } from 'motion/react';
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import type { FocusEvent, PointerEvent, ReactNode } from 'react';
import { ArrowsRotate } from 'reicon-react';
import {
  AVERAGE_HOURS,
  heroMetrics,
  HOURS_PER_SKILL,
  SCROLL_METERS,
} from '../lib/attention-math.ts';
import { blur, distance, drawing, duration, easing } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { Figure, Mark, Sentence, slot, useLessMotion } from './cost-story.tsx';
import { HEIGHT, WIDTH } from './deck/box.ts';
import { DECK_GRAPHICS } from './deck/index.ts';
import type { SkillLabels } from './deck/skills.tsx';
import { THUMB_SECONDS, ThumbDistance } from './thumb-distance.tsx';

/** Where Facebook's figure for a day's scroll was reported. */
const SCROLL_SOURCE_URL =
  'https://www.thedrum.com/news/creativity-meets-collaboration-marketers-find-new-ways-work-mobile-world-advertising';
/** How much of the deck has to be on screen before it plays. */
const SEEN = 0.6;
/** `easing.smoothOut`, the curve things move into place on, as motion takes a curve. */
const SMOOTH_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/**
 * A fact's sentence goes out and the next comes in after it, a quick swap
 * each, and the next drawing waits for it to land.
 */
const SWAP_MS = 2 * Number.parseFloat(duration.quick);
/** The reroll icon turns half a turn a fact. */
const TURN_DEGREES = 180;
const TURN_SECONDS = 0.7;
const ICON_SIZE = 16;
/** The figures the story tells on its own, so the deck never offers them. */
const TOLD = new Set(['earth']);
/**
 * The drawing box's shape, the one every answer's drawing is drawn in. StyleX
 * reads no constant from another module, so it is set on the element.
 */
const ART_RATIO = `${WIDTH} / ${HEIGHT}`;

/**
 * What the hours would have bought instead: the sentence it is told in, how
 * it is counted, how long its drawing plays if not the usual time, and the
 * words drawn on it, if any.
 */
type Bought = {
  labels?: () => SkillLabels;
  line: (inputs: { count: string }) => string;
  seconds?: number;
  tip: () => string;
};

/**
 * One fact in the deck: its drawing, which plays while `play` is on, its
 * figure and the sentence it is told in, the small i and what it says, and
 * how long the drawing plays and then stands on its end.
 */
type Fact = {
  art: (play: boolean) => ReactNode;
  hold: number;
  key: string;
  label: string;
  seconds: number;
  text: string;
  tip: ReactNode;
  value: number;
};

const BOUGHT: Record<string, Bought> = {
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
 * A new fact takes the old one's place the way any text swaps: the old
 * sentence goes up a hair and out of focus, then the new one comes up into
 * its place. The drawings cross over each other meanwhile.
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
  // The drawing's box, the same for every fact so nothing around it moves
  // while one trades places with the next: as wide as the column, and no
  // wider than a drawing is drawn. The one on its way out stands in the same
  // cell while the next comes in.
  art: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gridTemplateRows: 'minmax(0, 1fr)',
    justifySelf: 'center',
    maxWidth: 400,
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
  // The time left before the next fact takes this one's place: a hairline
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
  // The drawing beside the words and the button, both in the middle of the
  // row, once there is room for both; on a phone the drawing over the words
  // and the button under them.
  deck: {
    alignItems: 'center',
    display: 'grid',
    gap: {
      '@media (min-width: 768px)': spacing.s12,
      default: spacing.s6,
    },
    gridTemplateColumns: {
      '@media (min-width: 768px)': 'minmax(0, 1fr) minmax(0, 1fr)',
      default: 'minmax(0, 1fr)',
    },
    textAlign: {
      '@media (min-width: 768px)': 'start',
      default: 'center',
    },
  },
  // A fact, a size under the story's sentences.
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
  // The sentence's own room, three lines tall, so the button under it stays
  // put while one fact trades places with the next.
  room: {
    alignItems: 'center',
    display: 'grid',
    fontSize: {
      '@media (min-width: 640px)': 'clamp(28px, 3.6vw, 36px)',
      default: 'clamp(24px, 6.5vw, 28px)',
    },
    justifyItems: {
      '@media (min-width: 768px)': 'start',
      default: 'center',
    },
    minHeight: '3.6em',
    width: '100%',
  },
  // The fact up and the one on its way out, in the same cell while they
  // trade places: the drawings, and the sentences beside them.
  swapArt: {
    alignItems: 'center',
    display: 'flex',
    gridArea: '1 / 1',
    justifyContent: 'center',
    minHeight: 0,
    minWidth: 0,
  },
  swapLine: {
    gridArea: '1 / 1',
  },
  // The sentence and the button, at the start of their column beside the
  // drawing, and in the middle under it on a phone.
  words: {
    alignItems: {
      '@media (min-width: 768px)': 'flex-start',
      default: 'center',
    },
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
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

/**
 * Facts about the feeds that do not fit the story, one at a time, each drawn
 * beside its sentence: first how far a finger scrolls in a day, then the rest
 * of what the same hours would have bought. It starts playing itself the
 * first time it is on screen, and holds wherever it is while it is off
 * screen, while the reader's pointer or keyboard is on it, while its tip is
 * open and while the tab is put away.
 */
export function Facts() {
  const deck = useRef<HTMLDivElement>(null);
  const reduced = useLessMotion();
  const seen = useInView(deck, { amount: SEEN });
  // The deck has been on screen, and its drawings play from then on.
  const started = useInView(deck, { amount: SEEN, once: true });
  const facts: ReadonlyArray<Fact> = [
    {
      art: (play) => <ThumbDistance play={play} />,
      hold: drawing.thumbHold,
      key: 'finger',
      label: m.home_cost_source_label(),
      seconds: THUMB_SECONDS,
      text: m.home_facts_finger({ meters: slot(0) }),
      tip: (
        <>
          <span>{m.home_facts_finger_tip()}</span>
          <a href={SCROLL_SOURCE_URL} rel="noreferrer" target="_blank">
            {m.home_facts_finger_source()}
          </a>
        </>
      ),
      value: SCROLL_METERS,
    },
    ...heroMetrics(AVERAGE_HOURS).flatMap((metric): Array<Fact> => {
      const bought = BOUGHT[metric.key];
      const Graphic = DECK_GRAPHICS[metric.key];
      return bought === undefined ||
        Graphic === undefined ||
        TOLD.has(metric.key) ||
        metric.amount === 0
        ? []
        : [
            {
              art: (play) => (
                <Graphic amount={metric.amount} labels={bought.labels?.()} play={play} />
              ),
              hold: drawing.deckHold,
              key: metric.key,
              label: m.home_receipt_tip_label(),
              seconds: bought.seconds ?? drawing.deck,
              text: bought.line({ count: slot(0) }),
              tip: bought.tip(),
              value: metric.amount,
            },
          ];
    }),
  ];
  const [pick, setPick] = useState(facts[0]?.key ?? '');
  // The fact the last swap took away, on its way out.
  const [previous, setPrevious] = useState<string | null>(null);
  const [turns, setTurns] = useState(0);
  // The fact up has swapped in, and its drawing may play.
  const [landed, setLanded] = useState(true);
  // What holds the deck where it is: the reader's pointer or keyboard on it,
  // its tip open, the tab put away, or the deck off screen.
  const [pointing, setPointing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const hidden = useSyncExternalStore(subscribeVisibility, tabHidden, hiddenOnServer);
  // How far the fact up has stood, from 0 to 1, until the next takes its place.
  const countdown = useMotionValue(0);
  const held = pointing || focused || tipOpen || hidden || !seen;
  // The deck is playing itself with nothing holding it.
  const autoplay = started && !reduced && !held;
  // The fact up has swapped in and its drawing plays, so its countdown may run.
  const counting = started && landed && !reduced;
  /** The fact after the one up, in order, and the first again after the last. */
  function showNext() {
    const next = facts[(facts.findIndex((candidate) => candidate.key === pick) + 1) % facts.length];
    if (next === undefined || next.key === pick) {
      return;
    }
    setPrevious(pick);
    setPick(next.key);
    setTurns((turn) => turn + 1);
    setLanded(false);
    setTipOpen(false);
  }

  // What the countdown does once it runs out: show the fact after whichever is up by then.
  const onTime = useEffectEvent(() => showNext());
  const fact = facts.find((candidate) => candidate.key === pick);
  const leaving = facts.find((candidate) => candidate.key === previous);
  // How long the fact up stands once its drawing starts: the drawing, then a hold on its end.
  const factSeconds = fact === undefined ? 0 : fact.seconds + fact.hold;

  // A new fact's drawing waits for its sentence to swap in, so it starts
  // drawing once the reader can see what it stands for.
  useEffect(() => {
    if (landed) {
      return;
    }
    const timer = setTimeout(() => setLanded(true), SWAP_MS);
    return () => clearTimeout(timer);
  }, [landed, turns]);

  // The deck plays itself: once a fact's drawing has played and stood a
  // moment on its end, the next takes its place, through all of them in
  // order and round again. The countdown runs while the drawing does, waits
  // while something holds the deck and goes on from there, and starts over
  // with each fact. With less motion nothing moves on its own.
  useEffect(() => {
    if (!counting) {
      countdown.set(0);
      return;
    }
    if (held) {
      return;
    }
    const controls = animate(countdown, 1, {
      duration: (1 - countdown.get()) * factSeconds,
      ease: 'linear',
      onComplete: () => onTime(),
    });
    return () => controls.stop();
  }, [countdown, counting, factSeconds, held]);

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
    <div ref={deck} {...props(styles.deck)}>
      {/* The fact up is keyed by the press as well, so every press plays the
      swap again, even for a fact that has been up before. The one on its way
      out keeps the key it was up under, so it leaves as it stood, drawing and
      all, and is gone once its drawing has faded. */}
      <div {...holdsDeck} style={{ aspectRatio: ART_RATIO }} {...props(styles.art)}>
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
            {leaving.art(started)}
          </div>
        )}
        {fact === undefined ? null : (
          <div key={`${fact.key}-${turns}`} {...props(styles.swapArt, turns > 0 && styles.artIn)}>
            {fact.art(started && landed)}
          </div>
        )}
      </div>
      <div {...holdsDeck} {...props(styles.words)}>
        {/* A screen reader is told of a fact only while the deck is not
        playing itself, so it is not read a new one every few seconds. */}
        <div aria-live={autoplay ? 'off' : 'polite'} {...props(styles.room)}>
          {leaving === undefined ? null : (
            <p
              aria-hidden="true"
              key={`${leaving.key}-${turns - 1}`}
              {...props(styles.line, styles.swapLine, styles.lineOut)}
            >
              <Sentence
                figures={[<Figure key="count" value={leaving.value} />]}
                mark={null}
                text={leaving.text}
              />
            </p>
          )}
          {fact === undefined ? null : (
            <p
              key={`${fact.key}-${turns}`}
              {...props(styles.line, styles.swapLine, turns > 0 && styles.lineIn)}
            >
              <Sentence
                figures={[<Figure key="count" value={fact.value} />]}
                mark={
                  <Mark label={fact.label} onOpenChange={setTipOpen}>
                    {fact.tip}
                  </Mark>
                }
                text={fact.text}
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
    </div>
  );
}
