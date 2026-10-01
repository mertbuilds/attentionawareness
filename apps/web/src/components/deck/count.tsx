import { accent } from '@attentionawareness/ui/accent.stylex';
import { create, props } from '@stylexjs/stylex';
import { motion } from 'motion/react';
import type { MotionValue } from 'motion/react';
import type { ReactNode } from 'react';

/** Every drawing's own box, four by three. */
export const WIDTH = 320;
export const HEIGHT = 240;
/**
 * Where every drawing keeps its count: centred under it, on this line. What
 * is drawn stays above `ART_BOTTOM`, so the count always has the same air.
 */
export const COUNT_Y = 224;
export const ART_BOTTOM = 204;

const styles = create({
  // The count, in the figures' orange and in even figures, so it does not
  // shake as it climbs.
  count: {
    fill: accent.base,
    fontSize: 20,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.02em',
  },
});

/**
 * A drawing's count, the same in every drawing: centred under it unless it is
 * placed, the way the skills place one after each track.
 */
export function DeckCount({
  anchor = 'middle',
  children,
  opacity,
  x = WIDTH / 2,
  y = COUNT_Y,
}: {
  anchor?: 'end' | 'middle';
  children: MotionValue<string> | ReactNode;
  opacity?: MotionValue<number> | number;
  x?: number;
  y?: number;
}) {
  return (
    <motion.text
      dominantBaseline="central"
      textAnchor={anchor}
      x={x}
      y={y}
      {...props(styles.count)}
      style={opacity === undefined ? {} : { opacity }}
    >
      {children}
    </motion.text>
  );
}
