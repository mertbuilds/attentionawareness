import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Label,
  Skeleton,
} from '@attentionawareness/ui';
import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, palette, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AppArtwork, artworkStyles } from '../components/app-artwork.tsx';
import type { MetaCache } from '../components/app-artwork.tsx';
import { AppIconFan, fanStyles } from '../components/app-icon-fan.tsx';
import { GridTexture } from '../components/grid-texture.tsx';
import { ShareCard } from '../components/share-card.tsx';
import { Sheet } from '../components/sheet.tsx';
import { SiteFooter } from '../components/site-footer.tsx';
import type { AppResult } from '../lib/app-search.ts';
import {
  defaultStorefront,
  flagEmoji,
  lookupApps,
  searchApps,
  shortAppName,
  storefrontLabel,
  storefronts,
} from '../lib/app-search.ts';
import { formatYears, ledgerItems } from '../lib/attention-math.ts';
import { controls } from '../lib/controls.ts';
import { layout } from '../lib/layout.ts';
import { buildProfile, presets } from '../lib/profile/index.ts';
import type { BlockedApp, ProfileConfig } from '../lib/profile/index.ts';
import { decodeShare } from '../lib/share.ts';
import { normalizeUrl, sitesForApp, sitesForApps } from '../lib/sites.ts';
import { playTick, primeTickSound, unlockTickSound } from '../lib/tick-sound.ts';
import { useIsMobile } from '../lib/use-is-mobile.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';

export const Route = createFileRoute('/')({
  component: Generator,
});

/**
 * The one display size on the page. Only the hero lines and the years the
 * habit costs are set in it; every other heading is one step down.
 */
const DISPLAY_SIZE = 'clamp(32px, 3.8vw, 44px)';
/** The air between two sections, wider than anything inside one. */
const SECTION_GAP = 96;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 10;
const SKELETON_ROWS = [0, 1, 2];
const FALLBACK_COUNTRY = 'us';
const SUPERVISE_URL = '/supervise';
/** The ids the two labelled site lists name their add field with. */
const PERMITTED_INPUT_ID = 'permitted-urls';
const ALLOWED_INPUT_ID = 'allowed-urls';
const READING_SPEED_URL = 'https://doi.org/10.1016/j.jml.2019.104047';
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
const PROFILE_MIME = 'application/x-apple-aspen-config';
/** The signer. The key is the founder's and never leaves the server. */
const SIGN_URL = '/api/sign';
/** The server names the profile, so every download saves under one name. */
const PROFILE_FILENAME = 'attentionawareness.mobileconfig';
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** How long an armed Remove waits for its second click before standing down. */
const REMOVE_CONFIRM_MS = 3000;
/**
 * The popover hangs a few pixels under its button, so the pointer crosses bare
 * page on its way in. This is how long that trip is allowed to take.
 */
const HELP_GRACE_MS = 120;
/**
 * The armed control is tracked by id, and the reset link needs one too. A colon
 * is not legal in a bundle id, so this can never collide with an app's row.
 */
const RESET_ARMED = 'reset:apps';
/** A chip names a host; the scheme carries nothing the user needs to read. */
const SITE_SCHEME = /^https?:\/\//u;
/**
 * Every iOS browser carries "Safari" in its user agent, because they all run
 * WebKit; only its own token says which one is in front. Safari is the one
 * that hands the profile straight to Settings, so the rest are named here.
 */
const BORROWED_SAFARI = ['CriOS', 'FxiOS', 'EdgiOS'];
/** How much of the profile the preview draws before it starts counting. */
const PREVIEW_APPS = 12;
const PREVIEW_SITES = 6;
/** How many apps one site row names before the rest are left implied. */
const ROW_APPS = 3;
/** What the screen-time slider offers, in hours a day. */
const HOURS_MIN = 1;
const HOURS_MAX = 12;
const HOURS_STEP = 1;
const HOURS_DEFAULT = 2;
/** The machined knob, and the rail the ticks are measured against. */
const KNOB_WIDTH = 28;
const KNOB_HEIGHT = 44;
const TRACK_HEIGHT = 4;
/**
 * The knob's face: a fine horizontal grain over the falloff of a turned edge,
 * and a darker falloff for the moment it is held down. Fixed greys, because a
 * machined part is the same part in either theme.
 */
const KNOB_BRUSH =
  'repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 3px)';
const KNOB_FALLOFF = 'linear-gradient(180deg, #e8e8ea 0%, #c9c9cd 45%, #a9a9ae 55%, #d6d6da 100%)';
const KNOB_FALLOFF_PRESSED =
  'linear-gradient(180deg, #d8d8dc 0%, #b9b9bf 45%, #999aa0 55%, #c6c6cc 100%)';
/**
 * The edges of that face: a lit top, a shaded bottom, and the rim around both.
 * The rim is listed last so the two 1px lines stay on top of it.
 */
const KNOB_EDGES =
  'inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 -1px 0 rgba(0, 0, 0, 0.25), inset 0 0 0 1px #6b6b70';
/** The knob standing off the rail, and the same knob pressed into it. */
const KNOB_SHADOW = `${KNOB_EDGES}, 0 2px 6px rgba(0, 0, 0, 0.35)`;
const KNOB_SHADOW_PRESSED = `${KNOB_EDGES}, 0 1px 2px rgba(0, 0, 0, 0.35)`;
/** The indicator cut into the middle of the face: 2px across, 18px tall. */
const KNOB_NOTCH_SIZE = '2px 18px';
/**
 * One detent per whole hour of travel, each with the fraction of the rail it
 * sits at. The knob only ever stops on these, so the marks are the truth.
 */
const TICKS = Array.from({ length: (HOURS_MAX - HOURS_MIN) / HOURS_STEP + 1 }, (_, index) => {
  const value = HOURS_MIN + index * HOURS_STEP;
  return {
    at: (value - HOURS_MIN) / (HOURS_MAX - HOURS_MIN),
    value,
  };
});

type WebMode = ProfileConfig['webFilter']['mode'];

/** A site the user typed themselves, and whether it is switched on. */
type CustomSite = { enabled: boolean; url: string };

/**
 * One line of the website box. A derived row names the apps that brought it,
 * so the row can show their icons; a custom row knows where it sits in the
 * user's own list, because that is the only way to edit or drop it.
 */
type SiteRow =
  | { apps: Array<BlockedApp>; enabled: boolean; kind: 'derived'; url: string }
  | { enabled: boolean; index: number; kind: 'custom'; url: string };

