import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { drawing } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';
import { Mark, Sentence } from './cost-story.tsx';
import { ChooseGraphic, PlugGraphic, StaysGraphic } from './steps/index.ts';

/** How much of a step has to be on screen before its drawing plays. */
const SEEN = 0.6;
/**
 * The steps in their order: the drawing, how long it plays, its words, and
 * the small i after a line that needs one, read in the reader's language when
 * the step is drawn.
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
  // The steps clear of the cards under them.
  steps: {
    paddingBlockEnd: spacing.s6,
  },
});

/**
 * Which steps play: each while it is on screen, though not before the one
 * whose turn it is has played to its end, so steps that come on screen
 * together play one after another. A step off screen gives up its turn at
 * once, and once none is on screen the turn goes back to the first.
 */
function useInTurn(
  seen: ReadonlyArray<boolean>,
  seconds: ReadonlyArray<number>,
): ReadonlyArray<boolean> {
  // Every step before this one has had its turn.
  const [turn, setTurn] = useState(0);
  const anySeen = seen.includes(true);
  const waiting = seen.some((on, index) => on && index >= turn);
  const wait = seen[turn] === true ? (seconds[turn] ?? 0) : 0;
  const next = !anySeen ? 0 : waiting && turn < seen.length - 1 ? turn + 1 : turn;

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
 * How the Mac app works, in three steps, each with its drawing over its
 * title and line. A drawing plays as its step comes on screen, and steps on
 * screen together play in order.
 */
export function HowItWorks() {
  const plug = useRef<HTMLLIElement>(null);
  const choose = useRef<HTMLLIElement>(null);
  const stays = useRef<HTMLLIElement>(null);
  const seen = [
    useInView(plug, { amount: SEEN }),
    useInView(choose, { amount: SEEN }),
    useInView(stays, { amount: SEEN }),
  ];
  const items = [plug, choose, stays];
  const playing = useInTurn(
    seen,
    STEPS.map((step) => step.seconds),
  );

  return (
    <div {...props(styles.steps)}>
      <ol {...props(styles.list)}>
        {STEPS.map(({ Graphic, ...step }, index) => (
          <li key={step.key} ref={items[index]} {...props(styles.step)}>
            <Graphic play={playing[index] === true} />
            <h3 {...props(styles.stepTitle)}>
              <span {...props(styles.number)}>{index + 1}</span> {step.title()}
            </h3>
            <p {...props(styles.stepBody)}>
              <Sentence
                figures={[]}
                mark={
                  step.tip === undefined ? null : (
                    <Mark label={step.tip.label()}>{step.tip.text()}</Mark>
                  )
                }
                text={step.body()}
              />
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
