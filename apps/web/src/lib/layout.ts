import { colors, font } from '@attentionawareness/ui/tokens.stylex';
import { create } from '@stylexjs/stylex';

/**
 * Shared page-shell styles. Routes compose these with registry components
 * (Card, Button, ...) instead of hand-rolling per-page style blocks.
 */
export const layout = create({
  muted: {
    color: colors.muted,
    fontSize: font.sizeSm,
    textWrap: 'pretty',
  },
  // Read by a screen reader and found by a search, never seen.
  spoken: {
    borderWidth: 0,
    clip: 'rect(0, 0, 0, 0)',
    height: '1px',
    margin: '-1px',
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: '1px',
  },
});
