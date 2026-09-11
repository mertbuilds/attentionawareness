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
  FieldDescription,
  FieldLabel,
  Input,
  Label,
  Skeleton,
} from '@keepyourattention/ui';
import { colors, font, palette, radius, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AppArtwork, artworkStyles } from '../components/app-artwork.tsx';
import type { MetaCache } from '../components/app-artwork.tsx';
import { AppIconFan, fanStyles } from '../components/app-icon-fan.tsx';
import { Preferences } from '../components/preferences.tsx';
import { ShareCard } from '../components/share-card.tsx';
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
import { layout } from '../lib/layout.ts';
import { buildProfile, presets } from '../lib/profile/index.ts';
import type { BlockedApp, ProfileConfig } from '../lib/profile/index.ts';
import { decodeShare } from '../lib/share.ts';
import { normalizeUrl, sitesForApp, sitesForApps } from '../lib/sites.ts';
import { playTick, primeTickSound } from '../lib/tick-sound.ts';
import { m } from '../paraglide/messages.js';
import { getLocale } from '../paraglide/runtime.js';

export const Route = createFileRoute('/')({
  component: Generator,
});

const STORAGE_KEY = 'kya:config';
const HOURS_KEY = 'kya:hours';
const SOUND_KEY = 'kya:sound';
const GENERATED_KEY = 'kya:generated';
/**
 * The one chromatic colour on the page. It is not a token: the palette's
 * error red is a warning, and this is a loss, so it stays pure in both themes.
 */
const ACCENT = '#ff4f00';
/**
 * The one display size on the page. Only the hero lines and the years the
 * habit costs are set in it; every other heading is one step down.
 */
const DISPLAY_SIZE = 'clamp(40px, 4.6vw, 56px)';
/** The air between two sections, wider than anything inside one. */
const SECTION_GAP = 96;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 10;
const SKELETON_ROWS = [0, 1, 2];
const FALLBACK_COUNTRY = 'us';
const REPO_URL = 'https://github.com/mertbuilds/keepyourattention';
const BUILDER_URL = 'https://mertbuilds.com';
const STARTER_URL = 'https://cleanstarter.dev';
const SUPERVISE_URL = '/supervise';
const STOPA_URL = 'https://stopa.io/post/297';
const READING_SPEED_URL = 'https://doi.org/10.1016/j.jml.2019.104047';
/**
 * The clip that shows where the real number lives. The video wins when it is
 * set, the gif is the fallback, and with neither the popover holds its
 * placeholder. Both widen to `string` so the other two branches keep
 * type-checking whichever one carries a url.
 */
const SCREEN_TIME_VIDEO_URL: string = '/media/screentime-v2.mp4';
const SCREEN_TIME_GIF_URL: string = '';
const PROFILE_MIME = 'application/x-apple-aspen-config';
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** How long an armed Remove waits for its second click before standing down. */
const REMOVE_CONFIRM_MS = 3000;
/** How long the Copy button holds its "Copied" label before standing down. */
const COPY_FEEDBACK_MS = 2000;
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
/** What the screen-time slider offers, in hours a day. */
const HOURS_MIN = 1;
const HOURS_MAX = 10;
const HOURS_STEP = 0.5;
const HOURS_DEFAULT = 2;
/** The machined knob, and the rail the ticks are measured against. */
const KNOB_WIDTH = 28;
const KNOB_HEIGHT = 44;
const TRACK_HEIGHT = 4;
/**
 * One detent per half hour of travel, each with the fraction of the rail it
 * sits at. The knob only ever stops on these, so the marks are the truth.
 */
const TICKS = Array.from({ length: (HOURS_MAX - HOURS_MIN) / HOURS_STEP + 1 }, (_, index) => {
  const value = HOURS_MIN + index * HOURS_STEP;
  return {
    at: (value - HOURS_MIN) / (HOURS_MAX - HOURS_MIN),
    value,
    whole: Number.isInteger(value),
  };
});

type WebMode = ProfileConfig['webFilter']['mode'];

/** Raw textarea buffers. The parsed arrays live in the config. */
type UrlText = { allowed: string; custom: string; permitted: string };

/**
 * What `kya:config` holds. The blocked sites are derived from the blocked
 * apps, so only the two lists that cannot be derived are stored next to the
 * config: the user's own urls, and the derived ones they turned off.
 */
