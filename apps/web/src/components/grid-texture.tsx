import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, firstThatWorks, props } from '@stylexjs/stylex';

/** The hairline the graph paper is ruled in. Faint enough to read as paper. */
const LINE = `color-mix(in srgb, ${colors.fg} 8%, transparent)`;
/** One square of the grid, the same 40px the share card is ruled at. */
const SQUARE = '40px 40px';
/** Solid under the hero, gone before it reaches an edge or the first section. */
const MASK = 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)';

const styles = create({
  grid: {
    backgroundImage: `linear-gradient(${LINE} 1px, transparent 1px), linear-gradient(90deg, ${LINE} 1px, transparent 1px)`,
    backgroundSize: SQUARE,
    // The first screen and no further. `svh` so a phone's collapsing toolbar
    // does not resize the ruling under the reader's thumb.
    height: firstThatWorks('100svh', '100vh'),
    // The page's own edges, not the viewport's: `100vw` would count the
    // scrollbar and push the page sideways.
    insetBlockStart: 0,
    insetInlineEnd: 0,
    insetInlineStart: 0,
    maskImage: MASK,
    pointerEvents: 'none',
    position: 'absolute',
    WebkitMaskImage: MASK,
    // Under everything the page draws, over the page's own background: the
    // page root isolates, so this stays inside it.
    zIndex: -1,
  },
});

/**
 * The share card's graph paper, in the page's own colours, behind the first
 * screen of a page. It is a background and nothing else: out of flow, unclickable
 * and unreadable, so it moves nothing on the page it sits behind. It goes first
 * inside a page root that is `position: relative` and `isolation: isolate`.
 */
export function GridTexture() {
  return <div aria-hidden="true" {...props(styles.grid)} />;
}
