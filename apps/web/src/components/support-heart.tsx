import { accent } from '@attentionawareness/ui/accent.stylex';
import { create, props, when } from '@stylexjs/stylex';
import { Heart } from 'reicon-react';
import { duration, easing } from '../lib/motion.stylex.ts';

const styles = create({
  box: {
    color: accent.base,
    display: 'flex',
    flexShrink: 0,
    position: 'relative',
  },
  // The heart filled in, over its outline, while what it marks is pointed at
  // or pressed. A tap leaves nothing behind: hover counts only where a
  // pointer can hover.
  filled: {
    inset: 0,
    opacity: {
      default: 0,
      [when.ancestor(':active')]: 1,
      [when.ancestor(':hover')]: {
        '@media (hover: hover)': 1,
        default: null,
      },
    },
    position: 'absolute',
    transitionDuration: duration.quick,
    transitionProperty: 'opacity',
    transitionTimingFunction: easing.out,
  },
});

/**
 * The orange heart that marks Support wherever the header and its menu show
 * it: a line drawing that fills in while its link or button is pointed at or
 * pressed. That link or button carries `defaultMarker()`.
 */
export function SupportHeart({ size, stroke }: { size: number; stroke: number }) {
  return (
    <span aria-hidden="true" {...props(styles.box)}>
      <Heart size={size} strokeWidth={stroke} />
      <Heart size={size} strokeWidth={stroke} weight="Filled" {...props(styles.filled)} />
    </span>
  );
}
