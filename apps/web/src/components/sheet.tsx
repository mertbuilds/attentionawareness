import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { m } from '../paraglide/messages.js';

const styles = create({
  close: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    fontFamily: 'inherit',
    fontSize: 20,
    height: 32,
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
    width: 32,
  },
  content: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopStyle: 'solid',
    borderTopWidth: '1px',
    boxSizing: 'border-box',
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    insetBlockEnd: 0,
    insetInlineStart: 0,
    // Tall enough for a share card, never so tall that the page behind it is
    // gone: what does not fit scrolls inside the sheet.
    maxHeight: '90vh',
    // A one-line note still gets a sheet worth pulling up, not a sliver.
    minHeight: '28vh',
    outlineStyle: 'none',
    overflowY: 'auto',
    // 32px under the last row and nothing more.
    paddingBlockEnd: spacing.s8,
    paddingBlockStart: spacing.s4,
    paddingInline: spacing.s4,
    position: 'fixed',
    width: '100%',
    zIndex: 50,
  },
  // The grabber. It says the sheet can be thrown back down; the drag itself is
  // the whole surface's, not this bar's.
  handle: {
    backgroundColor: colors.muted,
    borderRadius: 999,
    flexShrink: 0,
    height: 4,
    marginInline: 'auto',
    width: 36,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    inset: 0,
    position: 'fixed',
    zIndex: 50,
  },
  title: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    lineHeight: 1.3,
    margin: 0,
  },
});

/**
 * The phone shape of a dialog: it comes up from the bottom edge, keeps the page
 * behind it dimmed, and goes back down on a swipe, the overlay or Escape. A
 * popover pinned to a button runs off the side of a phone and a centered modal
 * has nowhere to go, so on a narrow viewport both become this instead.
 */
export function Sheet({
  children,
  onOpenChange,
  open,
  title,
}: {
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Drawer.Root onOpenChange={onOpenChange} open={open}>
      <Drawer.Portal>
        <Drawer.Overlay {...props(styles.overlay)} />
        <Drawer.Content
          // The sheets here carry a title and no second line under it, and the
          // dialog primitive warns about the description it cannot find.
          aria-describedby={undefined}
          {...props(styles.content)}
        >
          <div aria-hidden="true" {...props(styles.handle)} />
          <div {...props(styles.header)}>
            <Drawer.Title {...props(styles.title)}>{title}</Drawer.Title>
            <Drawer.Close aria-label={m.sheet_close()} {...props(styles.close)}>
              ×
            </Drawer.Close>
          </div>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
