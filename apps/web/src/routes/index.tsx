import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Label,
  Skeleton,
} from '@keepyourattention/ui';
import { colors, font, radius, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
import { layout } from '../lib/layout.ts';
import { buildProfile, presets } from '../lib/profile/index.ts';
import type { BlockedApp, ProfileConfig } from '../lib/profile/index.ts';
import { normalizeUrl, sitesForApp, sitesForApps } from '../lib/sites.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/')({
  component: Generator,
});

const STORAGE_KEY = 'kya:config';
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 10;
const SKELETON_ROWS = [0, 1, 2];
const FALLBACK_COUNTRY = 'us';
const REPO_URL = 'https://github.com/mertbuilds/keepyourattention';
const BUILDER_URL = 'https://mertbuilds.com';
const STARTER_URL = 'https://cleanstarter.dev';
const SUPERVISE_URL = '/supervise';
const PROFILE_MIME = 'application/x-apple-aspen-config';
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** Above every other icon in the fan, whatever the stack order says. */
const POPPED_DEPTH = 99;
/** How long an armed Remove waits for its second click before standing down. */
const REMOVE_CONFIRM_MS = 3000;
/** How long the Copy button holds its "Copied" label before standing down. */
const COPY_FEEDBACK_MS = 2000;
/**
 * The armed control is tracked by id, and the reset link needs one too. A colon
 * is not legal in a bundle id, so this can never collide with an app's row.
 */
const RESET_ARMED = 'reset:apps';
/** A chip names a host; the scheme carries nothing the user needs to read. */
const SITE_SCHEME = /^https?:\/\//u;

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

/**
 * What the App Store knows about one blocked app. The config stores only a
 * bundle id and a name, so artwork and developer are fetched and cached here:
 * `undefined` is still loading, `null` is a storefront that has no such app.
 */