/** The popover rises the last few pixels into place under its button. */
const helpEnter = keyframes({
  from: { opacity: 0, transform: 'translateY(-4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

/** A new line of the bill rises into place. Lines that are paid off just go. */
const ledgerEnter = keyframes({
  from: { opacity: 0, transform: 'translateY(6px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

/** The results drop in from just under the bar; they never animate out. */
const resultsEnter = keyframes({
  from: { opacity: 0, transform: 'translateY(4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const styles = create({
  appGrid: {
    display: 'grid',
    gap: spacing.s3,
    gridTemplateColumns: {
      '@media (min-width: 640px)': '1fr 1fr',
      default: '1fr',
    },
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  appName: {
    overflowWrap: 'anywhere',
  },
  appRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    minWidth: 0,
  },
  appText: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: spacing.s1,
    minWidth: 0,
  },
  banner: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    maxWidth: 760,
    paddingBlock: spacing.s2,
    paddingInline: spacing.s4,
    textWrap: 'pretty',
    width: '100%',
  },
  bannerDismiss: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 18,
    lineHeight: 1,
    marginInlineStart: 'auto',
    padding: 0,
  },
  // The one colour on the page, and it is a loss, never a score. The number is
  // set in even figures so dragging the dial moves nothing in the sentence but
  // the digits themselves.
  burn: {
    color: accent.base,
    fontVariantNumeric: 'tabular-nums',
  },
  choice: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  clearButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.base,
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
    fontSize: 18,
    height: 28,
    justifyContent: 'center',
    lineHeight: 1,
    marginInlineEnd: 6,
    padding: 0,
    width: 28,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    // Nothing is drawn between the sections any more, so the gap carries the
    // rhythm on its own at every width.
    gap: SECTION_GAP,
    maxWidth: 760,
    width: '100%',
  },
  // Three equal columns of one number and the word under it; on a phone they
  // stack, so a tile is never narrower than the value it holds.
  dealGrid: {
    display: 'grid',
    gap: spacing.s6,
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'repeat(3, 1fr)',
      default: '1fr',
    },
  },
  dealLabel: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.4,
    margin: 0,
    textWrap: 'pretty',
  },
  dealTile: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  dealValue: {
    color: colors.fg,
    fontSize: 40,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    margin: 0,
  },
  defDesc: {
    color: colors.muted,
    lineHeight: 1.5,
    marginBlockEnd: spacing.s3,
    marginInlineStart: 0,
    textWrap: 'pretty',
  },
  defList: {
    margin: 0,
  },
  defTerm: {
    fontWeight: font.weightMedium,
    lineHeight: 1.5,
    textWrap: 'pretty',
  },
  // The control: rail and detents across the row, the speaker at the end of
  // it. The number the dial reads is in the sentence under it.
  dial: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s4,
    width: '100%',
  },
  dialRail: {
    flexBasis: 240,
    flexGrow: 1,
    minWidth: 0,
  },
  // The sentence under the fan headline: the reason, not the claim.
  fanBody: {
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '60ch',
    textWrap: 'pretty',
  },
  // The helper sentence, folded into a ring the question can be asked from.
  helpButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: {
      ':focus-visible': colors.fg,
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: font.weightRegular,
    height: 20,
    justifyContent: 'center',
    letterSpacing: 'normal',
    lineHeight: 1,
    padding: 0,
    width: 20,
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
  helpPopover: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    animationName: helpEnter,
    animationTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      '@media (prefers-color-scheme: dark)': '0 12px 40px rgba(0, 0, 0, 0.35)',
      default: '0 12px 40px rgba(0, 0, 0, 0.12)',
    },
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    fontWeight: font.weightRegular,
    gap: spacing.s2,
    insetBlockStart: 'calc(100% + 8px)',
    insetInlineStart: 0,
    letterSpacing: 'normal',
    // A phone is narrower than the box, and nothing on the page may scroll
    // sideways.
    maxWidth: 'calc(100vw - 32px)',
    padding: spacing.s3,
    position: 'absolute',
    textAlign: 'start',
    // The clip is what the box is for: 200px of it, plus the 12px of padding
    // on each side. The words wrap to that, rather than the box widening.
    width: 224,
    zIndex: 20,
  },
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
    overflow: 'hidden',
    width: 200,
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
  helpTitle: {
    fontSize: 14,
    fontWeight: font.weightMedium,
    lineHeight: 1.4,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  // Rides at the end of the question, and anchors the popover under it.
  helpWrap: {
    display: 'inline-flex',
    marginInlineStart: spacing.s2,
    position: 'relative',
    verticalAlign: 'middle',
  },
  // Same column as `content`, so the hero and every section share a left edge.
  hero: {
    maxWidth: 760,
    width: '100%',
  },
  heroTitle: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: DISPLAY_SIZE,
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    margin: 0,
    textWrap: 'balance',
  },
  // The page's one caption: the small line that names the group under it.
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: font.weightMedium,
    letterSpacing: '0.08em',
    lineHeight: 1.4,
    margin: 0,
    textTransform: 'uppercase',
  },
  ledger: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  // A line arrives when the day earns it; it leaves the moment it stops
  // applying, because an exit would soften what it says.
  ledgerItem: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '220ms',
    },
    animationName: ledgerEnter,
    animationTimingFunction: 'ease-out',
    color: colors.muted,
    fontSize: font.sizeMd,
    lineHeight: 1.5,
    textWrap: 'pretty',
  },
  // The arithmetic behind the bill, small enough to stay out of its way.
  ledgerNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  // The count leads its line, so it is the one thing in the bill that is not
  // muted: colour and a step of size carry it, nothing else.
  ledgerNumber: {
    color: accent.base,
    fontSize: 18,
    fontWeight: font.weightMedium,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  mathResult: {
    fontSize: DISPLAY_SIZE,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    margin: 0,
    textWrap: 'balance',
  },
  // A disclosure with no box of its own: the summary is one more muted line
  // in the section until it is opened.
  moreBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    paddingBlockStart: spacing.s3,
  },
  // Closed it points right; open it points down, and a reader who asked for
  // less motion gets the turn without the sweep.
  moreChevron: {
    display: 'block',
    height: 12,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'transform',
    width: 12,
  },
  moreChevronOpen: {
    transform: 'rotate(90deg)',
  },
  // The svg chevron is the only marker: anything but `list-item` drops the
  // browser's own, and Safari's is hidden in app.css.
  moreSummary: {
    alignItems: 'center',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'flex',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    listStyleType: 'none',
    width: 'fit-content',
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: SECTION_GAP,
    // The stacking context that keeps the grid layer above the page's own
    // background instead of behind it.
    isolation: 'isolate',
    minHeight: '100vh',
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s12,
    },
    paddingInline: spacing.s4,
    // The containing block the grid layer measures itself against.
    position: 'relative',
  },
  playGlyph: {
    display: 'block',
    height: 28,
    width: 28,
  },
  // The profile as a picture of itself: the icons it hides, the hosts it
  // turns away, and the two switches that need a supervised phone.
  preview: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  previewApps: {
    alignItems: 'center',
    columnGap: spacing.s3,
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: spacing.s2,
  },
  previewArtwork: {
    borderRadius: 7,
    height: 28,
    width: 28,
  },
  previewChip: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.muted,
    fontFamily: MONOSPACE,
    fontSize: 12,
    lineHeight: 1.4,
    paddingBlock: 2,
    paddingInline: spacing.s2,
  },
  previewChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  previewFan: {
    alignItems: 'center',
    display: 'flex',
  },
  // The whole list, written out under the pill that counts it. Long lists
  // scroll inside the box instead of running off the card.
  previewList: {
    display: 'flex',
    flexDirection: 'column',
    fontFamily: MONOSPACE,
    fontSize: 12,
    gap: spacing.s1,
    lineHeight: 1.5,
    maxHeight: 280,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  previewMore: {
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.muted,
    fontSize: 12,
    lineHeight: 1.4,
    marginInlineStart: spacing.s2,
    paddingBlock: 2,
    paddingInline: spacing.s2,
  },
  // The icons read as one stack, so each one steps over the last.
  // The pill is a button; the pill styles it, so this only undoes the chrome
  // a button brings with it.
  previewMoreButton: {
    backgroundColor: 'transparent',
    boxShadow: {
      ':focus-visible': `0 0 0 3px ${colors.muted}`,
      default: null,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    margin: 0,
    outlineStyle: 'none',
  },
  previewMoreWrap: {
    display: 'inline-flex',
    position: 'relative',
  },
  previewOverlap: {
    marginInlineStart: -8,
  },
  previewPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  // Sits straight under the pill, with no gap to cross: the pointer moving
  // from one to the other never leaves the pair.
  previewPopover: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    animationName: helpEnter,
    animationTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    // The same corner as the chips it counts.
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      '@media (prefers-color-scheme: dark)': '0 12px 40px rgba(0, 0, 0, 0.35)',
      default: '0 12px 40px rgba(0, 0, 0, 0.12)',
    },
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    maxWidth: 'calc(100vw - 32px)',
    padding: spacing.s3,
    position: 'fixed',
    textAlign: 'start',
    width: 240,
    // Over everything the page draws. The sheets and dialogs that sit higher
    // are never open at the same time as this.
    zIndex: 1000,
  },
  // The profile card clips what overflows it, so this is portalled onto the
  // body and placed against the viewport instead of against the pill.
  previewPopoverAt: (top: number, left: number) => ({
    insetBlockStart: top,
    insetInlineStart: left,
  }),
  previewPopoverTitle: {
    color: colors.fg,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    lineHeight: 1.3,
  },
  previewSites: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  proofGrid: {
    display: 'grid',
    gap: spacing.s3,
    gridTemplateColumns: {
      '@media (min-width: 640px)': 'repeat(3, 1fr)',
      default: '1fr',
    },
  },
  quiet: {
    color: colors.muted,
  },
  // The one destructive colour on the page: it means "this click deletes".
  removeArmed: {
    color: {
      ':hover': colors.error,
      default: colors.error,
    },
    fontWeight: font.weightMedium,
    minWidth: 48,
  },
  // Bigger than the button's own type. The box keeps its size; only the glyph grows.
  removeGlyph: {
    fontSize: '1.12rem',
    lineHeight: 1,
  },
  removeIdle: {
    minWidth: 48,
  },
  resetArmed: {
    color: {
      ':hover': colors.error,
      default: colors.error,
    },
    fontWeight: font.weightMedium,
  },
  // Sits in the subtitle sentence, so it takes the paragraph's own type.
  resetLink: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    padding: 0,
    textDecorationLine: 'underline',
  },
  resultArtwork: {
    borderRadius: 9,
    height: 40,
    width: 40,
  },
  // Hangs off the bar instead of pushing the grid down, so the page under it
  // never moves while the user types.
  resultsPanel: {
    animationDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    animationName: resultsEnter,
    animationTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      '@media (prefers-color-scheme: dark)': '0 12px 40px rgba(0, 0, 0, 0.35)',
      default: '0 12px 40px rgba(0, 0, 0, 0.12)',
    },
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    insetBlockStart: 'calc(100% + 6px)',
    insetInlineStart: 0,
    maxHeight: 360,
    overflowY: 'auto',
    padding: spacing.s3,
    position: 'absolute',
    width: '100%',
    zIndex: 10,
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  // One pill around the country control, the field and the clear button, so
  // the three read as a single input and the ring belongs to all of them.
  searchBar: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: {
      ':focus-within': colors.fg,
      default: colors.border,
    },
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      ':focus-within': `0 0 0 3px ${colors.border}`,
      default: 'none',
    },
    boxSizing: 'border-box',
    display: 'flex',
    height: 40,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'border-color, box-shadow',
    width: '100%',
  },
  searchDivider: {
    backgroundColor: colors.border,
    flexShrink: 0,
    height: '60%',
    width: 1,
  },
  // The bar owns the border and the ring, so the field itself carries neither.
  searchField: {
    borderRadius: 0,
    borderStyle: 'none',
    borderWidth: 0,
    boxShadow: {
      ':focus-visible': 'none',
      default: 'none',
    },
    flexGrow: 1,
    flexShrink: 1,
    height: '100%',
    minWidth: 0,
    paddingInline: spacing.s3,
    width: 'auto',
  },
  // Anchors the results dropdown to the bar above it.
  searchWrap: {
    position: 'relative',
    width: '100%',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  shareDialog: {
    maxWidth: {
      '@media (min-width: 640px)': 560,
      default: 'calc(100% - 2rem)',
    },
  },
  // The × that arms and drops a row, and the + that adds one.
  siteAction: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'inherit',
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
  },
  siteActionArmed: {
    color: {
      ':hover': colors.error,
      default: colors.error,
    },
    fontSize: 12,
  },
  // The last row carries no checkbox, so its field starts where the others do.
  siteAdd: {
    marginInlineStart: 24,
  },
  siteAppArtwork: {
    borderRadius: radius.base,
    height: 16,
    width: 16,
  },
  siteAppOverlap: {
    marginInlineStart: -6,
  },
  siteApps: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
  },
  // One field, drawn as one box: the rows inside it carry no borders of
  // their own beyond the hairline that separates them.
  siteBox: {
    backgroundColor: colors.bg,
    // The fields inside are borderless and show no outline of their own, so
    // the box is what says which row the keyboard is in.
    borderColor: {
      ':focus-within': colors.fg,
      default: colors.border,
    },
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'border-color',
  },
  // A derived host is read-only: it belongs to the app that brought it.
  siteHost: {
    flexGrow: 1,
    fontFamily: MONOSPACE,
    fontSize: 13,
    fontWeight: font.weightRegular,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  siteHostInput: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    flexGrow: 1,
    fontFamily: MONOSPACE,
    fontSize: 13,
    minWidth: 0,
    outlineStyle: 'none',
    padding: 0,
  },
  // Unticked means the site is out of the filter, so it steps back.
  // Unticked: still listed, and struck through because it is not going into
  // the profile.
  siteHostOff: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  siteHostOn: {
    color: colors.fg,
  },
  siteRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
    height: 36,
    paddingInline: spacing.s3,
  },
  siteRowDivided: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: '1px',
  },
  skeletonRow: {
    height: 40,
    width: '100%',
  },
  // The native input, dressed as a machined dial. The browser keeps the
  // keyboard, the detents and the screen reader; it gives up only its looks.
  slider: {
    // Brushed aluminium: the grain and the falloff under it, with the orange
    // indicator cut into the middle as a layer of its own. Firefox's knob and
    // Chrome's are the same part, so they read from the same constants.
    '::-moz-range-thumb': {
      backgroundImage: {
        ':active': `linear-gradient(${accent.base}, ${accent.base}), ${KNOB_BRUSH}, ${KNOB_FALLOFF_PRESSED}`,
        default: `linear-gradient(${accent.base}, ${accent.base}), ${KNOB_BRUSH}, ${KNOB_FALLOFF}`,
      },
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${KNOB_NOTCH_SIZE}, auto, auto`,
      borderRadius: 6,
      borderStyle: 'none',
      borderWidth: 0,
      boxShadow: {
        ':active': KNOB_SHADOW_PRESSED,
        default: KNOB_SHADOW,
      },
      height: KNOB_HEIGHT,
      width: KNOB_WIDTH,
    },
    '::-moz-range-track': {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: TRACK_HEIGHT,
    },
    '::-webkit-slider-runnable-track': {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: TRACK_HEIGHT,
    },
    // The same face, plus the offset that sits it on the track.
    '::-webkit-slider-thumb': {
      appearance: 'none',
      backgroundImage: {
        ':active': `linear-gradient(${accent.base}, ${accent.base}), ${KNOB_BRUSH}, ${KNOB_FALLOFF_PRESSED}`,
        default: `linear-gradient(${accent.base}, ${accent.base}), ${KNOB_BRUSH}, ${KNOB_FALLOFF}`,
      },
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${KNOB_NOTCH_SIZE}, auto, auto`,
      borderRadius: 6,
      boxShadow: {
        ':active': KNOB_SHADOW_PRESSED,
        default: KNOB_SHADOW,
      },
      height: KNOB_HEIGHT,
      // Centres the knob on the track: (4 - 44) / 2.
      marginTop: -20,
      scale: {
        ':active': 1.03,
        ':hover': 1.03,
        default: 1,
      },
      transitionDuration: {
        '@media (prefers-reduced-motion: reduce)': '0ms',
        default: '150ms',
      },
      transitionProperty: 'scale',
      transitionTimingFunction: 'ease-out',
      width: KNOB_WIDTH,
    },
    appearance: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'block',
    height: KNOB_HEIGHT,
    margin: 0,
    minWidth: 0,
    padding: 0,
    width: '100%',
  },
  // The travelled part of the rail, so the dial reads its own setting. The
  // stop always falls under the knob, which is what hides the seam.
  sliderFill: (percent: number) => ({
    '::-moz-range-track': {
      backgroundImage: `linear-gradient(to right, ${accent.base} 0 ${percent}%, ${colors.border} ${percent}% 100%)`,
    },
    '::-webkit-slider-runnable-track': {
      backgroundImage: `linear-gradient(to right, ${accent.base} 0 ${percent}%, ${colors.border} ${percent}% 100%)`,
    },
  }),
  sliderLabel: {
    display: 'block',
    width: '100%',
  },
  // The speaker is a hint, not a headline: it only colours up on hover.
  soundButton: {
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
    height: 40,
    justifyContent: 'center',
    padding: 0,
    width: 40,
  },
  soundGlyph: {
    display: 'block',
    height: 18,
    width: 18,
  },
  srOnly: {
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
  stepBody: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  stepGrid: {
    display: 'grid',
    gap: spacing.s3,
    gridTemplateColumns: {
      '@media (min-width: 640px)': '1fr 1fr',
      default: '1fr',
    },
  },
  // The small caption and the title it names, as one block over a step.
  stepHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  stepLink: {
    display: 'inline-block',
    marginBlockStart: spacing.s2,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s1,
    margin: 0,
    paddingInlineStart: spacing.s4,
  },
  storefrontButton: {
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
    fontFamily: 'inherit',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    height: '100%',
    lineHeight: 1,
    minWidth: 0,
    paddingBlock: 0,
    paddingInline: spacing.s4,
    whiteSpace: 'nowrap',
  },
  // Narrower and shorter than a page input: it lives inside a popover.
  storefrontFilter: {
    borderRadius: radius.base,
    fontSize: font.sizeSm,
    height: 32,
    paddingInline: spacing.s2,
  },
  storefrontFlag: {
    fontSize: 16,
    lineHeight: 1,
  },
  storefrontList: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      '@media (prefers-color-scheme: dark)': '0 12px 40px rgba(0, 0, 0, 0.35)',
      default: '0 12px 40px rgba(0, 0, 0, 0.12)',
    },
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    insetBlockStart: 'calc(100% + 6px)',
    insetInlineStart: 0,
    minWidth: 220,
    padding: spacing.s1,
    position: 'absolute',
    // Over the results dropdown, which hangs off the same bar.
    zIndex: 20,
  },
  // Anchors the country list directly under the control it belongs to. The cap
  // belongs here and not on the button: a percentage on the button would
  // resolve against this wrapper, which is itself only as wide as the button,
  // so it would halve the control instead of measuring it against the bar. The
  // field never takes width from the country name, only a name long enough to
  // pass 40% of the bar gives way, and then the label ellipsizes.
  storefrontMenu: {
    alignSelf: 'stretch',
    display: 'flex',
    flexShrink: 0,
    maxWidth: '40%',
    position: 'relative',
  },
  storefrontOption: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': colors.border,
      default: 'transparent',
    },
    borderRadius: radius.base,
    borderStyle: 'none',
    borderWidth: 0,
    color: colors.fg,
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    paddingBlock: spacing.s1,
    paddingInline: spacing.s2,
    textAlign: 'start',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  storefrontOptionSelected: {
    fontWeight: font.weightMedium,
  },
  // 175 storefronts do not fit on a screen, so only the options scroll.
  storefrontOptions: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 320,
    overflowY: 'auto',
  },
  tick: {
    backgroundColor: colors.muted,
    height: 9,
    insetBlockStart: 0,
    position: 'absolute',
    transform: 'translateX(-50%)',
    width: 1,
  },
  // The knob's centre travels between the two ends of the rail, not between
  // the two ends of the box, so the marks are measured the same way.
  tickAt: (at: number) => ({
    insetInlineStart: `calc(${KNOB_WIDTH / 2}px + (100% - ${KNOB_WIDTH}px) * ${at})`,
  }),
  tickNumber: {
    color: colors.muted,
    fontFamily: MONOSPACE,
    fontSize: 10,
    insetBlockStart: 12,
    insetInlineStart: '50%',
    lineHeight: 1,
    position: 'absolute',
    transform: 'translateX(-50%)',
  },
  // Under the track, one mark per detent: the reader can see where the knob
  // will stop before they let go of it.
  tickRail: {
    height: 26,
    position: 'relative',
    width: '100%',
  },
  tileArtwork: {
    borderRadius: 11,
    height: 48,
    width: 48,
  },
  truncate: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Reserved space for the walkthrough clip, which is not shot yet.
  video: {
    alignItems: 'center',
    aspectRatio: '16 / 9',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'dashed',
    borderWidth: '1px',
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    justifyContent: 'center',
    maxWidth: '100%',
    width: '100%',
  },
});

