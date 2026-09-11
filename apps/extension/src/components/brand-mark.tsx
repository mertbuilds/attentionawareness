import { MARK_PATHS, MARK_RADIUS, MARK_VIEWBOX } from '@attentionawareness/ui/brand';
import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

/** Black tile, white letters. The mark is the mark in either theme. */
const BACKGROUND = '#000000';
const LETTERS = '#ffffff';
/** The height of the row it opens, not its subject. */
const SIZE = 24;

const styles = create({
  mark: {
    // A black tile on a black popup is a hole in it. The hairline is the edge
    // of the tile, and only the dark ground needs one drawn.
    borderColor: {
      '@media (prefers-color-scheme: dark)': colors.border,
      default: 'transparent',
    },
    // The same corner the `rx` below cuts (MARK_RADIUS of MARK_VIEWBOX), so the
    // border follows the tile. StyleX only takes literals here, which is why it
    // is written out.
    borderRadius: '12.5%',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'block',
    flexShrink: 0,
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
      <rect fill={BACKGROUND} height={MARK_VIEWBOX} rx={MARK_RADIUS} width={MARK_VIEWBOX} />
      {MARK_PATHS.map((d) => (
        <path d={d} fill={LETTERS} key={d} />
      ))}
    </svg>
  );
}
