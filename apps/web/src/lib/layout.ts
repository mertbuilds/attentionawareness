import { colors, font, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create } from '@stylexjs/stylex';

/**
 * Shared page-shell styles. Routes compose these with registry components
 * (Card, Button, ...) instead of hand-rolling per-page style blocks.
 */
export const layout = create({
  centered: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: spacing.s4,
    justifyContent: 'center',
    marginInline: 'auto',
    maxWidth: 400,
    minHeight: '100vh',
    paddingInline: spacing.s4,
  },
  formColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    width: '100%',
  },
  fullWidth: {
    width: '100%',
  },
  muted: {
    color: colors.muted,
    fontSize: font.sizeSm,
    textWrap: 'pretty',
  },
});
