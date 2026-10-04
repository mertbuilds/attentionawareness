import { MARK_PATHS, MARK_RADIUS, MARK_VIEWBOX } from '@attentionawareness/ui/brand';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

/**
 * The mark flips with the theme: a black tile and white letters on the light
 * one, as `/logo-light` draws it, and a white tile and black letters on the
 * dark one, as `/logo-dark` does. The tile takes the theme's ink and the
 * letters its ground, so it follows the theme the reader chose and not only
 * the system's, and the tile never goes missing on the page.
 */
const styles = create({
  letters: {
    fill: colors.bg,
  },
  mark: {
    // The same corner the `rx` below cuts (MARK_RADIUS of MARK_VIEWBOX), so a
    // border drawn on the element follows the tile. StyleX only takes literals
    // here, which is why it is written out.
    borderRadius: '12.5%',
    boxSizing: 'border-box',
    display: 'block',
    flexShrink: 0,
  },
  tile: {
    fill: colors.fg,
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
      <rect height={MARK_VIEWBOX} rx={MARK_RADIUS} width={MARK_VIEWBOX} {...props(styles.tile)} />
      {MARK_PATHS.map((d) => (
        <path d={d} key={d} {...props(styles.letters)} />
      ))}
    </svg>
  );
}
