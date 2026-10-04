import { MARK_PATHS, MARK_RADIUS, MARK_VIEWBOX } from '@attentionawareness/ui/brand';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

/** The height of the row it opens, not its subject. */
const SIZE = 24;

/**
 * The mark flips with the theme: a black tile and white letters on the light
 * one, a white tile and black letters on the dark one. The tile takes the
 * theme's ink and the letters its ground, so a black popup never swallows the
 * tile and it needs no edge drawn around it.
 */
const styles = create({
  letters: {
    fill: colors.bg,
  },
  mark: {
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
 * paths come out of `scripts/render-brand.ts`, the same ones the extension's
 * icons are cut from.
 */
export function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      height={SIZE}
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      width={SIZE}
      {...props(styles.mark)}
    >
      <rect height={MARK_VIEWBOX} rx={MARK_RADIUS} width={MARK_VIEWBOX} {...props(styles.tile)} />
      {MARK_PATHS.map((d) => (
        <path d={d} key={d} {...props(styles.letters)} />
      ))}
    </svg>
  );
}
