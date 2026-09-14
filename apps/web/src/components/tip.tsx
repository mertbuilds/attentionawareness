import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { Tooltip } from '@base-ui/react/tooltip';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useIsMobile } from '../lib/use-is-mobile.ts';
import { Sheet } from './sheet.tsx';

const styles = create({
  popup: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: {
      '@media (prefers-color-scheme: dark)': '0 12px 40px rgba(0, 0, 0, 0.35)',
      default: '0 12px 40px rgba(0, 0, 0, 0.12)',
    },
    boxSizing: 'border-box',
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    fontSize: font.sizeSm,
    fontWeight: font.weightRegular,
    gap: spacing.s2,
    letterSpacing: 'normal',
    lineHeight: 1.5,
    // A phone is narrower than the box, and nothing may scroll sideways.
    maxWidth: 'calc(100vw - 32px)',
    opacity: {
      ':is([data-ending-style])': 0,
      ':is([data-starting-style])': 0,
      default: 1,
    },
    padding: spacing.s3,
    textAlign: 'start',
    textTransform: 'none',
    textWrap: 'pretty',
    transform: {
      ':is([data-ending-style])': 'translateY(4px) scale(0.98)',
      ':is([data-starting-style])': 'translateY(4px) scale(0.98)',
      default: 'translateY(0) scale(1)',
    },
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'opacity, transform',
    transitionTimingFunction: 'ease-out',
    width: 260,
  },
  // The small kind: one word in a dark pill, for a button that only wants
  // its name said.
  label: {
    backgroundColor: colors.fg,
    borderRadius: 999,
    borderStyle: 'none',
    boxShadow: 'none',
    color: colors.bg,
    fontSize: 12,
    lineHeight: 1.4,
    paddingBlock: 4,
    paddingInline: 8,
    whiteSpace: 'nowrap',
    width: 'auto',
  },
  positioner: {
    zIndex: 60,
  },
  sheetText: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textTransform: 'none',
  },
  title: {
    color: colors.fg,
    fontSize: 14,
    fontWeight: font.weightMedium,
    lineHeight: 1.4,
  },
});

/**
 * Every tooltip on the site. A wide page gets Base UI's tooltip: it opens on
 * hover or focus, hangs over its trigger, and the pointer may cross into it.
 * A phone, where nothing hovers, opens a sheet on tap with the same content
 * and the same title. The trigger is the element passed in; it keeps its own
 * styling and label.
 */
export function Tip({
  children,
  content,
  mobile = 'sheet',
  side,
  style,
  title,
  trigger,
  variant = 'box',
}: {
  /** Shown on a wide page, over the trigger. */
  children: ReactNode;
  /** Shown in the sheet on a phone; defaults to the same as `children`. */
  content?: ReactNode;
  /**
   * What a phone does: open a sheet with the content on tap (the default), or
   * nothing, for a button whose tap already does its job and only wanted a
   * name on hover.
   */
  mobile?: 'none' | 'sheet';
  /** Which side of the trigger the box opens on; a label defaults to below. */
  side?: 'bottom' | 'top';
  /** Extra style for the box, when a tip needs a different width. */
  style?: StyleXStyles;
  /** Written over the box, and used as the sheet's heading. */
  title: string;
  /** The element that opens it: a button, with its own aria-label. */
  trigger: ReactElement;
  /** `label`: a one-word dark pill, no title row; the default is the box. */
  variant?: 'box' | 'label';
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile && mobile === 'none') {
    return trigger;
  }

  if (isMobile) {
    return (
      <>
        <Tooltip.Trigger onClick={() => setOpen(true)} render={trigger} />
        <Sheet onOpenChange={setOpen} open={open} title={title}>
          <div {...props(styles.sheetText)}>{content ?? children}</div>
        </Sheet>
      </>
    );
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={trigger} />
      <Tooltip.Portal>
        <Tooltip.Positioner
          side={side ?? (variant === 'label' ? 'bottom' : 'top')}
          sideOffset={variant === 'label' ? 6 : 8}
          {...props(styles.positioner)}
        >
          <Tooltip.Popup {...props(styles.popup, variant === 'label' && styles.label, style)}>
            {variant === 'label' ? title : <span {...props(styles.title)}>{title}</span>}
            {children}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