type StoredState = {
  config: ProfileConfig;
  customSites: Array<string>;
  excludedSites: Array<string>;
};

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
  // The one colour on the page, and it is a loss, never a score.
  burn: {
    color: ACCENT,
  },
  checkbox: {
    accentColor: colors.fg,
    flexShrink: 0,
    height: 16,
    margin: 0,
    width: 16,
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
  // The control: rail and detents on the left, the number they read on the
  // right. On a phone the number drops under the rail instead of squeezing it.
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
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
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
    width: 320,
    zIndex: 20,
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
    textWrap: 'pretty',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: font.weightMedium,
    lineHeight: 1.4,
    margin: 0,
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
    letterSpacing: '-0.035em',
    lineHeight: 1.04,
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
    maxWidth: '60ch',
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
    color: ACCENT,
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
    letterSpacing: '-0.025em',
    lineHeight: 1.12,
    margin: 0,
    textWrap: 'balance',
  },
  mono: {
    color: colors.muted,
    fontFamily: MONOSPACE,
    fontSize: font.sizeSm,
  },
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: SECTION_GAP,
    minHeight: '100vh',
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s12,
    },
    paddingInline: spacing.s4,
  },
  playGlyph: {
    display: 'block',
    height: 28,
    width: 28,
  },
  pre: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    fontFamily: MONOSPACE,
    fontSize: font.sizeSm,
    margin: 0,
    maxHeight: 360,
    overflow: 'auto',
    padding: spacing.s3,
  },
  // Rides over the top-right corner of the XML and stays there while it scrolls.
  preCopy: {
    insetBlockStart: 8,
    insetInlineEnd: 8,
    position: 'absolute',
  },
  preWrap: {
    position: 'relative',
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
  // The instrument's own display: one number, monospaced, never reflowing.
  readout: {
    alignItems: 'baseline',
    display: 'flex',
    flexShrink: 0,
    gap: 4,
  },
  readoutRow: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: spacing.s2,
  },
  readoutUnit: {
    color: colors.muted,
    flexShrink: 0,
    fontFamily: MONOSPACE,
    fontSize: 20,
    fontWeight: font.weightMedium,
    lineHeight: 1,
  },
  // A half hour is one character wider than a whole one, so the box is sized
  // for the longest reading and the number is set against its right edge. The
  // rail beside it keeps its width while the knob moves.
  readoutValue: {
    flexShrink: 0,
    fontFamily: MONOSPACE,
    fontSize: 40,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    width: '5ch',
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
  siteEmpty: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    height: 28,
  },
  siteGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    minWidth: 0,
  },
  siteGroupArtwork: {
    borderRadius: 5,
    height: 20,
    width: 20,
  },
  siteGroupHead: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
    minWidth: 0,
  },
  siteGroupName: {
    fontWeight: font.weightMedium,
    overflowWrap: 'anywhere',
  },
  siteGroups: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      '@media (min-width: 640px)': '1fr 1fr',
      default: '1fr',
    },
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  siteHost: {
    fontFamily: MONOSPACE,
    fontSize: font.sizeSm,
    fontWeight: font.weightRegular,
    overflowWrap: 'anywhere',
  },
  // Unticked means the site is out of the filter, so it steps back.
  siteHostOff: {
    color: colors.muted,
  },
  siteHostOn: {
    color: colors.fg,
  },
  siteRow: {
    gap: spacing.s2,
    height: 28,
    minWidth: 0,
  },
  skeletonRow: {
    height: 40,
    width: '100%',
  },
  // The native input, dressed as a machined dial. The browser keeps the
  // keyboard, the detents and the screen reader; it gives up only its looks.
  slider: {
    '::-moz-range-thumb': {
      backgroundColor: colors.fg,
      backgroundImage: `linear-gradient(to right, transparent calc(50% - 0.5px), ${colors.bg} calc(50% - 0.5px), ${colors.bg} calc(50% + 0.5px), transparent calc(50% + 0.5px))`,
      borderRadius: 6,
      borderStyle: 'none',
      borderWidth: 0,
      boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.28), 0 1px 3px rgba(0, 0, 0, 0.24)',
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
    // A groove down the middle and a darker line around the edge: the two
    // marks that make a solid block read as a machined part.
    '::-webkit-slider-thumb': {
      appearance: 'none',
      backgroundColor: colors.fg,
      backgroundImage: `linear-gradient(to right, transparent calc(50% - 0.5px), ${colors.bg} calc(50% - 0.5px), ${colors.bg} calc(50% + 0.5px), transparent calc(50% + 0.5px))`,
      borderRadius: 6,
      boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.28), 0 1px 3px rgba(0, 0, 0, 0.24)',
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
      backgroundImage: `linear-gradient(to right, ${ACCENT} 0 ${percent}%, ${colors.border} ${percent}% 100%)`,
    },
    '::-webkit-slider-runnable-track': {
      backgroundImage: `linear-gradient(to right, ${ACCENT} 0 ${percent}%, ${colors.border} ${percent}% 100%)`,
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
  textarea: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.fg,
    fontFamily: MONOSPACE,
    fontSize: font.sizeSm,
    minHeight: 120,
    padding: spacing.s2,
    resize: 'vertical',
    width: '100%',
  },
  tick: {
    backgroundColor: colors.border,
    height: 5,
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
  tickWhole: {
    backgroundColor: colors.muted,
    height: 9,
  },
  tileArtwork: {
    borderRadius: 11,
    height: 48,
    width: 48,
  },
  titleRow: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
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

function parseLines(text: string): Array<string> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function urlTextOf(config: ProfileConfig, customSites: ReadonlyArray<string>): UrlText {
  const filter = config.webFilter;
  return {
    allowed: filter.mode === 'allow' ? filter.allowedUrls.join('\n') : '',
    custom: customSites.join('\n'),
    permitted: filter.mode === 'deny' ? filter.permittedUrls.join('\n') : '',
  };
}

/** A site as a chip names it: `https://youtu.be` is youtu.be. */
function siteLabel(url: string): string {
  return url.replace(SITE_SCHEME, '');
}

/**
 * What the deny list actually blocks: every site the blocked apps imply,
 * minus the ones the user turned off, then their own urls. Listed once each,
 * in that order.
 */
function deniedUrlsOf(
  apps: ReadonlyArray<BlockedApp>,
  customSites: ReadonlyArray<string>,
  excludedSites: ReadonlyArray<string>,
): Array<string> {
  const excluded = new Set(excludedSites);
  const urls = new Set(sitesForApps(apps).filter((site) => !excluded.has(site)));
  for (const site of customSites) {
    const url = normalizeUrl(site);
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
  customSites: ReadonlyArray<string>,
  excludedSites: ReadonlyArray<string>,
): ProfileConfig {
  const filter = config.webFilter;
  if (filter.mode !== 'deny') {
    return config;
  }
  return {
    ...config,
    webFilter: {
      ...filter,
      deniedUrls: deniedUrlsOf(config.blockedApps, customSites, excludedSites),
    },
  };
}

/**
 * The urls a config stored before sites were derived: everything its own apps
 * now imply comes back on its own, so only the rest stays the user's list.
 */
function customSitesOf(config: ProfileConfig): Array<string> {
  const filter = config.webFilter;
  if (filter.mode !== 'deny') {
    return [];
  }
  const derived = new Set(sitesForApps(config.blockedApps));
  return filter.deniedUrls
    .map((url) => normalizeUrl(url))
    .filter((url) => url !== '' && !derived.has(url));
}

function readStored(): StoredState | null {
  let value: unknown;
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const stored = value as Partial<StoredState>;
  if (stored.config !== undefined) {
    return {
      config: stored.config,
      customSites: stored.customSites ?? [],
      excludedSites: stored.excludedSites ?? [],
    };
  }
  // A bare config predates the derived sites: migrate it in place.
  const config = value as ProfileConfig;
  return { config, customSites: customSitesOf(config), excludedSites: [] };
}

function writeStored(state: StoredState): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota must not break the generator.
  }
}