/** A site as a chip names it: `https://youtu.be` is youtu.be. */
function siteLabel(url: string): string {
  return url.replace(SITE_SCHEME, '');
}

/**
 * A derived row is its url; a custom row is its place in the user's list, plus
 * the url, so committing an edit remounts the field on the new value.
 */
function rowKey(row: SiteRow): string {
  return row.kind === 'derived' ? `derived:${row.url}` : `custom:${row.index}:${row.url}`;
}

/**
 * What the deny list actually blocks: every site the blocked apps imply, minus
 * the ones the user unticked or deleted, then the switched-on urls of their
 * own. Listed once each, in that order.
 */
function deniedUrlsOf(
  apps: ReadonlyArray<BlockedApp>,
  customSites: ReadonlyArray<CustomSite>,
  excludedSites: ReadonlyArray<string>,
  removedSites: ReadonlyArray<string>,
): Array<string> {
  const off = new Set([...excludedSites, ...removedSites]);
  const urls = new Set(sitesForApps(apps).filter((site) => !off.has(site)));
  for (const site of customSites) {
    const url = site.enabled ? normalizeUrl(site.url) : '';
    if (url !== '') {
      urls.add(url);
    }
  }
  return [...urls];
}

/**
 * The config as the builder reads it. `deniedUrls` is derived, so the config
 * carries no editable copy of it: this is where the derivation lands, right
 * before the profile is built, downloaded or stored.
 */
function withDerivedSites(
  config: ProfileConfig,
  customSites: ReadonlyArray<CustomSite>,
  excludedSites: ReadonlyArray<string>,
  removedSites: ReadonlyArray<string>,
  excludedEntries: ReadonlyArray<string>,
): ProfileConfig {
  const filter = config.webFilter;
  const off = new Set(excludedEntries);
  if (filter.mode === 'allow') {
    return {
      ...config,
      webFilter: { ...filter, allowedUrls: filter.allowedUrls.filter((url) => !off.has(url)) },
    };
  }
  if (filter.mode !== 'deny') {
    return config;
  }
  return {
    ...config,
    webFilter: {
      ...filter,
      deniedUrls: deniedUrlsOf(config.blockedApps, customSites, excludedSites, removedSites),
      permittedUrls: filter.permittedUrls.filter((url) => !off.has(url)),
    },
  };
}

/**
 * Whether a detent may click. Reduced motion silences the default, because a
 * click is one more thing happening at the reader; a reader who turned the
 * speaker on themselves has answered that question already.
 */
function tickAllowed(on: boolean, chosen: boolean): boolean {
  if (!on) {
    return false;
  }
  if (chosen) {
    return true;
  }
  const query = (globalThis as { matchMedia?: (media: string) => MediaQueryList }).matchMedia;
  return query === undefined || !query('(prefers-reduced-motion: reduce)').matches;
}

/**
 * What the signer is given: the reader's choices, and nothing else. The
 * identifier, the name and the organization are the server's to write, so no
 * two downloads can collide. The removal lock travels, because trial mode is
 * the reader's call.
 */
function signPayload(
  config: ProfileConfig,
): Omit<ProfileConfig, 'displayName' | 'identifier' | 'organization'> {
  return {
    allowAppStore: config.allowAppStore,
    allowPrivateBrowsing: config.allowPrivateBrowsing,
    autoFilterAdult: config.autoFilterAdult,
    blockedApps: config.blockedApps,
    lockRemoval: config.lockRemoval,
    webFilter: config.webFilter,
  };
}

/** The reason the signer gave, or the muted stand-in when it gave none. */
async function signFailureOf(response: Response): Promise<string> {
  if (response.status !== 400) {
    return m.gen_sign_unavailable();
  }
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : m.gen_sign_unavailable();
  } catch {
    return m.gen_sign_unavailable();
  }
}

/** The browser's own storefront, but only if the picker offers it. */
function initialStorefront(): string {
  const code = defaultStorefront();
  return storefronts.some((storefront) => storefront.code === code) ? code : FALLBACK_COUNTRY;
}

/** The exceptions the recommended deny list is handed with it. */
const PRESET_PERMITTED: ReadonlyArray<string> =
  presets.mert.webFilter.mode === 'deny' ? presets.mert.webFilter.permittedUrls : [];

/** The names the recommended list already knows, keyed by bundle id. */
const PRESET_NAMES: Record<string, string> = Object.fromEntries(
  presets.mert.blockedApps.map((app) => [app.bundleId, app.name]),
);

/**
 * One app out of a shared link. A link carries bundle ids and nothing else, so
 * a name the recommended list does not know falls back to the last label of
 * the id, which reads well enough until the App Store lookup lands.
 */
function sharedApp(bundleId: string): BlockedApp {
  return { bundleId, name: PRESET_NAMES[bundleId] ?? bundleId.split('.').at(-1) ?? bundleId };
}

/**
 * Every requested id is recorded, found or not: caching a miss as `null` is
 * what keeps a storefront without that app from being looked up on every
 * render.
 */
function mergeMeta(
  current: MetaCache,
  requested: ReadonlyArray<string>,
  found: ReadonlyArray<AppResult>,
): MetaCache {
  const next: MetaCache = { ...current };
  for (const bundleId of requested) {
    next[bundleId] = null;
  }
  for (const app of found) {
    next[app.bundleId] = { developer: app.developer, iconUrl: app.iconUrl };
  }
  return next;
}

/**
 * `buildProfile` IS the identifier validator: it throws on anything that is not
 * reverse-domain, so a null build is exactly the state the inline error shows.
 */
function safeBuild(config: ProfileConfig): string | null {
  try {
    return buildProfile(config);
  } catch {
    return null;
  }
}

/** The screen-time recording the reader's locale is shot in. */
function screenTimeVideoUrl(): string {
  return SCREEN_TIME_VIDEO_URLS[getLocale()] ?? SCREEN_TIME_VIDEO_URLS.en ?? '';
}

