import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, props } from '@stylexjs/stylex';
import { useInView } from 'motion/react';
import { useRef } from 'react';
import { blur, distance, duration, easing } from '../lib/motion.stylex.ts';
import { m } from '../paraglide/messages.js';
import { Sentence } from './cost-story.tsx';

/** How much of the sentence has to be on screen before it rises into place. */
const SEEN = 0.6;

const styles = create({
  // One line of the two, out of focus and a step low until the sentence is
  // on screen. With less motion it stands where it is from the start.
  line: {
    display: 'block',
    filter: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: `blur(${blur.medium})`,
    },
    opacity: {
      '@media (prefers-reduced-motion: reduce)': 1,
      default: 0,
    },
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: `translateY(${distance.medium})`,
    },
    transitionDuration: duration.verySlow,
    transitionProperty: 'opacity, transform, filter',
    transitionTimingFunction: easing.inOut,
  },
  lineOn: {
    filter: 'none',
    opacity: 1,
    transform: 'none',
  },
  // The second line rises once the first has, so the two are read apart.
  lineSecond: {
    transitionDelay: duration.verySlow,
  },
  // The sentence the page turns on, a screen of its own between the cost and
  // the way out. Wider than the column on a wide screen, so each line stays
  // one line.
  title: {
    alignSelf: 'stretch',
    color: colors.fg,
    fontSize: {
      '@media (min-width: 640px)': 'clamp(40px, 5vw, 64px)',
      default: 'clamp(32px, 9vw, 40px)',
    },
    fontWeight: font.weightRegular,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
    margin: 0,
    marginInline: `min(0px, 50% - min(8.5em, 50vw - ${spacing.s4}))`,
    textAlign: 'center',
    textWrap: 'balance',
  },
  turn: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: firstThatWorks('80svh', '80vh'),
  },
});

/**
 * The turn from the cost to the way out: it is not the reader, it is the
 * apps. It rises into place the first time it is on screen.
 */
export function Turn() {
  const title = useRef<HTMLHeadingElement>(null);
  const seen = useInView(title, { amount: SEEN, once: true });

  return (
    <section {...props(styles.turn)}>
      <h2 ref={title} {...props(styles.title)}>
        <span {...props(styles.line, seen && styles.lineOn)}>{m.home_turn_willpower()}</span>
        <span {...props(styles.line, styles.lineSecond, seen && styles.lineOn)}>
          <Sentence figures={[]} mark={null} text={m.home_turn_built()} />
        </span>
      </h2>
    </section>
  );
}