/** The remembered slider value, or `null` when nothing usable is stored. */
function readHours(): number | null {
  try {
    const stored = globalThis.localStorage.getItem(HOURS_KEY);
    if (stored === null) {
      return null;
    }
    const hours = Number(stored);
    return Number.isFinite(hours) && hours >= HOURS_MIN && hours <= HOURS_MAX ? hours : null;
  } catch {
    return null;
  }
}

function writeHours(hours: number): void {
  try {
    globalThis.localStorage.setItem(HOURS_KEY, String(hours));
  } catch {
    // Private mode or a full quota must not break the slider.
  }
}

/** The remembered speaker choice, or `null` when the reader never made one. */
function readSound(): boolean | null {
  try {
    const stored = globalThis.localStorage.getItem(SOUND_KEY);
    return stored === null ? null : stored === 'true';
  } catch {
    return null;
  }
}

function writeSound(on: boolean): void {
  try {
    globalThis.localStorage.setItem(SOUND_KEY, String(on));
  } catch {
    // Private mode or a full quota must not break the slider.
  }
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

/** Whether this reader has already downloaded or copied a profile. */
function readGenerated(): boolean {
  try {
    return globalThis.localStorage.getItem(GENERATED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeGenerated(): void {
  try {
    globalThis.localStorage.setItem(GENERATED_KEY, 'true');
  } catch {
    // Private mode or a full quota must not break the generator.
  }
}

/** The browser's own storefront, but only if the picker offers it. */
function initialStorefront(): string {
  const code = defaultStorefront();
  return storefronts.some((storefront) => storefront.code === code) ? code : FALLBACK_COUNTRY;
}

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

/**
 * The question mark at the end of the question. Hover, focus or a tap opens a
 * popover that says where the real number lives and, once the clip is shot,
 * shows it being found. A pointer that leaves gets a moment to reach the
 * popover before it closes, because the two do not touch.
 */
function ScreenTimeHelp() {
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

  // Dismissed from outside itself: a pointer anywhere else, or Escape.
  useEffect(() => {
    if (!open) {
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
  }, [open]);

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
        if (event.pointerType !== 'touch') {
          show();
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') {
          hideAfterGrace();
        }
      }}
      ref={wrap}
      {...props(styles.helpWrap)}
    >
      <button
        aria-describedby={open ? popoverId : undefined}
        aria-label={m.home_math_help_label()}
        onBlur={hide}
        onClick={show}
        onFocus={show}
        type="button"
        {...props(styles.helpButton)}
      >
        ?
      </button>
      {open ? (
        <span id={popoverId} role="tooltip" {...props(styles.helpPopover)}>
          <span {...props(styles.helpTitle)}>{m.home_math_help_title()}</span>
          <span {...props(styles.helpText)}>{m.home_math_help_body()}</span>
          <span {...props(styles.helpSlot)}>
            {SCREEN_TIME_VIDEO_URL === '' ? (
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
                loop
                muted
                playsInline
                preload="metadata"
                src={SCREEN_TIME_VIDEO_URL}
                {...props(styles.helpMedia)}
              />
            )}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function Generator() {
  // What the reader tells the math section their day looks like.
  const [hours, setHours] = useState(HOURS_DEFAULT);
  // The detents click by default, and remember it once the reader says either
  // way. `soundChosen` is what separates the default from an answer.
  const [sound, setSound] = useState(true);
  const [soundChosen, setSoundChosen] = useState(false);
  const [config, setConfig] = useState<ProfileConfig>(presets.mert);
  // The user's own urls, and the derived ones they turned off. Everything else
  // in the deny list comes from the blocked apps.
  const [customSites, setCustomSites] = useState<Array<string>>([]);
  const [excludedSites, setExcludedSites] = useState<Array<string>>([]);
  const [urlText, setUrlText] = useState<UrlText>(urlTextOf(presets.mert, []));
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
  const [showXml, setShowXml] = useState(false);
  const [copyState, setCopyState] = useState<'copied' | 'fallback' | 'idle'>('idle');
  // There is nothing to brag about until a profile has left the page.
  const [generated, setGenerated] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // The years the link that brought the reader here was bragging about. It is
  // the friend's number, so the reader's own slider never rewrites it.
  const [friendYears, setFriendYears] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchWrap = useRef<HTMLDivElement>(null);
  const storefrontFilter = useRef<HTMLInputElement>(null);
  const storefrontMenu = useRef<HTMLDivElement>(null);
  const xmlBlock = useRef<HTMLPreElement>(null);
  // The dialog opens itself once. After that the reader asks for it.
  const sharePrompted = useRef(false);

  const effectiveConfig = useMemo(
    () => withDerivedSites(config, customSites, excludedSites),
    [config, customSites, excludedSites],
  );
  const xml = useMemo(() => safeBuild(effectiveConfig), [effectiveConfig]);
  // One row per blocked app, so the chips can say which app brought which site.
  const appSites = useMemo(
    () =>
      config.blockedApps.map((app) => ({
        app,
        sites: sitesForApp(app.bundleId, app.sellerUrl).sites.map((site) => normalizeUrl(site)),
      })),
    [config.blockedApps],
  );
  const derivedCount = useMemo(() => {
    const excluded = new Set(excludedSites);
    return sitesForApps(config.blockedApps).filter((site) => !excluded.has(site)).length;
  }, [config.blockedApps, excludedSites]);
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

  // localStorage and navigator exist only in the browser: reading either during
  // render would desync the SSR HTML from the first client render. Adopting
  // what they hold IS synchronizing with an external system, the one case the
  // rule leaves to an effect, and it runs once, so nothing cascades.
  /* oxlint-disable react/set-state-in-effect -- one-shot restore from browser-only storage */
  useEffect(() => {
    const stored = readStored();
    const shared = decodeShare(globalThis.location.search);
    if (stored !== null) {
      // Identity is no longer editable, so a config saved while it was must not
      // carry its own values back in.
      const restored = {
        ...stored.config,
        displayName: presets.mert.displayName,
        identifier: presets.mert.identifier,
        organization: presets.mert.organization,
      };
      setConfig(restored);
      setCustomSites(stored.customSites);
      setExcludedSites(stored.excludedSites);
      setUrlText(urlTextOf(restored, stored.customSites));
    } else if (shared.bundleIds.length > 0) {
      // A shared list is a suggestion, not the reader's own work: it is not
      // written to storage until they change something themselves.
      setConfig({ ...presets.mert, blockedApps: shared.bundleIds.map(sharedApp) });
    }
    const storedHours = readHours();
    if (shared.hours !== undefined) {
      setHours(shared.hours);
      setFriendYears(formatYears(shared.hours));
    } else if (storedHours !== null) {
      setHours(storedHours);
    }
    const storedSound = readSound();
    if (storedSound !== null) {
      setSound(storedSound);
      setSoundChosen(true);
    }
    if (readGenerated()) {
      setGenerated(true);
    }
    const preferred = initialStorefront();
    if (preferred !== FALLBACK_COUNTRY) {
      setCountry(preferred);
    }
  }, []);
  /* oxlint-enable react/set-state-in-effect */

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

  // "Copied" is the whole receipt for a copy, so it goes back to "Copy" on its
  // own. A failed copy keeps its label: the clipboard is still out of reach.
  useEffect(() => {
    if (copyState !== 'copied') {
      return;
    }
    const timer = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  // The three pieces are stored together, so every change writes all of them.
  function persist(
    nextConfig: ProfileConfig,
    nextCustom: ReadonlyArray<string>,
    nextExcluded: ReadonlyArray<string>,
  ) {
    writeStored({
      config: withDerivedSites(nextConfig, nextCustom, nextExcluded),
      customSites: [...nextCustom],
      excludedSites: [...nextExcluded],
    });
  }

  function update(next: ProfileConfig) {
    setConfig(next);
    persist(next, customSites, excludedSites);
  }

  function onHoursChange(value: number) {
    // One click per detent, and a lower one where the travel runs out.
    if (value !== hours && tickAllowed(sound, soundChosen)) {
      primeTickSound();
      playTick({ end: value === HOURS_MIN || value === HOURS_MAX });
    }
    setHours(value);
    writeHours(value);
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
    writeSound(next);
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
    update({
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
      update({
        ...config,
        blockedApps: config.blockedApps.filter((app) => app.bundleId !== bundleId),
      });
      return;
    }
    setArmedRemove(bundleId);
  }

  // The same two-step, on the whole list: one click arms, the next resets. Only
  // the blocked apps go back; the rest of the config is the user's own work.
  function onResetClick() {
    if (armedRemove === RESET_ARMED) {
      setArmedRemove(null);
      update({ ...config, blockedApps: [...presets.mert.blockedApps] });
      return;
    }
    setArmedRemove(RESET_ARMED);
  }

  function setWebMode(mode: WebMode) {
    if (mode === 'deny') {
      update({
        ...config,
        webFilter: {
          // Derived, and written in by `withDerivedSites` on the way out.
          deniedUrls: [],
          mode,
          permittedUrls: parseLines(urlText.permitted),
        },
      });
      return;
    }
    if (mode === 'allow') {
      update({ ...config, webFilter: { allowedUrls: parseLines(urlText.allowed), mode } });
      return;
    }
    update({ ...config, webFilter: { mode } });
  }

  function onCustomChange(text: string) {
    const next = parseLines(text);
    setUrlText({ ...urlText, custom: text });
    setCustomSites(next);
    persist(config, next, excludedSites);
  }

  // A derived site the user turns off stays off while its app stays blocked,
  // so the exclusion is remembered by url, not by app.
  function toggleSite(site: string) {
    const next = excludedSites.includes(site)
      ? excludedSites.filter((url) => url !== site)
      : [...excludedSites, site];
    setExcludedSites(next);
    persist(config, customSites, next);
  }

  function onPermittedChange(text: string) {
    setUrlText({ ...urlText, permitted: text });
    const filter = config.webFilter;
    if (filter.mode === 'deny') {
      update({ ...config, webFilter: { ...filter, permittedUrls: parseLines(text) } });
    }
  }

  function onAllowedChange(text: string) {
    setUrlText({ ...urlText, allowed: text });
    const filter = config.webFilter;
    if (filter.mode === 'allow') {
      update({ ...config, webFilter: { ...filter, allowedUrls: parseLines(text) } });
    }
  }

  /**
   * A profile has left the page, by download or by clipboard. That is the
   * moment the share dialog is worth showing, and it shows itself only the
   * first time in a session: the button under the profile reopens it.
   */
  function markGenerated() {
    setGenerated(true);
    writeGenerated();
    if (!sharePrompted.current) {
      sharePrompted.current = true;
      setShareOpen(true);
    }
  }

  function download() {
    if (xml === null) {
      return;
    }
    const url = URL.createObjectURL(new Blob([xml], { type: PROFILE_MIME }));
    const anchor = document.createElement('a');
    anchor.download = `${config.identifier}.mobileconfig`;
    anchor.href = url;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    markGenerated();
  }

  // Dragging a selection across a scrolling block is miserable, so one click
  // anywhere in it takes the whole thing.
  function selectXml() {
    const block = xmlBlock.current;
    const selection = window.getSelection();
    if (block === null || selection === null) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(block);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // No clipboard at all (insecure origin) and a denied one both land here: the
  // XML gets selected instead, so Cmd+C still carries it out.
  async function copyXml() {
    if (xml === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(xml);
      setCopyState('copied');
      markGenerated();
    } catch {
      selectXml();
      setCopyState('fallback');
    }
  }

  // The derived list is what the profile carries, so it is what the card counts.
  const filter = effectiveConfig.webFilter;
  // Only a deny list "blocks sites"; an allow list blocks everything else.
  const blockedSites = filter.mode === 'deny' ? filter.deniedUrls.length : 0;
  const siteSummary =
    filter.mode === 'deny'
      ? m.gen_summary_sites_blocked({ count: filter.deniedUrls.length })
      : filter.mode === 'allow'
        ? m.gen_summary_sites_allowed({ count: filter.allowedUrls.length })
        : m.gen_summary_sites_none();

  const copyLabel =
    copyState === 'copied'
      ? m.gen_copied()
      : copyState === 'fallback'
        ? m.gen_copy_fallback()
        : m.gen_copy();

  // The number the whole narrative is written around.
  const years = formatYears(hours);
  // How far along the rail the dial has been turned, and what it has cost.
  const travelled = ((hours - HOURS_MIN) / (HOURS_MAX - HOURS_MIN)) * 100;
  const ledger = ledgerItems(hours, getLocale());

  // What the whole thing costs, as three numbers and the word each one means.
  const dealTiles = [
    { label: m.home_deal_apps_label(), value: m.home_deal_apps_value() },
    { label: m.home_deal_price_label(), value: m.home_deal_price_value() },
    { label: m.home_deal_time_label(), value: m.home_deal_time_value() },
  ];

  const howItWorks = [
    { body: m.home_how_profile_body(), guide: false, title: m.home_how_profile_title() },
    { body: m.home_how_websites_body(), guide: false, title: m.home_how_websites_title() },
    { body: m.home_how_apps_body(), guide: false, title: m.home_how_apps_title() },
    { body: m.home_how_supervision_body(), guide: true, title: m.home_how_supervision_title() },
  ];

  const proofPoints = [
    { body: m.home_proof_months_body(), title: m.home_proof_months_title() },
    { body: m.home_proof_minutes_body(), title: m.home_proof_minutes_title() },
    { body: m.home_proof_blocked_body(), title: m.home_proof_blocked_title() },
  ];

  const objections = [
    { desc: m.home_faq_data_desc(), term: m.home_faq_data_term() },
    { desc: m.home_faq_undo_desc(), term: m.home_faq_undo_term() },
    { desc: m.home_faq_updates_desc(), term: m.home_faq_updates_term() },
    { desc: m.home_faq_keep_desc(), term: m.home_faq_keep_term() },
    { desc: m.home_faq_apple_desc(), term: m.home_faq_apple_term() },
    { desc: m.home_faq_mac_desc(), term: m.home_faq_mac_term() },
  ];

  return (
    <main {...props(styles.page)}>
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
                <input
                  max={HOURS_MAX}
                  min={HOURS_MIN}
                  onChange={(event) => onHoursChange(Number(event.target.value))}
                  onPointerDown={armSound}
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
                  <span
                    key={tick.value}
                    {...props(styles.tick, tick.whole && styles.tickWhole, styles.tickAt(tick.at))}
                  >
                    {tick.whole ? <span {...props(styles.tickNumber)}>{tick.value}</span> : null}
                  </span>
                ))}
              </div>
            </div>
            <div {...props(styles.readoutRow)}>
              <span {...props(styles.readout)}>
                <span {...props(styles.readoutValue)}>{m.home_math_hours({ hours })}</span>
                <span {...props(styles.readoutUnit)}>{m.home_math_hours_unit()}</span>
              </span>
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
          </div>
          {/* The years are the loss, so they are the only colour in the line. */}
          <p {...props(styles.mathResult)}>
            {m.home_math_result_before()} <span {...props(styles.burn)}>{years}</span>{' '}
            {m.home_math_result_after()}
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
          <p {...props(layout.muted)}>
            {m.home_proof_lineage()}{' '}
            <a href={STOPA_URL} rel="noreferrer" target="_blank">
              {m.home_proof_lineage_link()}
            </a>
          </p>
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

        <h2 {...props(styles.sectionTitle)}>{m.home_tool_title()}</h2>

        <section {...props(styles.section)}>
          <div {...props(styles.titleRow)}>
            <h2 {...props(styles.sectionTitle)}>{m.home_apps_title()}</h2>
            <Badge variant="outline">{m.gen_needs_supervision()}</Badge>
          </div>
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
                          <span title={app.bundleId} {...props(styles.mono, styles.truncate)}>
                            {app.bundleId}
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
                  <span title={app.bundleId} {...props(styles.mono, styles.truncate)}>
                    {app.bundleId}
                  </span>
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
                {...props(styles.checkbox)}
              />
              {m.gen_web_mode_deny()}
            </Label>
            <Label>
              <input
                checked={filter.mode === 'allow'}
                name="web-mode"
                onChange={() => setWebMode('allow')}
                type="radio"
                {...props(styles.checkbox)}
              />
              {m.gen_web_mode_allow()}
            </Label>
            <Label>
              <input
                checked={filter.mode === 'off'}
                name="web-mode"
                onChange={() => setWebMode('off')}
                type="radio"
                {...props(styles.checkbox)}
              />
              {m.gen_web_mode_off()}
            </Label>
          </div>
          {filter.mode === 'deny' ? (
            <div {...props(styles.section)}>
              <h3 {...props(styles.label)}>{m.gen_web_derived_title()}</h3>
              <p {...props(layout.muted)}>{m.gen_web_derived_count({ count: derivedCount })}</p>
              <ul {...props(styles.siteGroups)}>
                {appSites.map(({ app, sites }) => (
                  <li key={app.bundleId} {...props(styles.siteGroup)}>
                    <span {...props(styles.siteGroupHead)}>
                      <AppArtwork
                        meta={meta[app.bundleId]}
                        name={app.name}
                        style={styles.siteGroupArtwork}
                      />
                      <span {...props(styles.siteGroupName)}>{app.name}</span>
                    </span>
                    {sites.length === 0 ? (
                      <span {...props(styles.siteEmpty)}>{m.gen_web_derived_none()}</span>
                    ) : (
                      sites.map((site) => (
                        <Label key={site} style={styles.siteRow}>
                          <input
                            checked={!excludedSites.includes(site)}
                            onChange={() => toggleSite(site)}
                            type="checkbox"
                            {...props(styles.checkbox)}
                          />
                          <span
                            {...props(
                              styles.siteHost,
                              excludedSites.includes(site) ? styles.siteHostOff : styles.siteHostOn,
                            )}
                          >
                            {siteLabel(site)}
                          </span>
                        </Label>
                      ))
                    )}
                  </li>
                ))}
              </ul>
              <Field>
                <FieldLabel htmlFor="custom-urls">{m.gen_web_custom_label()}</FieldLabel>
                <textarea
                  id="custom-urls"
                  onChange={(event) => onCustomChange(event.target.value)}
                  value={urlText.custom}
                  {...props(styles.textarea)}
                />
                <FieldDescription>{m.gen_web_custom_help()}</FieldDescription>
              </Field>
            </div>
          ) : null}
          {filter.mode === 'deny' ? (
            <Field>
              <FieldLabel htmlFor="permitted-urls">{m.gen_web_permitted_label()}</FieldLabel>
              <textarea
                id="permitted-urls"
                onChange={(event) => onPermittedChange(event.target.value)}
                value={urlText.permitted}
                {...props(styles.textarea)}
              />
              <FieldDescription>{m.gen_web_lines_help()}</FieldDescription>
            </Field>
          ) : null}
          {filter.mode === 'allow' ? (
            <Field>
              <FieldLabel htmlFor="allowed-urls">{m.gen_web_allowed_label()}</FieldLabel>
              <textarea
                id="allowed-urls"
                onChange={(event) => onAllowedChange(event.target.value)}
                value={urlText.allowed}
                {...props(styles.textarea)}
              />
              <FieldDescription>{m.gen_web_lines_help()}</FieldDescription>
            </Field>
          ) : null}
          {filter.mode === 'deny' ? (
            <Label>
              <input
                checked={config.autoFilterAdult}
                onChange={(event) => update({ ...config, autoFilterAdult: event.target.checked })}
                type="checkbox"
                {...props(styles.checkbox)}
              />
              {m.gen_web_auto_filter()}
            </Label>
          ) : null}
          {filter.mode === 'off' ? null : (
            <div {...props(styles.titleRow)}>
              <Label>
                <input
                  checked={config.allowPrivateBrowsing}
                  onChange={(event) =>
                    update({ ...config, allowPrivateBrowsing: event.target.checked })
                  }
                  type="checkbox"
                  {...props(styles.checkbox)}
                />
                {m.gen_web_private_browsing()}
              </Label>
              <Badge variant="outline">{m.gen_needs_supervision()}</Badge>
            </div>
          )}
        </section>

        <section {...props(styles.section)}>
          <div {...props(styles.titleRow)}>
            <h2 {...props(styles.sectionTitle)}>{m.gen_restrictions_title()}</h2>
            <Badge variant="outline">{m.gen_needs_supervision()}</Badge>
          </div>
          <div {...props(styles.choice)}>
            <Label>
              <input
                checked={config.allowAppStore}
                onChange={(event) => update({ ...config, allowAppStore: event.target.checked })}
                type="checkbox"
                {...props(styles.checkbox)}
              />
              {m.gen_allow_app_store()}
            </Label>
            <p {...props(layout.muted)}>{m.gen_allow_app_store_help()}</p>
          </div>
          <div {...props(styles.choice)}>
            <Label>
              <input
                checked={config.lockRemoval}
                onChange={(event) => update({ ...config, lockRemoval: event.target.checked })}
                type="checkbox"
                {...props(styles.checkbox)}
              />
              {m.gen_lock_removal()}
            </Label>
            <p {...props(layout.muted)}>{m.gen_lock_removal_help()}</p>
          </div>
        </section>

        <section {...props(styles.section)}>
          <Card>
            <CardHeader>
              <CardTitle style={styles.sectionTitle}>{m.gen_output_title()}</CardTitle>
            </CardHeader>
            <CardContent {...props(styles.section)}>
              <ul {...props(styles.list)}>
                <li>{m.gen_summary_apps({ count: config.blockedApps.length })}</li>
                <li>{siteSummary}</li>
                <li>
                  {config.allowAppStore
                    ? m.gen_summary_app_store_on()
                    : m.gen_summary_app_store_off()}
                </li>
                <li>
                  {config.lockRemoval ? m.gen_summary_locked_on() : m.gen_summary_locked_off()}
                </li>
              </ul>
              {blockedSites > 0 ? (
                <p {...props(layout.muted)}>{m.gen_summary_tier({ sites: blockedSites })}</p>
              ) : null}
              <div {...props(styles.row)}>
                <Button disabled={xml === null} onClick={download}>
                  {m.gen_download()}
                </Button>
                <Button onClick={() => setShowXml(!showXml)} variant="outline">
                  {showXml ? m.gen_hide_xml() : m.gen_show_xml()}
                </Button>
                {generated ? (
                  <Button onClick={() => setShareOpen(true)} variant="outline">
                    {m.share_reopen()}
                  </Button>
                ) : null}
              </div>
              {showXml && xml !== null ? (
                <div {...props(styles.preWrap)}>
                  <pre onClick={selectXml} ref={xmlBlock} {...props(styles.pre)}>
                    {xml}
                  </pre>
                  <Button onClick={() => void copyXml()} style={styles.preCopy} variant="outline">
                    {copyLabel}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <h3 {...props(styles.sectionTitle)}>{m.gen_install_title()}</h3>
          <ol {...props(styles.steps)}>
            <li>{m.gen_install_step_transfer()}</li>
            <li>{m.gen_install_step_settings()}</li>
            <li>{m.gen_install_step_reboot()}</li>
            <li>{m.gen_install_step_unsupervised()}</li>
          </ol>
          <p {...props(layout.muted)}>{m.gen_install_note()}</p>
        </section>

        <Dialog onOpenChange={setShareOpen} open={shareOpen}>
          <DialogContent style={styles.shareDialog}>
            <DialogHeader>
              <DialogTitle style={styles.sectionTitle}>{m.share_heading_output()}</DialogTitle>
            </DialogHeader>
            <ShareCard apps={config.blockedApps} hours={hours} meta={meta} years={years} />
          </DialogContent>
        </Dialog>

        <footer {...props(styles.footer)}>
          <p {...props(layout.muted)}>
            {m.gen_footer_open_source()}{' '}
            <a href={REPO_URL} rel="noreferrer" target="_blank">
              {m.gen_footer_repo()}
            </a>
          </p>
          <p {...props(layout.muted)}>
            {m.gen_footer_built_by()}{' '}
            <a href={BUILDER_URL} rel="noreferrer" target="_blank">
              {m.gen_footer_builder()}
            </a>{' '}
            {m.gen_footer_built_with()}{' '}
            <a href={STARTER_URL} rel="noreferrer" target="_blank">
              {m.gen_footer_starter()}
            </a>
          </p>
          <p {...props(layout.muted)}>{m.gen_footer_not_apple()}</p>
          <Preferences />
        </footer>
      </div>
    </main>
  );
}
