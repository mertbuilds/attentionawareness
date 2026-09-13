import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { Popover } from '@base-ui/react/popover';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';

const styles = create({
  button: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    flexShrink: 0,
    height: 16,
    justifyContent: 'center',
    padding: 0,
    width: 16,
  },
  glyph: {
    height: 10,
    width: 10,
  },
  popup: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
    boxSizing: 'border-box',
    color: colors.fg,
    fontFamily: font.family,
    fontSize: font.sizeSm,
    letterSpacing: 'normal',
    lineHeight: 1.5,
    maxWidth: 280,
    padding: spacing.s3,
    textAlign: 'start',
    textTransform: 'none',
    zIndex: 60,
  },
});

/** A small "i" beside a line, and the explanation behind it, on a click or a tap. */
export function InfoTip({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger aria-label={label} type="button" {...props(styles.button)}>
        <svg aria-hidden="true" viewBox="0 0 10 10" {...props(styles.glyph)}>
          <circle cx="5" cy="2.2" fill="currentColor" r="1" />
          <path
            d="M5 4.2v4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={6}>
          <Popover.Popup {...props(styles.popup)}>{children}</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
