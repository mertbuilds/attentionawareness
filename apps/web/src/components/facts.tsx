import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useInView } from 'motion/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { SCROLL_METERS } from '../lib/attention-math.ts';
import { m } from '../paraglide/messages.js';
import { Figure, Mark, Sentence, slot } from './cost-story.tsx';
import { ThumbDistance } from './thumb-distance.tsx';
import { WhatElse } from './what-else.tsx';

/** Where Facebook's figure for a day's scroll was reported. */
const SCROLL_SOURCE_URL =
  'https://www.thedrum.com/news/creativity-meets-collaboration-marketers-find-new-ways-work-mobile-world-advertising';
/** How much of a fact has to be on screen before its drawing plays. */
const SEEN = 0.6;

/**
 * One fact: its drawing, which plays while the fact is on screen, and the
 * sentence it is told in. Another fact is one more entry in the list.
 */
type Fact = {
  art: (shown: boolean) => ReactNode;
  key: string;
  line: ReactNode;
};

const styles = create({
  art: {
    display: 'flex',
    justifyContent: 'center',
  },
  // The drawing over its sentence on a phone, and beside it once there is
  // room for both.
  fact: {
    alignItems: 'center',
    display: 'grid',
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s6,
    },
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'auto minmax(0, 1fr)',
      default: 'minmax(0, 1fr)',
    },
    textAlign: {
      '@media (min-width: 640px)': 'start',
      default: 'center',
    },
  },
  facts: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s16,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // The fact itself, a size under the story's sentences.
  line: {
    color: colors.fg,
    fontSize: {
      '@media (min-width: 640px)': 'clamp(28px, 3.6vw, 36px)',
      default: 'clamp(24px, 6.5vw, 28px)',
    },
    fontWeight: font.weightRegular,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
});

/** One fact on the list, its drawing played while it is on screen. */
function FactItem({ fact }: { fact: Fact }) {
  const item = useRef<HTMLLIElement>(null);
  const shown = useInView(item, { amount: SEEN });

  return (
    <li ref={item} {...props(styles.fact)}>
      <div {...props(styles.art)}>{fact.art(shown)}</div>
      <p {...props(styles.line)}>{fact.line}</p>
    </li>
  );
}

/**
 * Facts about the feeds that do not fit the story, one under the other, and
 * last the rest of what the same hours would have bought, one at a time.
 */
export function Facts() {
  const facts: ReadonlyArray<Fact> = [
    {
      art: (shown) => <ThumbDistance shown={shown} />,
      key: 'finger',
      line: (
        <Sentence
          figures={[<Figure key="meters" value={SCROLL_METERS} />]}
          mark={
            <Mark label={m.home_cost_source_label()}>
              <span>{m.home_facts_finger_tip()}</span>
              <a href={SCROLL_SOURCE_URL} rel="noreferrer" target="_blank">
                {m.home_facts_finger_source()}
              </a>
            </Mark>
          }
          text={m.home_facts_finger({ meters: slot(0) })}
        />
      ),
    },
  ];

  return (
    <ul {...props(styles.facts)}>
      {facts.map((fact) => (
        <FactItem fact={fact} key={fact.key} />
      ))}
      <WhatElse style={styles.fact} />
    </ul>
  );
}
