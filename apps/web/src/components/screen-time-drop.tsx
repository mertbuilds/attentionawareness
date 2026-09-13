import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../lib/use-is-mobile.ts';
import { m } from '../paraglide/messages.js';

/** The one face the whole page prints numbers and machine output in. */
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const styles = create({
  caption: {
    fontFamily: MONOSPACE,
    fontSize: 13,
    margin: 0,
  },
  help: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  input: {
    display: 'none',
  },
  // The count, in the receipt's face: it is the machine reporting on itself.
  reading: {
    color: colors.muted,
    fontFamily: MONOSPACE,
    fontSize: 13,
    fontVariantNumeric: 'tabular-nums',
    margin: 0,
  },
  // The zone itself: a plain frame with a dashed inner edge, so it reads as
  // somewhere to put a file rather than as a button.
  zone: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': colors.bg,
      default: 'transparent',
    },
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'dashed',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.fg,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    font: 'inherit',
    gap: spacing.s2,
    justifyContent: 'center',
    outlineColor: colors.fg,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    paddingBlock: spacing.s4,
    paddingInline: spacing.s4,
    textAlign: 'center',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'border-color, background-color',
    width: '100%',
  },
  // A file is over the zone and about to be let go of.
  zoneOver: {
    borderColor: accent.base,
  },
  // A phone cannot drag anything, so there the zone is a plain button that
  // opens the photo picker.
  zonePlain: {
    borderStyle: 'solid',
    paddingBlock: spacing.s3,
  },
});

/**
 * Where a Screen Time screenshot goes in. A pointer drops it, drags it or
 * pastes it while the zone is under the cursor or holding focus; a finger taps
 * it and gets the photo picker, because there is nothing to drag on a phone.
 * The file never leaves the browser: the caller reads it on this device.
 */
export function ScreenTimeDrop({
  busy,
  caption,
  help,
  onFile,
  percent,
  style,
}: {
  busy: boolean;
  caption: string;
  help?: string | undefined;
  onFile: (file: File) => void;
  /** How far the read has got, or nothing while there is no count to show. */
  percent: number | null;
  style?: StyleXStyles;
}) {
  const isMobile = useIsMobile();
  const [over, setOver] = useState(false);
  const [active, setActive] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // A pasted screenshot is the fastest way in on a desktop, and it belongs to
  // whichever zone the reader is pointing at or has tabbed to.
  useEffect(() => {
    if (!active || busy) {
      return;
    }
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])].find((item) =>
        item.type.startsWith('image/'),
      );
      if (file !== undefined) {
        event.preventDefault();
        onFile(file);
      }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [active, busy, onFile]);

  function pick(file: File | undefined) {
    if (file !== undefined) {
      onFile(file);
    }
  }

  return (
    <>
      <button
        aria-label={caption}
        disabled={busy}
        onBlur={() => setActive(false)}
        onClick={() => input.current?.click()}
        onDragLeave={() => setOver(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          pick(event.dataTransfer.files[0]);
        }}
        onFocus={() => setActive(true)}
        onPointerEnter={() => setActive(true)}
        onPointerLeave={() => setActive(false)}
        type="button"
        {...props(styles.zone, isMobile && styles.zonePlain, over && styles.zoneOver, style)}
      >
        <span {...props(styles.caption)}>{caption}</span>
        {help === undefined ? null : <span {...props(styles.help)}>{help}</span>}
      </button>
      {percent === null ? null : (
        <p aria-live="polite" {...props(styles.reading)}>
          {m.gen_worst_reading({ percent })}
        </p>
      )}
      <input
        accept="image/*"
        aria-hidden="true"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          // The same file twice in a row is still a new drop.
          event.target.value = '';
        }}
        ref={input}
        tabIndex={-1}
        type="file"
        {...props(styles.input)}
      />
    </>
  );
}
