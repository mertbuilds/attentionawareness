import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { wip } from '../lib/wip.stylex.ts';
import { m } from '../paraglide/messages.js';
import { BrandMark } from './brand-mark.tsx';

const MARK_SIZE = 24;

const styles = create({
  link: {
    alignItems: 'center',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    display: 'inline-flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    gap: spacing.s2,
    insetBlockStart: `calc(${spacing.s4} + ${wip.height})`,
    insetInlineStart: spacing.s4,
    position: 'fixed',
    textDecorationLine: 'none',
    textTransform: 'lowercase',
    zIndex: 30,
  },
});

/** The name, top left on every page, and the way home. */
export function SiteBrand() {
  return (
    <a data-plain="" href="/" {...props(styles.link)}>
      <BrandMark size={MARK_SIZE} />
      {m.site_name()}
    </a>
  );
}