/** Safari, as the browser itself reports it. */
function readIsSafari(): boolean {
  const agent = navigator.userAgent;
  return agent.includes('Safari') && !BORROWED_SAFARI.some((name) => agent.includes(name));
}

/** The user agent cannot change under the page, so nothing ever notifies. */
const subscribeToNothing = () => () => {};

/** What the server knows about the browser in front of the page: nothing. */
const notSafariOnServer = () => false;

/**
 * Whether the page is open in Safari itself. The server has no user agent, so
 * it answers `false` there and renders that same answer while hydrating —
 * which is what keeps hydration quiet — and React takes the real one after.
 */
function useIsSafari(): boolean {
  return useSyncExternalStore(subscribeToNothing, readIsSafari, notSafariOnServer);
}

/**
 * The shortest way in from where the page is open. Safari on the phone hands
 * the download straight to Settings; another iOS browser drops it in Files
 * first; a desktop has to get the file to the phone at all.
 */
function installSteps(isMobile: boolean, isSafari: boolean): Array<string> {
  if (!isMobile) {
    return [m.gen_install_desktop_1(), m.gen_install_desktop_2(), m.gen_install_desktop_3()];
  }
  if (isSafari) {
    return [m.gen_install_safari_1(), m.gen_install_safari_2()];
  }
  return [m.gen_install_other_1(), m.gen_install_other_2(), m.gen_install_other_3()];
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
 * The question mark at the end of the question. On a wide page hover, focus or
 * a tap opens a popover that says where the real number lives and shows it
 * being found; a pointer that leaves gets a moment to reach the popover before
 * it closes, because the two do not touch. A phone has no room for a box
 * hanging off a button, so there the same question opens a sheet.
 */
function ScreenTimeHelp() {
  const videoUrl = screenTimeVideoUrl();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const grace = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A grace period that outlives the popover must not fire into nothing.
  useEffect(
    () => () => {
      if (grace.current !== null) {
        clearTimeout(grace.current);
      }
    },
    [],
  );

  // Dismissed from outside itself: a pointer anywhere else, or Escape. The
  // sheet answers both on its own, so this is the popover's alone.
  useEffect(() => {
    if (!open || isMobile) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (wrap.current?.contains(event.target as Node | null) !== true) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMobile, open]);

  function clearGrace() {
    if (grace.current !== null) {
      clearTimeout(grace.current);
      grace.current = null;
    }
  }

  function show() {
    clearGrace();
    setOpen(true);
  }

  function hide() {
    clearGrace();
    setOpen(false);
  }

  function hideAfterGrace() {
    clearGrace();
    grace.current = setTimeout(() => setOpen(false), HELP_GRACE_MS);
  }

  return (
    <span
      onPointerEnter={(event) => {
        if (!isMobile && event.pointerType !== 'touch') {
          show();
        }
      }}
      onPointerLeave={(event) => {
        if (!isMobile && event.pointerType !== 'touch') {
          hideAfterGrace();
        }
      }}
      ref={wrap}
      {...props(styles.helpWrap)}
    >
      <button
        aria-describedby={open && !isMobile ? popoverId : undefined}
        aria-label={m.home_math_help_label()}
        // The sheet takes the focus with it, and a blur that closes it would
        // shut it on the way in.
        onBlur={isMobile ? undefined : hide}
        onClick={show}
        onFocus={isMobile ? undefined : show}
        type="button"
        {...props(styles.helpButton)}
      >
        ?
      </button>
      {isMobile ? (
        <Sheet onOpenChange={setOpen} open={open} title={m.home_math_help_title()}>
          <span {...props(styles.helpText)}>{m.home_math_help_body()}</span>
          <ScreenTimeClip style={styles.helpSheetSlot} videoUrl={videoUrl} />
        </Sheet>
      ) : open ? (
        <span id={popoverId} role="tooltip" {...props(styles.helpPopover)}>
          <span {...props(styles.helpTitle)}>{m.home_math_help_title()}</span>
          <span {...props(styles.helpText)}>{m.home_math_help_body()}</span>
          <ScreenTimeClip videoUrl={videoUrl} />
        </span>
      ) : null}
    </span>
  );
}

/**
 * The "+N" at the end of a preview row, and the only place the rest of that
 * row is written out. A pointer or the keyboard opens the list under the pill;
 * a phone, where a box hanging off a pill has nowhere to go, opens a sheet.
 */
function PreviewMore({
  items,
  label,
  style,
  title,
}: {
  items: ReadonlyArray<string>;
  label: string;
  style: StyleXStyles;
  title: string;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  // Where the pill is, in the viewport. The popover is portalled out of the
  // card, so this is the only thing that ties the two together.
  const [at, setAt] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const listId = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const grace = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A grace period that outlives the popover must not fire into nothing.
  useEffect(
    () => () => {
      if (grace.current !== null) {
        clearTimeout(grace.current);
      }
    },
    [],
  );

  // Dismissed from outside itself: a pointer anywhere else, or Escape. The
  // sheet answers both on its own, so this is the popover's alone.
  useEffect(() => {
    if (!open || isMobile) {
      return;
    }
    function place() {
      const box = wrap.current?.getBoundingClientRect();
      if (box !== undefined) {
        setAt({ left: box.left, top: box.bottom });
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (wrap.current?.contains(event.target as Node | null) !== true) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    place();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // `true`: the page scrolls in the window, but a list inside a box does not.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [isMobile, open]);

  function show() {
    if (grace.current !== null) {
      clearTimeout(grace.current);
      grace.current = null;
    }
    setOpen(true);
  }

  // The popover is not a child of the pill any more, so crossing into it
  // leaves the pill. The grace period is what carries the pointer across.
  function hideAfterGrace() {
    if (grace.current !== null) {
      clearTimeout(grace.current);
    }
    grace.current = setTimeout(() => setOpen(false), HELP_GRACE_MS);
  }

  const list = (
    <span {...props(styles.previewList)}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </span>
  );

  return (
    <span
      onPointerEnter={(event) => {
        if (!isMobile && event.pointerType !== 'touch') {
          show();
        }
      }}
      onPointerLeave={(event) => {
        if (!isMobile && event.pointerType !== 'touch') {
          hideAfterGrace();
        }
      }}
      ref={wrap}
      {...props(styles.previewMoreWrap)}
    >
      <button
        aria-describedby={open && !isMobile ? listId : undefined}
        aria-expanded={open}
        // The sheet takes the focus with it, and a blur that closes it would
        // shut it on the way in.
        onBlur={isMobile ? undefined : () => setOpen(false)}
        onClick={show}
        onFocus={isMobile ? undefined : show}
        type="button"
        {...props(styles.previewMoreButton, style)}
      >
        {label}
      </button>
      {isMobile ? (
        <Sheet onOpenChange={setOpen} open={open} title={title}>
          {list}
        </Sheet>
      ) : open ? (
        createPortal(
          <span
            id={listId}
            onPointerEnter={show}
            onPointerLeave={hideAfterGrace}
            role="tooltip"
            {...props(styles.previewPopover, styles.previewPopoverAt(at.top, at.left))}
          >
            <span {...props(styles.previewPopoverTitle)}>{title}</span>
            {list}
          </span>,
          document.body,
        )
      ) : null}
    </span>
  );
}

/**
 * The × that drops one row, two clicks from gone like every other remove here.
 * A derived row is a label for its own checkbox, so this click has to say it is
 * the button's own and not a tick.
 */
function SiteRemoveButton({
  armed,
  onBlur,
  onClick,
  site,
}: {
  armed: boolean;
  onBlur: () => void;
  onClick: () => void;
  site: string;
}) {
  return (
    <button
      aria-label={armed ? m.gen_web_row_delete_confirm({ site }) : m.gen_web_row_delete({ site })}
      onBlur={onBlur}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      type="button"
      {...props(styles.siteAction, armed && styles.siteActionArmed)}
    >
      {armed ? m.gen_remove_confirm() : '×'}
    </button>
  );
}

/**
 * The box every site list on the page is drawn in: the rows, divided, and the
 * last row that takes one more. The draft is the box's own, so a half-typed
 * host belongs to the list being typed into and to no other.
 */
function SiteList({
  children,
  hasRows,
  inputId,
  onAdd,
}: {
  children?: ReactNode | undefined;
  hasRows: boolean;
  // Set when a visible label names the list; without one the input names
  // itself, which is the blocklist's case.
  inputId?: string | undefined;
  onAdd: (host: string) => void;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    setDraft('');
    onAdd(draft);
  }

  return (
    <div {...props(styles.siteBox)}>
      {children}
      <div {...props(styles.siteRow, hasRows && styles.siteRowDivided)}>
        <input
          aria-label={inputId === undefined ? m.gen_web_add_label() : undefined}
          id={inputId}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          placeholder={m.gen_web_add_placeholder()}
          value={draft}
          {...props(styles.siteHostInput, styles.siteAdd)}
        />
        <button
          aria-label={m.gen_web_add_button()}
          onClick={add}
          type="button"
          {...props(styles.siteAction)}
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * One plain row of a site list: the host, and the two-step × that drops it.
 * There is nothing to tick, because a listed exception is one that applies.
 */
function SiteEntryRow({
  armed,
  checked,
  divided,
  onBlur,
  onRemove,
  onToggle,
  url,
}: {
  armed: boolean;
  checked: boolean;
  divided: boolean;
  onBlur: () => void;
  onRemove: () => void;
  onToggle: () => void;
  url: string;
}) {
  // The whole row is the checkbox's label, so anywhere on it ticks.
  return (
    <Label style={[styles.siteRow, divided && styles.siteRowDivided]}>
      <input
        aria-label={siteLabel(url)}
        checked={checked}
        onChange={onToggle}
        type="checkbox"
        {...props(controls.base, controls.checkbox)}
      />
      <span {...props(styles.siteHost, checked ? styles.siteHostOn : styles.siteHostOff)}>
        {siteLabel(url)}
      </span>
      <SiteRemoveButton armed={armed} onBlur={onBlur} onClick={onRemove} site={siteLabel(url)} />
    </Label>
  );
}

/**
 * One custom row's host, as a field with no chrome of its own. The draft is local, so
 * a half-typed host never reaches the profile: Enter and a blur commit it,
 * Escape puts the old one back, and a blank or unchanged value commits nothing.
 */
function SiteHostField({
  label,
  onCommit,
  style,
  value,
}: {
  label: string;
  onCommit: (text: string) => void;
  style: StyleXStyles;
  value: string;
}) {
  const [draft, setDraft] = useState(value);

  function commit() {
    const next = draft.trim();
    if (next === '' || next === value) {
      setDraft(value);
      return;
    }
    onCommit(next);
  }

  return (
    <input
      aria-label={label}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(value);
        }
      }}
      value={draft}
      {...props(styles.siteHostInput, style)}
    />
  );
}

function Generator() {
  // A phone gets sheets where the wide page gets a popover and a dialog.
  const isMobile = useIsMobile();
  // Safari is the only browser that can go from the download to Settings.
  const isSafari = useIsSafari();
  // What the reader tells the math section their day looks like.
  const [hours, setHours] = useState(HOURS_DEFAULT);
  // The detents click by default, and remember it once the reader says either
  // way. `soundChosen` is what separates the default from an answer.
  const [sound, setSound] = useState(true);
  const [soundChosen, setSoundChosen] = useState(false);
  const [config, setConfig] = useState<ProfileConfig>(presets.mert);
  // The user's own urls, the derived ones they turned off, and the derived ones
  // they deleted. Everything else in the deny list comes from the blocked apps.
  const [customSites, setCustomSites] = useState<Array<CustomSite>>([]);
  const [excludedSites, setExcludedSites] = useState<Array<string>>([]);
  const [removedSites, setRemovedSites] = useState<Array<string>>([]);
  // Rows the reader unticked in the exceptions or the allow list. Only one of
  // those lists is ever on screen, so one set holds both. They stay listed and
  // stay out of the profile, and a reload starts them all ticked again.
  const [excludedEntries, setExcludedEntries] = useState<Array<string>>([]);
  // What the last row of the website box is holding, before Enter takes it.
  const [country, setCountry] = useState(FALLBACK_COUNTRY);
  const [meta, setMeta] = useState<MetaCache>({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<AppResult>>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  // Dismissing the results keeps the query: typing or focusing brings them back.
  const [resultsOpen, setResultsOpen] = useState(true);
  const [storefrontOpen, setStorefrontOpen] = useState(false);
  const [storefrontQuery, setStorefrontQuery] = useState('');
  const [armedRemove, setArmedRemove] = useState<string | null>(null);
  // StyleX cannot reach `details[open] > summary`, so the chevron is turned
  // from React and the element itself stays the source of truth.
  const [moreOpen, setMoreOpen] = useState(false);
  // There is nothing to brag about until a profile has left the page.
  const [generated, setGenerated] = useState(false);
  // The second gate, on the download alone: an installed profile comes off an
  // erased phone and no other way, so it is said out loud before it is signed.
  const [permanent, setPermanent] = useState(false);
  // The signer is a round trip, and it can turn the download down.
  const [signing, setSigning] = useState(false);
  const [signFailure, setSignFailure] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // The years the link that brought the reader here was bragging about. It is
  // the friend's number, so the reader's own slider never rewrites it.
  const [friendYears, setFriendYears] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchWrap = useRef<HTMLDivElement>(null);
  const storefrontFilter = useRef<HTMLInputElement>(null);
  const storefrontMenu = useRef<HTMLDivElement>(null);
  // The dialog opens itself once. After that the reader asks for it.
  const sharePrompted = useRef(false);

  const effectiveConfig = useMemo(
    () => withDerivedSites(config, customSites, excludedSites, removedSites, excludedEntries),
    [config, customSites, excludedSites, removedSites, excludedEntries],
  );
  const xml = useMemo(() => safeBuild(effectiveConfig), [effectiveConfig]);
  // Every line of the website box: one row per site an app implies, deleted
  // ones left out, then the user's own. A site two apps imply is one row that
  // names both, so the row can show whose it is.
  const siteRows = useMemo<Array<SiteRow>>(() => {
    const removed = new Set(removedSites);
    const byUrl = new Map<string, Array<BlockedApp>>();
    for (const app of config.blockedApps) {
      for (const site of sitesForApp(app.bundleId, app.sellerUrl).sites) {
        const url = normalizeUrl(site);
        if (url === '' || removed.has(url)) {
          continue;
        }
        byUrl.set(url, [...(byUrl.get(url) ?? []), app]);
      }
    }
    return [
      ...[...byUrl].map(([url, apps]): SiteRow => ({
        apps,
        enabled: !excludedSites.includes(url),
        kind: 'derived',
        url,
      })),
      ...customSites.map((site, index): SiteRow => ({
        enabled: site.enabled,
        index,
        kind: 'custom',
        url: site.url,
      })),
    ];
  }, [config.blockedApps, customSites, excludedSites, removedSites]);
  const blockedIds = useMemo(
    () => new Set(config.blockedApps.map((app) => app.bundleId)),
    [config.blockedApps],
  );
  const unknownIds = useMemo(
    () =>
      config.blockedApps
        .filter((app) => meta[app.bundleId] === undefined)
        .map((app) => app.bundleId)
        .join(','),
    [config.blockedApps, meta],
  );
  // An empty query is not a search, so it renders no dropdown at all.
  const resultsShown = resultsOpen && query.trim() !== '';
  // 175 countries need a filter. A code matches too, so "us" finds its store.
  const storefrontMatches = useMemo(() => {
    const term = storefrontQuery.trim().toLowerCase();
    if (term === '') {
      return storefronts;
    }
    return storefronts.filter(
      (storefront) =>
        storefront.label.toLowerCase().includes(term) || storefront.code.includes(term),
    );
  }, [storefrontQuery]);

  // The address bar and navigator exist only in the browser: reading either
  // during render would desync the SSR HTML from the first client render.
  // Adopting what they hold IS synchronizing with an external system, the one
  // case the rule leaves to an effect, and it runs once, so nothing cascades.
  /* oxlint-disable react/set-state-in-effect -- one-shot read of browser-only state */
  useEffect(() => {
    const shared = decodeShare(globalThis.location.search);
    if (shared.bundleIds.length > 0) {
      // A shared list is a suggestion, not the reader's own work: it only
      // stands in for the recommended one until they change something.
      setConfig({ ...presets.mert, blockedApps: shared.bundleIds.map(sharedApp) });
    }
    if (shared.hours !== undefined) {
      setHours(shared.hours);
      setFriendYears(formatYears(shared.hours));
    }
    const preferred = initialStorefront();
    if (preferred !== FALLBACK_COUNTRY) {
      setCountry(preferred);
    }
  }, []);
  /* oxlint-enable react/set-state-in-effect */

  // iOS Safari does not count the pointerdown on the knob as the gesture that
  // opens an audio device, so the first gesture it does accept anywhere on the
  // page opens one. Once that works there is nothing left to listen for.
  useEffect(() => {
    const gestures = ['touchend', 'pointerup', 'click'] as const;
    function stop() {
      for (const gesture of gestures) {
        document.removeEventListener(gesture, unlock);
      }
    }
    function unlock() {
      if (unlockTickSound()) {
        stop();
      }
    }
    for (const gesture of gestures) {
      document.addEventListener(gesture, unlock, { once: true, passive: true });
    }
    return stop;
  }, []);

  // Artwork is the only color on the page, and the config carries no icons, so
  // ids nothing is known about are looked up in one request. Caching every
  // answer, misses included, empties the list and stops the effect.
  useEffect(() => {
    if (unknownIds === '') {
      return;
    }
    const requested = unknownIds.split(',');
    const controller = new AbortController();
    void lookupApps(requested, { country, signal: controller.signal })
      .then((apps) => {
        setMeta((current) => mergeMeta(current, requested, apps));
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setMeta((current) => mergeMeta(current, requested, []));
      });
    return () => controller.abort();
  }, [country, unknownIds]);

  // One in-flight search at a time: the cleanup cancels both the pending
  // debounce and the request it already started, so stale keystrokes never win.
  useEffect(() => {
    const term = query.trim();
    if (term === '') {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchApps(term, { country, limit: SEARCH_LIMIT, signal: controller.signal })
        .then((apps) => {
          setResults(apps);
          setSearching(false);
        })
        .catch(() => {
          if (controller.signal.aborted) {
            return;
          }
          setResults([]);
          setSearching(false);
          setSearchFailed(true);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [country, query]);

  // Both dropdowns are dismissed from outside themselves: a pointer anywhere
  // else, or Escape. The country list goes first, so one Escape never closes
  // both at once.
  useEffect(() => {
    if (!resultsShown && !storefrontOpen) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (storefrontMenu.current?.contains(target) !== true) {
        setStorefrontOpen(false);
      }
      if (searchWrap.current?.contains(target) !== true) {
        setResultsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }
      if (storefrontOpen) {
        setStorefrontOpen(false);
        searchInput.current?.focus();
        return;
      }
      setResultsOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [resultsShown, storefrontOpen]);

  // The filter mounts with the country list, so its focus waits for that render.
  useEffect(() => {
    if (storefrontOpen) {
      storefrontFilter.current?.focus();
    }
  }, [storefrontOpen]);

  // An armed Remove is a trap for the next stray click, so it stands down on
  // its own: Escape, or a few seconds of the user doing something else.
  useEffect(() => {
    if (armedRemove === null) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setArmedRemove(null);
      }
    }
    const timer = setTimeout(() => setArmedRemove(null), REMOVE_CONFIRM_MS);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [armedRemove]);

  function onHoursChange(value: number) {
    // One click per detent, and a lower one where the travel runs out.
    if (value !== hours && tickAllowed(sound, soundChosen)) {
      primeTickSound();
      playTick({ end: value === HOURS_MIN || value === HOURS_MAX });
    }
    setHours(value);
  }

  // Browsers only hand out an audio device inside a gesture, so the pointer
  // that is about to drag the knob is what opens it.
  function armSound() {
    if (tickAllowed(sound, soundChosen)) {
      primeTickSound();
    }
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundChosen(true);
    if (next) {
      primeTickSound();
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setSearchFailed(false);
    setSearching(value.trim() !== '');
    setResultsOpen(true);
  }

  // Emptying the query re-runs the search effect, whose cleanup aborts whatever
  // request the last keystroke started, so there is nothing left to cancel here.
  function clearSearch() {
    setQuery('');
    setResults([]);
    setSearching(false);
    setSearchFailed(false);
    searchInput.current?.focus();
  }

  function toggleStorefront() {
    setStorefrontQuery('');
    setStorefrontOpen(!storefrontOpen);
  }

  function pickStorefront(code: string) {
    setCountry(code);
    setStorefrontOpen(false);
    setStorefrontQuery('');
    searchInput.current?.focus();
  }

  // The list is long, so the arrows walk it from the filter without a mouse.
  function onStorefrontKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const options = [
      ...(storefrontMenu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []),
    ];
    if (options.length === 0) {
      return;
    }
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const first = step === 1 ? 0 : options.length - 1;
    const next = current === -1 ? first : (current + step + options.length) % options.length;
    options[next]?.focus();
  }

  function addApp(app: AppResult) {
    // The search row already carries the artwork, so adding it costs no lookup.
    setMeta((current) => ({
      ...current,
      [app.bundleId]: { developer: app.developer, iconUrl: app.iconUrl },
    }));
    // The stored name is the short one: the grid and the fan have no room for
    // the App Store tagline, and the config is what both of them read. The
    // seller url rides along, because the sites of an uncurated app come from it.
    setConfig({
      ...config,
      blockedApps: [
        ...config.blockedApps,
        { bundleId: app.bundleId, name: shortAppName(app.name), sellerUrl: app.sellerUrl },
      ],
    });
  }

  // Removing is one click away from undoable and one click away from gone, so
  // the first click only arms the button. Only one row can be armed at a time.
  function onRemoveClick(bundleId: string) {
    if (armedRemove === bundleId) {
      setArmedRemove(null);
      setConfig({
        ...config,
        blockedApps: config.blockedApps.filter((app) => app.bundleId !== bundleId),
      });
      return;
    }
    setArmedRemove(bundleId);
  }

  // The same two-step, on the whole list: one click arms, the next resets. The
  // recommended apps come back with every site they imply, so the rows that
  // were unticked or deleted are forgotten too; the user's own urls stay.
  function onResetClick() {
    if (armedRemove === RESET_ARMED) {
      setArmedRemove(null);
      const next = { ...config, blockedApps: [...presets.mert.blockedApps] };
      setConfig(next);
      setExcludedSites([]);
      setRemovedSites([]);
      return;
    }
    setArmedRemove(RESET_ARMED);
  }

  function setWebMode(mode: WebMode) {
    if (mode === 'deny') {
      setConfig({
        ...config,
        webFilter: {
          // Derived, and written in by `withDerivedSites` on the way out.
          deniedUrls: [],
          mode,
          permittedUrls: [...PRESET_PERMITTED],
        },
      });
      return;
    }
    if (mode === 'allow') {
      setConfig({ ...config, webFilter: { allowedUrls: [], mode } });
      return;
    }
    setConfig({ ...config, webFilter: { mode } });
  }

  // A derived site the user turns off stays off while its app stays blocked,
  // so the exclusion is remembered by url, not by app.
  function toggleRow(row: SiteRow) {
    if (row.kind === 'derived') {
      const next = excludedSites.includes(row.url)
        ? excludedSites.filter((url) => url !== row.url)
        : [...excludedSites, row.url];
      setExcludedSites(next);
      return;
    }
    const next = customSites.map((site, index) =>
      index === row.index ? { ...site, enabled: !site.enabled } : site,
    );
    setCustomSites(next);
  }

  // The same two-step as an app row: the first click only arms the ×. A derived
  // site has to be remembered as removed, because its app would otherwise bring
  // it straight back.
  function onSiteRemoveClick(row: SiteRow) {
    const armed = rowKey(row);
    if (armedRemove !== armed) {
      setArmedRemove(armed);
      return;
    }
    setArmedRemove(null);
    if (row.kind === 'derived') {
      const next = [...removedSites, row.url];
      setRemovedSites(next);
      return;
    }
    const next = customSites.filter((_, index) => index !== row.index);
    setCustomSites(next);
  }

  // Only the user's own rows are editable, and the field hands over nothing
  // blank or unchanged, so a committed host is always a new one.
  function editCustomSite(position: number, text: string) {
    const url = normalizeUrl(text);
    if (url === '') {
      return;
    }
    const next = customSites.map((site, index) => (index === position ? { ...site, url } : site));
    setCustomSites(next);
  }

  // One more site, typed into the last row of the box. A blank and a site the
  // box already lists are both nothing new, so the row just empties itself.
  function addSite(host: string) {
    const url = normalizeUrl(host);
    if (url === '' || siteRows.some((row) => row.url === url)) {
      return;
    }
    const next = [...customSites, { enabled: true, url }];
    setCustomSites(next);
  }

  // The exceptions and the allow list are plain arrays in the config, so one
  // pair of handlers each: a blank and a site already listed are both nothing.
  function addPermitted(host: string) {
    const url = normalizeUrl(host);
    const web = config.webFilter;
    if (url === '' || web.mode !== 'deny' || web.permittedUrls.includes(url)) {
      return;
    }
    setConfig({ ...config, webFilter: { ...web, permittedUrls: [...web.permittedUrls, url] } });
  }

  function addAllowed(host: string) {
    const url = normalizeUrl(host);
    const web = config.webFilter;
    if (url === '' || web.mode !== 'allow' || web.allowedUrls.includes(url)) {
      return;
    }
    setConfig({ ...config, webFilter: { ...web, allowedUrls: [...web.allowedUrls, url] } });
  }

  // The same two-step as every other remove on the page: the first click only
  // arms the ×.
  function onListRemoveClick(key: string, remove: () => void) {
    if (armedRemove !== key) {
      setArmedRemove(key);
      return;
    }
    setArmedRemove(null);
    remove();
  }

  function removePermitted(url: string) {
    const web = config.webFilter;
    if (web.mode !== 'deny') {
      return;
    }
    setConfig({
      ...config,
      webFilter: { ...web, permittedUrls: web.permittedUrls.filter((set) => set !== url) },
    });
  }

  // An unticked entry stays on the page and leaves the profile, the same way
  // an unticked derived site does.
  function toggleEntry(url: string) {
    setExcludedEntries(
      excludedEntries.includes(url)
        ? excludedEntries.filter((entry) => entry !== url)
        : [...excludedEntries, url],
    );
  }

  function removeAllowed(url: string) {
    const web = config.webFilter;
    if (web.mode !== 'allow') {
      return;
    }
    setConfig({
      ...config,
      webFilter: { ...web, allowedUrls: web.allowedUrls.filter((set) => set !== url) },
    });
  }

  /**
   * A profile has left the page. That is the moment the share dialog is worth
   * showing, and it shows itself only the first time in a session: the button
   * under the profile reopens it.
   */
  function markGenerated() {
    setGenerated(true);
    if (!sharePrompted.current) {
      sharePrompted.current = true;
      setShareOpen(true);
    }
  }

  function save(profile: BlobPart) {
    const url = URL.createObjectURL(new Blob([profile], { type: PROFILE_MIME }));
    const anchor = document.createElement('a');
    anchor.download = PROFILE_FILENAME;
    anchor.href = url;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * The file the reader installs is signed, and only the server can sign it.
   * The local build is what the button waits on: it is the same profile, minus
   * the signature and the identifier the server mints for this one download.
   */
  async function download() {
    if (xml === null || signing) {
      return;
    }
    setSignFailure(null);
    setSigning(true);
    try {
      const response = await fetch(SIGN_URL, {
        body: JSON.stringify({ config: signPayload(effectiveConfig) }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) {
        setSignFailure(await signFailureOf(response));
        return;
      }
      save(await response.arrayBuffer());
      markGenerated();
    } catch {
      setSignFailure(m.gen_sign_unavailable());
    } finally {
      setSigning(false);
    }
  }

  // The derived list is what the profile carries, so it is what the card counts.
  const filter = effectiveConfig.webFilter;
  // What the boxes draw: every row the reader put there, ticked or not. The
  // effective config above is what the profile gets, and it drops the unticked.
  const listedPermitted = config.webFilter.mode === 'deny' ? config.webFilter.permittedUrls : [];
  const listedAllowed = config.webFilter.mode === 'allow' ? config.webFilter.allowedUrls : [];
  // Only a deny list "blocks sites"; an allow list blocks everything else.
  const blockedSites = filter.mode === 'deny' ? filter.deniedUrls.length : 0;
  const siteSummary =
    filter.mode === 'deny'
      ? m.gen_summary_sites_blocked({ count: filter.deniedUrls.length })
      : filter.mode === 'allow'
        ? m.gen_summary_sites_allowed({ count: filter.allowedUrls.length })
        : m.gen_summary_sites_none();
  // The preview draws the profile instead of listing it: the icons of the apps
  // it hides, and the hosts it turns away. Whatever does not fit is counted.
  const previewApps = config.blockedApps.slice(0, PREVIEW_APPS);
  const hiddenApps = config.blockedApps.length - previewApps.length;
  const deniedSites = filter.mode === 'deny' ? filter.deniedUrls : [];
  const previewSites = deniedSites.slice(0, PREVIEW_SITES);
  const hiddenSites = deniedSites.length - previewSites.length;
  // Trial mode is the removal lock turned around: a trial profile comes off in
  // Settings, so the download asks for no acknowledgement.
  const trial = !config.lockRemoval;

  // The number the whole narrative is written around, and the dial's own
  // reading: the sentence prints it, and the slider says it out loud.
  const years = formatYears(hours);
  const hoursText = m.home_math_hours({ hours });
  const hoursReading = `${hoursText} ${m.home_math_hours_unit()}`;
  // How far along the rail the dial has been turned, and what it has cost.
  const travelled = ((hours - HOURS_MIN) / (HOURS_MAX - HOURS_MIN)) * 100;
  const ledger = ledgerItems(hours, getLocale());

  // What the whole thing costs, as three numbers and the word each one means.
  const dealTiles = [
    { label: m.home_deal_apps_label(), value: m.home_deal_apps_value() },
    { label: m.home_deal_price_label(), value: m.home_deal_price_value() },
    { label: m.home_deal_time_label(), value: m.home_deal_time_value() },
  ];

  // Supervision leads: it is the step the other three stand on.
  const howItWorks = [
    { body: m.home_how_supervision_body(), guide: true, title: m.home_how_supervision_title() },
    { body: m.home_how_profile_body(), guide: false, title: m.home_how_profile_title() },
    { body: m.home_how_apps_body(), guide: false, title: m.home_how_apps_title() },
    { body: m.home_how_websites_body(), guide: false, title: m.home_how_websites_title() },
  ];

  const proofPoints = [
    { body: m.home_proof_months_body(), title: m.home_proof_months_title() },
    { body: m.home_proof_minutes_body(), title: m.home_proof_minutes_title() },
    { body: m.home_proof_blocked_body(), title: m.home_proof_blocked_title() },
  ];

  const objections = [
    { desc: m.home_faq_data_desc(), term: m.home_faq_data_term() },
    { desc: m.home_faq_undo_desc(), term: m.home_faq_undo_term() },
    { desc: m.home_faq_change_desc(), term: m.home_faq_change_term() },
    { desc: m.home_faq_updates_desc(), term: m.home_faq_updates_term() },
    { desc: m.home_faq_keep_desc(), term: m.home_faq_keep_term() },
    { desc: m.home_faq_apple_desc(), term: m.home_faq_apple_term() },
    { desc: m.home_faq_mac_desc(), term: m.home_faq_mac_term() },
    { desc: m.home_faq_android_desc(), term: m.home_faq_android_term() },
    { desc: m.home_faq_windows_desc(), term: m.home_faq_windows_term() },
  ];

  return (
    <main {...props(styles.page)}>
      <GridTexture />
      {friendYears === null ? null : (
        <div {...props(styles.banner)}>
          <span>{m.share_banner({ years: friendYears })}</span>
          <button
            aria-label={m.share_banner_dismiss()}
            onClick={() => setFriendYears(null)}
            type="button"
            {...props(styles.bannerDismiss)}
          >
            ×
          </button>
        </div>
      )}
      <header {...props(styles.hero)}>
        <h1 {...props(styles.heroTitle)}>
          <span>{m.home_hero_line_1()}</span>
          <span {...props(styles.quiet)}>{m.home_hero_line_2()}</span>
        </h1>
      </header>

      <div {...props(styles.content)}>
        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>
            {m.home_math_title()}
            <ScreenTimeHelp />
          </h2>
          <div {...props(styles.dial)}>
            <div {...props(styles.dialRail)}>
              <Label style={styles.sliderLabel}>
                <span {...props(styles.srOnly)}>{m.home_math_slider_label()}</span>
                {/* The end of the gesture, not its start, is what iOS accepts as
                    leave to open an audio device, so it gets its own handlers. */}
                <input
                  aria-valuetext={hoursReading}
                  max={HOURS_MAX}
                  min={HOURS_MIN}
                  onChange={(event) => onHoursChange(Number(event.target.value))}
                  onPointerDown={armSound}
                  onPointerUp={unlockTickSound}
                  onTouchEnd={unlockTickSound}
                  step={HOURS_STEP}
                  type="range"
                  value={hours}
                  {...props(styles.slider, styles.sliderFill(travelled))}
                />
              </Label>
              {/* The detents, drawn where the knob lands on each of them. The
                  input already says all of this to a screen reader. */}
              <div aria-hidden="true" {...props(styles.tickRail)}>
                {TICKS.map((tick) => (
                  <span key={tick.value} {...props(styles.tick, styles.tickAt(tick.at))}>
                    <span {...props(styles.tickNumber)}>{tick.value}</span>
                  </span>
                ))}
              </div>
            </div>
            <button
              aria-label={m.home_math_sound_label()}
              aria-pressed={sound}
              onClick={toggleSound}
              type="button"
              {...props(styles.soundButton)}
            >
              <svg aria-hidden="true" viewBox="0 0 18 18" {...props(styles.soundGlyph)}>
                <path d="M4 7H2v4h2l3.5 3V4L4 7Z" fill="currentColor" />
                {sound ? (
                  <path
                    d="M10.5 6.5a3.4 3.4 0 0 1 0 5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.4"
                  />
                ) : (
                  <path
                    d="m10.5 6.5 4 5m0-5-4 5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.4"
                  />
                )}
              </svg>
            </button>
          </div>
          {/* The hours are what the reader gives and the years are what it
              costs, so those two numbers are the only colour in the line. */}
          <p {...props(styles.mathResult)}>
            {m.home_math_result_hours_before()}
            <span {...props(styles.burn)}>{hoursText}</span>
            {hours === 1
              ? m.home_math_result_hours_between_one()
              : m.home_math_result_hours_between()}
            <span {...props(styles.burn)}>{years}</span>
            {m.home_math_result_hours_after()}
          </p>
          <h3 {...props(styles.label)}>{m.home_ledger_title()}</h3>
          <ul {...props(styles.ledger)}>
            {ledger.map((item) => (
              <li key={item.key} {...props(styles.ledgerItem)}>
                {item.number === undefined ? null : (
                  <>
                    <span {...props(styles.ledgerNumber)}>{item.number}</span>{' '}
                  </>
                )}
                {item.text}
              </li>
            ))}
          </ul>
          <p {...props(styles.ledgerNote)}>
            {m.home_ledger_note_before()}
            <a href={READING_SPEED_URL} rel="noreferrer" target="_blank">
              {m.home_ledger_note_link()}
            </a>
            {m.home_ledger_note_after()}
          </p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>
            {m.home_fan_before()}
            {config.blockedApps.length === 0 ? (
              <span {...props(fanStyles.fan)}>{m.home_fan_empty()}</span>
            ) : (
              <AppIconFan apps={config.blockedApps} meta={meta} />
            )}
            {m.home_fan_after()}
          </h2>
          <p {...props(styles.fanBody)}>{m.home_other_side()}</p>
        </section>

        <section {...props(styles.section)}>
          <p {...props(styles.label)}>{m.home_deal_label()}</p>
          <div {...props(styles.dealGrid)}>
            {dealTiles.map((tile) => (
              <div key={tile.label} {...props(styles.dealTile)}>
                <p {...props(styles.dealValue)}>{tile.value}</p>
                <p {...props(styles.dealLabel)}>{tile.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
          <div {...props(styles.video)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.playGlyph)}>
              {/* The triangle's weight sits at its base, so its box leans right
                  of centre: that is what makes it look centred. */}
              <path d="M9 6 19 12 9 18Z" fill="currentColor" />
            </svg>
            <span>{m.home_video_placeholder()}</span>
          </div>
          <div {...props(styles.stepGrid)}>
            {howItWorks.map((step, index) => (
              <Card key={step.title}>
                <CardHeader>
                  <CardTitle>{m.home_step_heading({ n: index + 1, title: step.title })}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p {...props(styles.stepBody)}>{step.body}</p>
                  {step.guide ? (
                    <a href={SUPERVISE_URL} {...props(styles.stepLink)}>
                      {m.gen_supervise_link()}
                    </a>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_proof_title()}</h2>
          <div {...props(styles.proofGrid)}>
            {proofPoints.map((point) => (
              <Card key={point.title}>
                <CardHeader>
                  <CardTitle>{point.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p {...props(styles.stepBody)}>{point.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section {...props(styles.section)}>
          <div {...props(styles.stepHeader)}>
            <p {...props(styles.label)}>{m.gen_step1_label()}</p>
            <h2 {...props(styles.sectionTitle)}>{m.gen_step1_title()}</h2>
          </div>
          <p {...props(layout.muted)}>{m.gen_step1_body()}</p>
          <div {...props(styles.row)}>
            <Button render={<a href={SUPERVISE_URL} />}>{m.gen_step1_cta()}</Button>
          </div>
        </section>

        <div {...props(styles.stepHeader)}>
          <p {...props(styles.label)}>{m.gen_step2_label()}</p>
          <h2 {...props(styles.sectionTitle)}>{m.gen_step2_title()}</h2>
        </div>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_apps_title()}</h2>
          <p {...props(layout.muted)}>
            {m.home_apps_subtitle()}{' '}
            <button
              onBlur={() => setArmedRemove(null)}
              onClick={onResetClick}
              type="button"
              {...props(styles.resetLink, armedRemove === RESET_ARMED && styles.resetArmed)}
            >
              {armedRemove === RESET_ARMED ? m.gen_remove_confirm() : m.gen_apps_reset()}
            </button>
          </p>
          <div ref={searchWrap} {...props(styles.searchWrap)}>
            <div {...props(styles.searchBar)}>
              <div
                onKeyDown={onStorefrontKeyDown}
                ref={storefrontMenu}
                {...props(styles.storefrontMenu)}
              >
                <button
                  aria-expanded={storefrontOpen}
                  aria-haspopup="listbox"
                  aria-label={m.gen_storefront_label()}
                  id="storefront"
                  onClick={toggleStorefront}
                  type="button"
                  {...props(styles.storefrontButton)}
                >
                  {/* Hidden from the name, so the control reads as its country
                      and not as an unpronounceable flag. */}
                  <span aria-hidden="true" {...props(styles.storefrontFlag)}>
                    {flagEmoji(country)}
                  </span>
                  <span {...props(styles.truncate)}>{storefrontLabel(country)}</span>
                </button>
                {storefrontOpen ? (
                  <div {...props(styles.storefrontList)}>
                    <Input
                      aria-label={m.gen_storefront_filter()}
                      onChange={(event) => setStorefrontQuery(event.target.value)}
                      placeholder={m.gen_storefront_filter()}
                      ref={storefrontFilter}
                      style={styles.storefrontFilter}
                      value={storefrontQuery}
                    />
                    <div
                      aria-label={m.gen_storefront_label()}
                      role="listbox"
                      {...props(styles.storefrontOptions)}
                    >
                      {storefrontMatches.map((storefront) => (
                        <button
                          aria-selected={storefront.code === country}
                          key={storefront.code}
                          onClick={() => pickStorefront(storefront.code)}
                          role="option"
                          type="button"
                          {...props(
                            styles.storefrontOption,
                            storefront.code === country && styles.storefrontOptionSelected,
                          )}
                        >
                          <span aria-hidden="true" {...props(styles.storefrontFlag)}>
                            {flagEmoji(storefront.code)}
                          </span>
                          <span>{storefront.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <span aria-hidden="true" {...props(styles.searchDivider)} />
              <Input
                aria-label={m.gen_app_search_label()}
                id="app-search"
                onChange={(event) => onQueryChange(event.target.value)}
                onFocus={() => setResultsOpen(true)}
                placeholder={m.gen_app_search_placeholder()}
                ref={searchInput}
                style={styles.searchField}
                value={query}
              />
              {query === '' ? null : (
                <button
                  aria-label={m.gen_app_search_clear()}
                  onClick={clearSearch}
                  type="button"
                  {...props(styles.clearButton)}
                >
                  ×
                </button>
              )}
            </div>
            {resultsShown ? (
              <div {...props(styles.resultsPanel)}>
                {searchFailed ? (
                  <p role="alert" {...props(layout.muted)}>
                    {m.gen_app_search_error()}
                  </p>
                ) : null}
                {searching ? (
                  <ul {...props(styles.list)}>
                    {SKELETON_ROWS.map((row) => (
                      <li key={row}>
                        <Skeleton style={styles.skeletonRow} />
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!searching && results.length === 0 && !searchFailed ? (
                  <p {...props(layout.muted)}>{m.gen_app_results_empty()}</p>
                ) : null}
                {!searching && results.length > 0 ? (
                  <ul {...props(styles.list)}>
                    {results.map((app) => (
                      <li key={app.bundleId} {...props(styles.appRow)}>
                        <img
                          alt={shortAppName(app.name)}
                          src={app.iconUrl}
                          {...props(artworkStyles.artwork, styles.resultArtwork)}
                        />
                        <span {...props(styles.appText)}>
                          {/* The full App Store title stays one hover away. */}
                          <span title={app.name} {...props(styles.appName)}>
                            {shortAppName(app.name)}
                          </span>
                          <span title={app.developer} {...props(layout.muted, styles.truncate)}>
                            {app.developer}
                          </span>
                        </span>
                        <Button
                          disabled={blockedIds.has(app.bundleId)}
                          onClick={() => addApp(app)}
                          variant="outline"
                        >
                          {blockedIds.has(app.bundleId) ? m.gen_app_added() : m.gen_app_add()}
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
          {config.blockedApps.length === 0 ? (
            <p {...props(layout.muted)}>{m.gen_apps_empty()}</p>
          ) : null}
          <ul {...props(styles.appGrid)}>
            {config.blockedApps.map((app) => (
              <li key={app.bundleId} {...props(styles.appRow)}>
                <AppArtwork meta={meta[app.bundleId]} name={app.name} style={styles.tileArtwork} />
                <span {...props(styles.appText)}>
                  <span {...props(styles.appName)}>{app.name}</span>
                  {meta[app.bundleId]?.developer ? (
                    <span
                      title={meta[app.bundleId]?.developer}
                      {...props(layout.muted, styles.truncate)}
                    >
                      {meta[app.bundleId]?.developer}
                    </span>
                  ) : null}
                </span>
                <Button
                  aria-label={
                    armedRemove === app.bundleId ? m.gen_app_remove_confirm() : m.gen_app_remove()
                  }
                  onBlur={() => setArmedRemove(null)}
                  onClick={() => onRemoveClick(app.bundleId)}
                  style={armedRemove === app.bundleId ? styles.removeArmed : styles.removeIdle}
                  variant="ghost"
                >
                  {armedRemove === app.bundleId ? (
                    m.gen_remove_confirm()
                  ) : (
                    <span {...props(styles.removeGlyph)}>×</span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.gen_web_title()}</h2>
          <div aria-label={m.gen_web_mode_label()} role="radiogroup" {...props(styles.choice)}>
            <Label>
              <input
                checked={filter.mode === 'deny'}
                name="web-mode"
                onChange={() => setWebMode('deny')}
                type="radio"
                {...props(controls.base, controls.radio)}
              />
              {m.gen_web_mode_deny()}
            </Label>
            <Label>
              <input
                checked={filter.mode === 'allow'}
                name="web-mode"
                onChange={() => setWebMode('allow')}
                type="radio"
                {...props(controls.base, controls.radio)}
              />
              {m.gen_web_mode_allow()}
            </Label>
            <Label>
              <input
                checked={filter.mode === 'off'}
                name="web-mode"
                onChange={() => setWebMode('off')}
                type="radio"
                {...props(controls.base, controls.radio)}
              />
              {m.gen_web_mode_off()}
            </Label>
          </div>
          {filter.mode === 'deny' ? (
            <div {...props(styles.section)}>
              <p {...props(layout.muted)}>{m.gen_web_derived_count({ count: blockedSites })}</p>
              <SiteList hasRows={siteRows.length > 0} onAdd={addSite}>
                {siteRows.map((row, position) =>
                  row.kind === 'derived' ? (
                    // The whole row is the checkbox's label, so anywhere on it ticks.
                    <Label
                      key={rowKey(row)}
                      style={[styles.siteRow, position > 0 && styles.siteRowDivided]}
                    >
                      <input
                        aria-label={siteLabel(row.url)}
                        checked={row.enabled}
                        onChange={() => toggleRow(row)}
                        type="checkbox"
                        {...props(controls.base, controls.checkbox)}
                      />
                      <span
                        {...props(
                          styles.siteHost,
                          row.enabled ? styles.siteHostOn : styles.siteHostOff,
                        )}
                      >
                        {siteLabel(row.url)}
                      </span>
                      <span {...props(styles.siteApps)}>
                        {row.apps.slice(0, ROW_APPS).map((app, index) => (
                          <AppArtwork
                            key={app.bundleId}
                            meta={meta[app.bundleId]}
                            name={app.name}
                            style={[styles.siteAppArtwork, index > 0 && styles.siteAppOverlap]}
                          />
                        ))}
                      </span>
                      <SiteRemoveButton
                        armed={armedRemove === rowKey(row)}
                        onBlur={() => setArmedRemove(null)}
                        onClick={() => onSiteRemoveClick(row)}
                        site={siteLabel(row.url)}
                      />
                    </Label>
                  ) : (
                    <div
                      key={rowKey(row)}
                      {...props(styles.siteRow, position > 0 && styles.siteRowDivided)}
                    >
                      <input
                        aria-label={siteLabel(row.url)}
                        checked={row.enabled}
                        onChange={() => toggleRow(row)}
                        type="checkbox"
                        {...props(controls.base, controls.checkbox)}
                      />
                      <SiteHostField
                        label={m.gen_web_row_edit({ site: siteLabel(row.url) })}
                        onCommit={(host) => editCustomSite(row.index, host)}
                        style={row.enabled ? styles.siteHostOn : styles.siteHostOff}
                        value={siteLabel(row.url)}
                      />
                      <SiteRemoveButton
                        armed={armedRemove === rowKey(row)}
                        onBlur={() => setArmedRemove(null)}
                        onClick={() => onSiteRemoveClick(row)}
                        site={siteLabel(row.url)}
                      />
                    </div>
                  ),
                )}
              </SiteList>
            </div>
          ) : null}
          {filter.mode === 'deny' ? (
            <Field>
              <FieldLabel htmlFor={PERMITTED_INPUT_ID}>{m.gen_web_permitted_label()}</FieldLabel>
              <SiteList
                hasRows={listedPermitted.length > 0}
                inputId={PERMITTED_INPUT_ID}
                onAdd={addPermitted}
              >
                {listedPermitted.map((url, position) => (
                  <SiteEntryRow
                    armed={armedRemove === `${PERMITTED_INPUT_ID}:${url}`}
                    checked={!excludedEntries.includes(url)}
                    divided={position > 0}
                    key={url}
                    onBlur={() => setArmedRemove(null)}
                    onRemove={() =>
                      onListRemoveClick(`${PERMITTED_INPUT_ID}:${url}`, () => removePermitted(url))
                    }
                    onToggle={() => toggleEntry(url)}
                    url={url}
                  />
                ))}
              </SiteList>
            </Field>
          ) : null}
          {filter.mode === 'allow' ? (
            <Field>
              <FieldLabel htmlFor={ALLOWED_INPUT_ID}>{m.gen_web_allowed_label()}</FieldLabel>
              <SiteList
                hasRows={listedAllowed.length > 0}
                inputId={ALLOWED_INPUT_ID}
                onAdd={addAllowed}
              >
                {listedAllowed.map((url, position) => (
                  <SiteEntryRow
                    armed={armedRemove === `${ALLOWED_INPUT_ID}:${url}`}
                    checked={!excludedEntries.includes(url)}
                    divided={position > 0}
                    key={url}
                    onBlur={() => setArmedRemove(null)}
                    onRemove={() =>
                      onListRemoveClick(`${ALLOWED_INPUT_ID}:${url}`, () => removeAllowed(url))
                    }
                    onToggle={() => toggleEntry(url)}
                    url={url}
                  />
                ))}
              </SiteList>
            </Field>
          ) : null}
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.gen_restrictions_title()}</h2>
          <Label>
            <input
              checked={config.autoFilterAdult}
              onChange={(event) => setConfig({ ...config, autoFilterAdult: event.target.checked })}
              type="checkbox"
              {...props(controls.base, controls.checkbox)}
            />
            {m.gen_web_auto_filter()}
          </Label>
          <div {...props(styles.choice)}>
            <Label>
              <input
                checked={trial}
                onChange={(event) => setConfig({ ...config, lockRemoval: !event.target.checked })}
                type="checkbox"
                {...props(controls.base, controls.checkbox)}
              />
              {m.gen_trial_check()}
            </Label>
            <p {...props(layout.muted)}>{m.gen_trial_help()}</p>
          </div>
          <details onToggle={(event) => setMoreOpen(event.currentTarget.open)}>
            <summary {...props(styles.moreSummary)}>
              {m.gen_more_settings()}
              <svg
                aria-hidden="true"
                viewBox="0 0 12 12"
                {...props(styles.moreChevron, moreOpen && styles.moreChevronOpen)}
              >
                <path
                  d="m4.5 2.5 3.5 3.5-3.5 3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.4"
                />
              </svg>
            </summary>
            <div {...props(styles.moreBody)}>
              <Label>
                <input
                  checked={config.allowPrivateBrowsing}
                  onChange={(event) =>
                    setConfig({ ...config, allowPrivateBrowsing: event.target.checked })
                  }
                  type="checkbox"
                  {...props(controls.base, controls.checkbox)}
                />
                {m.gen_web_private_browsing()}
              </Label>
              <div {...props(styles.choice)}>
                <Label>
                  <input
                    checked={config.allowAppStore}
                    onChange={(event) =>
                      setConfig({ ...config, allowAppStore: event.target.checked })
                    }
                    type="checkbox"
                    {...props(controls.base, controls.checkbox)}
                  />
                  {m.gen_allow_app_store()}
                </Label>
                <p {...props(layout.muted)}>{m.gen_allow_app_store_help()}</p>
              </div>
            </div>
          </details>
        </section>

        <section {...props(styles.section)}>
          <Card>
            <CardHeader>
              <CardTitle style={styles.sectionTitle}>{m.gen_output_title()}</CardTitle>
            </CardHeader>
            <CardContent {...props(styles.section)}>
              <div {...props(styles.preview)}>
                <div {...props(styles.previewApps)}>
                  {previewApps.length > 0 ? (
                    <span {...props(styles.previewFan)}>
                      {previewApps.map((app, index) => (
                        <AppArtwork
                          key={app.bundleId}
                          meta={meta[app.bundleId]}
                          name={app.name}
                          style={[styles.previewArtwork, index > 0 && styles.previewOverlap]}
                        />
                      ))}
                      {hiddenApps > 0 ? (
                        <PreviewMore
                          items={config.blockedApps.map((app) => app.name)}
                          label={m.gen_summary_apps_more({ count: hiddenApps })}
                          style={styles.previewMore}
                          title={m.gen_preview_all_apps_title()}
                        />
                      ) : null}
                    </span>
                  ) : null}
                  <span>{m.gen_summary_apps({ count: config.blockedApps.length })}</span>
                </div>
                <div {...props(styles.previewSites)}>
                  <span>{siteSummary}</span>
                  {previewSites.length > 0 ? (
                    <span {...props(styles.previewChips)}>
                      {previewSites.map((site) => (
                        <span key={site} {...props(styles.previewChip)}>
                          {siteLabel(site)}
                        </span>
                      ))}
                      {hiddenSites > 0 ? (
                        <PreviewMore
                          items={deniedSites.map((site) => siteLabel(site))}
                          label={m.gen_summary_sites_more({ count: hiddenSites })}
                          style={styles.previewChip}
                          title={m.gen_preview_all_sites_title()}
                        />
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <div {...props(styles.previewPills)}>
                  <Badge variant="outline">
                    {config.lockRemoval ? m.gen_summary_locked_on() : m.gen_summary_locked_off()}
                  </Badge>
                  {config.autoFilterAdult ? (
                    <Badge variant="outline">{m.gen_summary_adult()}</Badge>
                  ) : null}
                </div>
              </div>
              {trial ? null : (
                <Label>
                  <input
                    checked={permanent}
                    onChange={(event) => setPermanent(event.target.checked)}
                    type="checkbox"
                    {...props(controls.base, controls.checkbox)}
                  />
                  {m.gen_permanent_check()}
                </Label>
              )}
              <div {...props(styles.row)}>
                <Button
                  disabled={xml === null || (!trial && !permanent) || signing}
                  onClick={() => void download()}
                >
                  {signing ? m.gen_signing() : trial ? m.gen_download_trial() : m.gen_download()}
                </Button>
                {generated ? (
                  <Button onClick={() => setShareOpen(true)} variant="outline">
                    {m.share_reopen()}
                  </Button>
                ) : null}
              </div>
              {signFailure === null ? null : <p {...props(layout.muted)}>{signFailure}</p>}
            </CardContent>
          </Card>
          <h3 {...props(styles.sectionTitle)}>{m.gen_install_title()}</h3>
          <ol {...props(styles.steps)}>
            {installSteps(isMobile, isSafari).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p {...props(layout.muted)}>{m.gen_install_note()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_faq_title()}</h2>
          <dl {...props(styles.defList)}>
            {objections.map((objection) => (
              <div key={objection.term}>
                <dt {...props(styles.defTerm)}>{objection.term}</dt>
                <dd {...props(styles.defDesc)}>{objection.desc}</dd>
              </div>
            ))}
          </dl>
        </section>

        {isMobile ? (
          <Sheet onOpenChange={setShareOpen} open={shareOpen} title={m.share_heading_output()}>
            <ShareCard apps={config.blockedApps} hours={hours} meta={meta} years={years} />
          </Sheet>
        ) : (
          <Dialog onOpenChange={setShareOpen} open={shareOpen}>
            <DialogContent
              // The download opens this dialog on its own, so the focus lands on
              // the way out of it, not on the first control inside the card.
              initialFocus={() =>
                document.querySelector<HTMLElement>(
                  '[data-slot="dialog-content"] [data-slot="dialog-close"]',
                )
              }
              style={styles.shareDialog}
            >
              <DialogHeader>
                <DialogTitle style={styles.sectionTitle}>{m.share_heading_output()}</DialogTitle>
              </DialogHeader>
              <ShareCard apps={config.blockedApps} hours={hours} meta={meta} years={years} />
            </DialogContent>
          </Dialog>
        )}

        <SiteFooter />
      </div>
    </main>
  );
}
