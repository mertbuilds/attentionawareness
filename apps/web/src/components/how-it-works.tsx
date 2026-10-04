import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { drawing } from '../lib/motion.stylex.ts';
import { useLessMotion } from '../lib/use-less-motion.ts';
import { useSeen } from '../lib/use-seen.ts';
import { useTabHidden } from '../lib/use-tab-hidden.ts';
import { m } from '../paraglide/messages.js';
import { BillFilters } from './bill-paper.tsx';
import { InfoTip } from './info-tip.tsx';
import { ChooseGraphic, PlugGraphic, StaysGraphic } from './steps/index.ts';

/** The turn in which every step goes back to its start, before the first plays again. */
const BACK = -1;
/** The last run of non-blank characters in a title: its last word. */
const LAST_WORD = /\S*$/u;
/**
 * The steps in their order: the drawing, how long it plays, its words, and
 * the small i after a title that needs one, read in the reader's language
 * when the step is drawn.
 */
const STEPS = [
  {
    body: m.home_how_plug_body,
    Graphic: PlugGraphic,
    key: 'plug',
    seconds: drawing.stepPlug,
    tip: { label: m.home_how_plug_tip_label, text: m.home_how_plug_tip },
    title: m.home_how_plug_title,
  },
  {
    body: m.home_how_choose_body,
    Graphic: ChooseGraphic,
    key: 'choose',
    seconds: drawing.stepChoose,
    title: m.home_how_choose_title,
  },
  {
    body: m.home_how_stays_body,
    Graphic: StaysGraphic,
    key: 'stays',
    seconds: drawing.stepStays,
    title: m.home_how_stays_title,
  },
];

const styles = create({
  // Side by side once there is room for all three, one under the other before.
  list: {
    display: 'grid',
    gap: {
      '@media (min-width: 640px)': spacing.s8,
      default: spacing.s12,
    },
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'repeat(3, minmax(0, 1fr))',
      default: 'minmax(0, 1fr)',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // The small i after a title, a breath away from the word before it.
  mark: {
    display: 'inline-flex',
    marginInlineStart: '0.3em',
    verticalAlign: 'middle',
  },
  // The i and the word before it, never split across two lines.
  markWord: {
    whiteSpace: 'nowrap',
  },
  // The step's place in the order, quieter than its title.
  number: {
    color: colors.muted,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightRegular,
    marginInlineEnd: spacing.s1,
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    textAlign: 'center',
  },
  stepBody: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'balance',
  },
  stepTitle: {
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    lineHeight: 1.4,
    marginBlock: `${spacing.s2} 0`,
    textWrap: 'balance',
  },
  // The steps clear of the card under them.
  steps: {
    paddingBlockEnd: spacing.s6,
  },
});

/**
 * The turn after `turn`, and how many seconds until it. A step on screen
 * plays to its end and one off screen gives up its turn at once. Once every
 * step on screen has played they rest, and then go back to their start.
 */
function following(
  turn: number,
  seen: ReadonlyArray<boolean>,
  seconds: ReadonlyArray<number>,
): { next: number; wait: number } {
  if (!seen.includes(true)) {
    return { next: 0, wait: 0 };
  }
  if (turn === BACK) {
    return { next: 0, wait: drawing.stepBack };
  }
  if (seen.some((on, index) => on && index >= turn)) {
    return { next: turn + 1, wait: seen[turn] === true ? (seconds[turn] ?? 0) : 0 };
  }
  return { next: BACK, wait: drawing.stepRest };
}

/**
 * Which steps play: each while it is on screen, though not before the one
 * whose turn it is has played to its end, so steps that come on screen
 * together play one after another. Once every step on screen has played they
 * stand finished for a rest, go back to their start together and play again,
 * over and over while one is on screen. A step off screen gives up its turn
 * at once, and once none is on screen the turn goes back to the first.
 */
function useInTurn(
  seen: ReadonlyArray<boolean>,
  seconds: ReadonlyArray<number>,
): ReadonlyArray<boolean> {
  // Every step before this one has had its turn.
  const [turn, setTurn] = useState(0);
  const { next, wait } = following(turn, seen, seconds);

  useEffect(() => {
    if (next === turn) {
      return;
    }
    const timer = setTimeout(() => setTurn(next), wait * 1000);
    return () => clearTimeout(timer);
  }, [next, turn, wait]);

  return seen.map((on, index) => on && index <= turn);
}

/**
 * A step's title and the small i after it, if the step has one. The i holds
 * on to the title's last word: a browser would otherwise start a line with it.
 */
function StepTitle({ mark, text }: { mark: ReactNode; text: string }) {
  const cut = text.search(LAST_WORD);
  return (
    <>
      {text.slice(0, cut)}
      <span {...props(styles.markWord)}>
        {text.slice(cut)}
        {mark === null ? null : <span {...props(styles.mark)}>{mark}</span>}
      </span>
    </>
  );
}

/**
 * How the Mac app works, in three steps, each with its drawing over its
 * title and line. A step is on screen while its drawing is, whatever of its
 * words still shows. A drawing plays as it comes on screen, steps on screen
 * together play in order, and they play again after a rest for as long as
 * they are on screen. Off screen, or with the tab put away, a step goes back
 * to its start, so it plays from there when it is back. With less motion
 * every drawing stands finished.
 */
export function HowItWorks() {
  const plug = useRef<SVGSVGElement>(null);
  const choose = useRef<SVGSVGElement>(null);
  const stays = useRef<SVGSVGElement>(null);
  const seen = [useSeen(plug), useSeen(choose), useSeen(stays)];
  const items = [plug, choose, stays];
  const hidden = useTabHidden();
  const reduced = useLessMotion();
  const playing = useInTurn(
    seen.map((on) => on && !hidden && !reduced),
    STEPS.map((step) => step.seconds),
  );

  return (
    <div {...props(styles.steps)}>
      {/* The dies the i's scrap of paper is cut and printed with. */}
      <BillFilters />
      <ol {...props(styles.list)}>
        {STEPS.map(({ Graphic, ...step }, index) => (
          <li key={step.key} {...props(styles.step)}>
            <Graphic play={playing[index] === true} ref={items[index]} />
            <h3 {...props(styles.stepTitle)}>
              <span {...props(styles.number)}>{index + 1}</span>{' '}
              <StepTitle
                mark={
                  step.tip === undefined ? null : (
                    <InfoTip label={step.tip.label()}>{step.tip.text()}</InfoTip>
                  )
                }
                text={step.title()}
              />
            </h3>
            <p {...props(styles.stepBody)}>{step.body()}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
