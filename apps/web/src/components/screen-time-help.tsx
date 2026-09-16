import { colors, font, palette, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';
import { Tip } from './tip.tsx';

/**
 * The popover hangs a few pixels under its button, so the pointer crosses bare
 * page on its way in. This is how long that trip is allowed to take: an
 * unhurried hand takes longer than a quick one, and the trip itself is bridged
 * by the popovers, so the wait can be generous.
 */
/**
 * The clip that shows where the real number lives, one recording per locale.
 * The video wins when the reader's locale has one, English stands in when it
 * does not, the gif is the fallback under that, and with none of them the
 * popover holds its placeholder. The gif widens to `string` so the branches
 * keep type-checking whichever one carries a url.
 */
const SCREEN_TIME_VIDEO_URLS: Record<string, string> = {
  en: '/media/screentime-en.mp4',
  tr: '/media/screentime-tr.mp4',
};
const SCREEN_TIME_GIF_URL: string = '';

const styles = create({
  // The clip is what the box is for: 200px of it, plus the 12px of padding
  // on each side. The words wrap to that, rather than the box widening.
  helpBox: {
    width: 280,
  },
  // A line of muted text under the phone, underlined, the way a link is.
  helpButton: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':focus-visible': colors.fg,
      ':hover': colors.fg,
      default: 'inherit',
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    padding: 0,
    textDecorationLine: 'underline',
    textUnderlineOffset: 3,
  },
  // What the slot says while it waits for a clip to be shot.
  helpClip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    height: '100%',
    justifyContent: 'center',
    textAlign: 'center',
    width: '100%',
  },
  helpMedia: {
    display: 'block',
    height: '100%',
    objectFit: 'cover',
    width: '100%',
  },
  // Hangs under the button, aligned to its left edge. It sits inside a heading,
  // so it takes back the type the heading set.
  // Given the whole width of a sheet, the clip takes as much of it as it was
  // shot at and no more.
  helpSheetSlot: {
    alignSelf: 'center',
    maxWidth: 320,
    width: '100%',
  },
  // The clip is shot on a phone, so the slot it fills is portrait. Black
  // stands behind it in both themes, the way a player letterboxes.
  helpSlot: {
    alignSelf: 'center',
    aspectRatio: '720 / 1120',
    backgroundColor: palette.black,
    borderRadius: 12,
    display: 'flex',
    // Twice the box's own gap between the path and the clip.
    marginBlockStart: spacing.s2,
    overflow: 'hidden',
    width: 256,
  },
  helpText: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    // Narrow box, and a path like a setting name has nowhere to break.
    overflowWrap: 'anywhere',
    textWrap: 'pretty',
  },
  // Under the phone, centred, and the anchor the popover opens from.
  helpWrap: {
    display: 'inline',
    position: 'relative',
  },
});

/** The screen-time recording the reader's locale is shot in. */
function screenTimeVideoUrl(): string {
  return SCREEN_TIME_VIDEO_URLS[getLocale()] ?? SCREEN_TIME_VIDEO_URLS.en ?? '';
}

/**
 * The recording of Screen Time being opened, in the slot it was shot for. The
 * video wins where the reader's locale has one, the gif stands in under it,
 * and with neither the slot holds the placeholder.
 */
function ScreenTimeClip({ style, videoUrl }: { style?: StyleXStyles; videoUrl: string }) {
  return (
    <span {...props(styles.helpSlot, style)}>
      {videoUrl === '' ? (
        SCREEN_TIME_GIF_URL === '' ? (
          <span {...props(styles.helpClip)}>{m.home_math_help_clip()}</span>
        ) : (
          <img
            alt={m.home_math_help_body()}
            src={SCREEN_TIME_GIF_URL}
            {...props(styles.helpMedia)}
          />
        )
      ) : (
        <video
          autoPlay
          // A new locale is a new recording, so the element starts over.
          key={videoUrl}
          loop
          muted
          playsInline
          preload="metadata"
          src={videoUrl}
          {...props(styles.helpMedia)}
        />
      )}
    </span>
  );
}

/**
 * The line under the phone: where the reader's own number lives, and a clip
 * of it being found.
 */
export function ScreenTimeHelp({ label }: { label: string }) {
  const videoUrl = screenTimeVideoUrl();
  return (
    <span {...props(styles.helpWrap)}>
      <Tip
        content={
          <>
            <span {...props(styles.helpText)}>{m.home_math_help_body()}</span>
            <ScreenTimeClip style={styles.helpSheetSlot} videoUrl={videoUrl} />
          </>
        }
        style={styles.helpBox}
        title={m.home_math_help_title()}
        trigger={
          <button aria-label={m.home_math_help_label()} type="button" {...props(styles.helpButton)}>
            {label}
          </button>
        }
      >
        <span {...props(styles.helpText)}>{m.home_math_help_body()}</span>
        <ScreenTimeClip videoUrl={videoUrl} />
      </Tip>
    </span>
  );
}
