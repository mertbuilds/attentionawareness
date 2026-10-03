import { MARK_PATHS, MARK_RADIUS, MARK_VIEWBOX } from '@attentionawareness/ui/brand';
import { create, props } from '@stylexjs/stylex';

/** Black tile, white letters. The mark is the mark in either theme. */
const BACKGROUND = '#000000';
const LETTERS = '#ffffff';

const styles = create({
  mark: {
    // The same corner the `rx` below cuts (MARK_RADIUS of MARK_VIEWBOX), so a
    // border drawn on the element follows the tile. StyleX only takes literals
    // here, which is why it is written out.
    borderRadius: '12.5%',
    boxSizing: 'border-box',
    display: 'block',
    flexShrink: 0,
  },
});

/**
 * The "aa" mark, as outlines. The letters are Suisse Intl, and Suisse Intl is
 * licensed, so they travel as the shapes they draw and never as type: the
 * paths come out of `scripts/render-brand.ts`, the same ones the favicon is
 * cut from.
 */
export function BrandMark({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      width={size}
      {...props(styles.mark)}
    >
      <rect fill={BACKGROUND} height={MARK_VIEWBOX} rx={MARK_RADIUS} width={MARK_VIEWBOX} />
      {MARK_PATHS.map((d) => (
        <path d={d} fill={LETTERS} key={d} />
      ))}
    </svg>
  );
}
