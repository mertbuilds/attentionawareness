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
});