type AppMeta = { developer: string; iconUrl: string };
type MetaCache = Record<string, AppMeta | null>;

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
  artwork: {
    borderColor: colors.border,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'block',
    flexShrink: 0,
    objectFit: 'cover',
  },
  artworkInitials: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    justifyContent: 'center',
    letterSpacing: '0.02em',
    lineHeight: 1,
  },
  artworkPending: {
    backgroundColor: colors.border,
  },
  checkbox: {
    accentColor: colors.fg,
    flexShrink: 0,
    height: 16,
    margin: 0,
    width: 16,
  },
  // One site of one app. The same pill whether it is a button or, for an app
  // with no known site, a plain label.
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: {
      ':focus-visible': `0 0 0 3px ${colors.border}`,
      default: 'none',
    },
    display: 'inline-flex',
    fontFamily: 'inherit',
    fontSize: font.sizeSm,
    lineHeight: 1,
    outlineStyle: 'none',
    paddingBlock: 6,
    paddingInline: spacing.s2,
  },
  chipArtwork: {
    borderRadius: 5,
    height: 20,
    width: 20,
  },
  chipEmpty: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    color: colors.muted,
  },
  // Off means the site is out of the filter, so it reads as struck out.
  chipOff: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    color: colors.muted,
    cursor: 'pointer',
    textDecorationLine: 'line-through',
  },
  chipOn: {
    backgroundColor: colors.fg,
    borderColor: colors.fg,
    color: colors.bg,
    cursor: 'pointer',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s1,
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
    gap: spacing.s16,
    maxWidth: 760,
    width: '100%',
  },
  derivedTitle: {
    color: colors.muted,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  fan: {
    alignItems: 'center',
    display: 'inline-flex',
    marginInline: '0.3em',
    verticalAlign: 'middle',
  },
  fanArtwork: {
    borderRadius: 9,
    height: {
      '@media (min-width: 640px)': 40,
      default: 32,
    },
    width: {
      '@media (min-width: 640px)': 40,
      default: 32,
    },
  },
  fanHeadline: {
    fontSize: 'clamp(22px, 3.2vw, 28px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    lineHeight: 1.6,
    margin: 0,
    textWrap: 'balance',
  },
  fanItem: {
    backgroundColor: 'transparent',
    borderRadius: 9,
    borderStyle: 'none',
    borderWidth: 0,
    boxShadow: {
      ':focus-visible': `0 0 0 3px ${colors.muted}`,
      default: null,
    },
    cursor: 'pointer',
    display: 'block',
    lineHeight: 0,
    margin: 0,
    outlineStyle: 'none',
    padding: 0,
    position: 'relative',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '220ms',
    },
    transitionProperty: 'transform',
    transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  fanNudgeEnd: {
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'translateX(4px)',
    },
  },
  fanNudgeStart: {
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'translateX(-4px)',
    },
  },
  fanOverlap: {
    marginInlineStart: {
      '@media (min-width: 640px)': -24,
      default: -19,
    },
  },
  fanPop: {
    transform: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: 'translateY(-8px) scale(1.15)',
    },
  },
  fanStack: (depth: number) => ({
    zIndex: depth,
  }),
  // Rides inside the popped icon, so it keeps its 8px gap through the pop.
  fanTooltip: {
    backgroundColor: colors.fg,
    borderRadius: 999,
    color: colors.bg,
    fontSize: 12,
    fontWeight: font.weightRegular,
    insetBlockEnd: 'calc(100% + 8px)',
    insetInlineStart: '50%',
    lineHeight: 1.4,
    paddingBlock: 4,
    paddingInline: 8,
    pointerEvents: 'none',
    position: 'absolute',
    transform: 'translateX(-50%)',
    whiteSpace: 'nowrap',
    zIndex: 1,
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  // Same column as `content`, so the hero and every section share a left edge.
  hero: {
    maxWidth: 760,
    width: '100%',
  },
  heroQuiet: {
    color: colors.muted,
  },
  heroTitle: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 'clamp(36px, 6.4vw, 54px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.035em',
    lineHeight: 1.04,
    margin: 0,
    textWrap: 'balance',
  },
  lead: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
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
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    minHeight: '100vh',
    paddingBlockEnd: spacing.s16,
    paddingBlockStart: {
      '@media (min-width: 640px)': 96,
      default: spacing.s12,
    },
    paddingInline: spacing.s4,
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
    gap: spacing.s3,
  },
  sectionTitle: {
    fontSize: 'clamp(22px, 3.2vw, 28px)',
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    margin: 0,
    textWrap: 'balance',
  },
  siteGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    minWidth: 0,
  },
  siteGroupHead: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
    minWidth: 0,
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
  skeletonRow: {
    height: 40,
    width: '100%',
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
  subTitle: {
    fontSize: font.sizeLg,
    fontWeight: font.weightBold,
    letterSpacing: '-0.01em',
    margin: 0,
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

/** The browser's own storefront, but only if the picker offers it. */
function initialStorefront(): string {
  const code = defaultStorefront();
  return storefronts.some((storefront) => storefront.code === code) ? code : FALLBACK_COUNTRY;
}

/** Stand-in artwork for an app the App Store did not answer for. */
function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
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

/** Apple's own icon, a neutral tile while it loads, initials when it never comes. */
function AppArtwork({
  meta,
  name,
  style,
}: {
  meta: AppMeta | null | undefined;
  name: string;
  style: StyleXStyles;
}) {
  if (meta === undefined) {
    return <span {...props(styles.artwork, styles.artworkPending, style)} />;
  }
  if (meta === null || meta.iconUrl === '') {
    return <span {...props(styles.artwork, styles.artworkInitials, style)}>{initials(name)}</span>;
  }
  return <img alt={name} src={meta.iconUrl} {...props(styles.artwork, style)} />;
}

/**
 * The blocked apps as a stack of cards. Hover pops one icon to the front and
 * eases its neighbours aside; touch, which has no hover, toggles the same pop
 * on tap. The popped icon names itself in a tooltip, so the fan reads without
 * a pointer resting on it. Only one icon pops, so one tooltip id is enough.
 */
function AppIconFan({ apps, meta }: { apps: ReadonlyArray<BlockedApp>; meta: MetaCache }) {
  const [popped, setPopped] = useState<string | null>(null);
  const tooltipId = useId();
  const poppedIndex = apps.findIndex((app) => app.bundleId === popped);
  const hasPop = poppedIndex !== -1;

  return (
    <span {...props(styles.fan)}>
      {apps.map((app, index) => (
        <button
          aria-describedby={popped === app.bundleId ? tooltipId : undefined}
          aria-label={app.name}
          key={app.bundleId}
          onBlur={() => setPopped(null)}
          onFocus={() => setPopped(app.bundleId)}
          onPointerEnter={(event) => {
            if (event.pointerType !== 'touch') {
              setPopped(app.bundleId);
            }
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== 'touch') {
              setPopped(null);
            }
          }}
          onPointerUp={(event) => {
            // A touch never hovers, so the tap itself is the toggle.
            if (event.pointerType === 'touch') {
              setPopped(popped === app.bundleId ? null : app.bundleId);
            }
          }}
          type="button"
          {...props(
            styles.fanItem,
            index > 0 && styles.fanOverlap,
            // Earlier icons overlap later ones: the first app owns the top of
            // the stack, the last one the bottom.
            styles.fanStack(popped === app.bundleId ? POPPED_DEPTH : apps.length - index),
            popped === app.bundleId && styles.fanPop,
            hasPop && poppedIndex === index + 1 && styles.fanNudgeStart,
            hasPop && poppedIndex === index - 1 && styles.fanNudgeEnd,
          )}
        >
          <AppArtwork meta={meta[app.bundleId]} name={app.name} style={styles.fanArtwork} />
          {popped === app.bundleId ? (
            <span id={tooltipId} role="tooltip" {...props(styles.fanTooltip)}>
              {app.name}
            </span>
          ) : null}
        </button>
      ))}
    </span>
  );
}

function Generator() {
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
  const searchInput = useRef<HTMLInputElement>(null);
  const searchWrap = useRef<HTMLDivElement>(null);
  const storefrontFilter = useRef<HTMLInputElement>(null);
  const storefrontMenu = useRef<HTMLDivElement>(null);
  const xmlBlock = useRef<HTMLPreElement>(null);

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

  const howItWorks = [
    { body: m.home_how_profile_body(), guide: false, title: m.home_how_profile_title() },
    { body: m.home_how_websites_body(), guide: false, title: m.home_how_websites_title() },
    { body: m.home_how_apps_body(), guide: false, title: m.home_how_apps_title() },
    { body: m.home_how_supervision_body(), guide: true, title: m.home_how_supervision_title() },
  ];

  return (
    <main {...props(styles.page)}>
      <header {...props(styles.hero)}>
        <h1 {...props(styles.heroTitle)}>
          <span>{m.home_hero_line_1()}</span>
          <span {...props(styles.heroQuiet)}>{m.home_hero_line_2()}</span>
        </h1>
      </header>

      <div {...props(styles.content)}>
        <section {...props(styles.section)}>
          <h2 {...props(styles.fanHeadline)}>
            {m.home_fan_before()}
            {config.blockedApps.length === 0 ? (
              <span {...props(styles.fan)}>{m.home_fan_empty()}</span>
            ) : (
              <AppIconFan apps={config.blockedApps} meta={meta} />
            )}
            {m.home_fan_after()}
          </h2>
        </section>

        <section {...props(styles.section)}>
          <p {...props(styles.lead)}>{m.home_intro_1()}</p>
          <p {...props(styles.lead)}>{m.home_intro_2()}</p>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.home_how_title()}</h2>
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
                          {...props(styles.artwork, styles.resultArtwork)}
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
              <h3 {...props(styles.derivedTitle)}>{m.gen_web_derived_title()}</h3>
              <p {...props(layout.muted)}>{m.gen_web_derived_count({ count: derivedCount })}</p>
              <ul {...props(styles.siteGroups)}>
                {appSites.map(({ app, sites }) => (
                  <li key={app.bundleId} {...props(styles.siteGroup)}>
                    <span {...props(styles.siteGroupHead)}>
                      <AppArtwork
                        meta={meta[app.bundleId]}
                        name={app.name}
                        style={styles.chipArtwork}
                      />
                      <span {...props(styles.appName)}>{app.name}</span>
                    </span>
                    <span {...props(styles.chipRow)}>
                      {sites.length === 0 ? (
                        <span {...props(styles.chip, styles.chipEmpty)}>
                          {m.gen_web_derived_none()}
                        </span>
                      ) : (
                        sites.map((site) => (
                          <button
                            aria-pressed={!excludedSites.includes(site)}
                            key={site}
                            onClick={() => toggleSite(site)}
                            type="button"
                            {...props(
                              styles.chip,
                              excludedSites.includes(site) ? styles.chipOff : styles.chipOn,
                            )}
                          >
                            {siteLabel(site)}
                          </button>
                        ))
                      )}
                    </span>
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
              <CardTitle>{m.gen_output_title()}</CardTitle>
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
          <h3 {...props(styles.subTitle)}>{m.gen_install_title()}</h3>
          <ol {...props(styles.steps)}>
            <li>{m.gen_install_step_transfer()}</li>
            <li>{m.gen_install_step_settings()}</li>
            <li>{m.gen_install_step_reboot()}</li>
            <li>{m.gen_install_step_unsupervised()}</li>
          </ol>
          <p {...props(layout.muted)}>{m.gen_install_note()}</p>
        </section>

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
        </footer>
      </div>
    </main>
  );
}
