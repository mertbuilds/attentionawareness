import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { Tooltip } from '@base-ui/react/tooltip';
import { create, props } from '@stylexjs/stylex';
import { cloneElement, lazy, Suspense, useState } from 'react';
import type { ComponentProps, FC, MouseEvent, ReactElement, ReactNode } from 'react';
import { duration, easing, scale } from '../lib/motion.stylex.ts';
import { useIsMobile } from '../lib/use-is-mobile.ts';
import { paperRoot, PaperSheet } from './bill-paper.tsx';
import type { Sheet as SheetComponent } from './sheet.tsx';

/**
 * A tooltip appears a beat after it is asked for and goes at once: this long,
 * the tooltip's own close, quicker than any step of the motion scale.
 */
const CLOSE_MS = 50;

/**
 * The sheet is a phone's alone, so its code (and the drawer it is built on)
 * is fetched only on a phone, once the page knows it is one. A chunk that
 * does not load leaves the trigger without a sheet.
 */
const Sheet = lazy((): Promise<{ default: FC<ComponentProps<typeof SheetComponent>> }> =>
  import('./sheet.tsx').then(
    (sheet) => ({ default: sheet.Sheet }),
    () => ({ default: () => null }),
  ),
);

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
      ':is([data-ending-style])': `scale(${scale.small})`,
      ':is([data-starting-style])': `scale(${scale.small})`,
      default: 'none',
    },
    // It grows from the side it opens on, toward its trigger.
    transformOrigin: 'var(--transform-origin)',
    transitionDelay: {
      ':is([data-ending-style])': '0ms',
      default: duration.micro,
    },
    transitionDuration: {
      ':is([data-ending-style])': `${CLOSE_MS}ms`,
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: duration.quick,
    },
    transitionProperty: 'opacity, transform',
    transitionTimingFunction: easing.out,
    width: 260,
  },
  // A note torn off the bill: the box gives up its own face, and the scrap of
  // paper under the words draws the edge instead.
  popupPaper: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderStyle: 'none',
    borderWidth: 0,
    boxShadow: 'none',
  },
  // What is written on the scrap, in the column the box would have laid out.
  popupInk: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  positioner: {
    zIndex: 60,
  },
  // A column, so a clip inside can centre itself under the words.
  sheetText: {
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s3,
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
  paper = false,
  title,
  trigger,
}: {
  /** Shown over the trigger on a wide page, and in the sheet on a phone. */
  children: ReactNode;
  /**
   * Drawn as a scrap of the bill's own paper rather than as a box: a torn
   * edge, the grain, and the ink pressed into it. The sheet on a phone is
   * untouched by it.
   */
  paper?: boolean;
  /** Written over the box, and used as the sheet's heading. */
  title: string;
  /** The element that opens it: a button, with its own aria-label. */
  trigger: ReactElement<{ onClick?: (event: MouseEvent) => void }>;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        {/* No tooltip root on a phone, so the trigger opens the sheet itself. */}
        {cloneElement(trigger, {
          onClick: (event: MouseEvent) => {
            trigger.props.onClick?.(event);
            setOpen(true);
          },
        })}
        <Suspense fallback={null}>
          <Sheet onOpenChange={setOpen} open={open} title={title}>
            <div {...props(styles.sheetText)}>{children}</div>
          </Sheet>
        </Suspense>
      </>
    );
  }

  // What the box says, whether it is drawn as a box or as a scrap of paper.
  const written = (
    <>
      <span {...props(styles.title)}>{title}</span>
      {children}
    </>
  );

  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={trigger} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={8} {...props(styles.positioner)}>
          <Tooltip.Popup {...props(styles.popup, paper && styles.popupPaper, paper && paperRoot)}>
            {paper ? <PaperSheet style={styles.popupInk}>{written}</PaperSheet> : written}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
