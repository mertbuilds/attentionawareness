import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  Label,
  Skeleton,
} from '@attentionawareness/ui';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Check } from 'reicon-react';
import { AppArtwork, artworkStyles } from '../components/app-artwork.tsx';
import type { MetaCache } from '../components/app-artwork.tsx';
import { PageFoot, PageHeader, page } from '../components/page.tsx';
import { Tip } from '../components/tip.tsx';
import { posthog } from '../lib/analytics.ts';
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
import { controls } from '../lib/controls.ts';
import { layout } from '../lib/layout.ts';
import { presets } from '../lib/profile/index.ts';
import type { BlockedApp, ProfileConfig } from '../lib/profile/index.ts';
import { replayMask } from '../lib/replay.ts';
import { SECTION } from '../lib/sections.ts';
import { normalizeUrl, sitesForApp, sitesForApps } from '../lib/sites.ts';
import { m } from '../paraglide/messages.js';

export const Route = createFileRoute('/build')({
  component: BuildPage,
  head: () => ({
    meta: [
      { title: `${m.build_head_title()} · ${SITE_NAME}` },
      { content: m.build_description(), name: 'description' },
      { content: m.build_head_title(), property: 'og:title' },
      { content: m.build_description(), property: 'og:description' },
    ],
  }),
});

/** The brand in prose, the way the root document spells it. */
const SITE_NAME = 'attention awareness';
/** How to supervise an iPhone for free, which the profile assumes is done. */
const GUIDE_URL = '/guide';
/** The Mac app's download lives on the home page. */
const MAC_URL = `/#${SECTION.wayOut}`;
/**
 * Where a link stands inside a sentence, the way the footer does it: the
 * message carries the link as a placeholder and is split on it, so the words
 * around it keep their own order and spacing in every language.
 */
const LINK_SLOT = '\u0000';
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 10;
const SKELETON_ROWS = [0, 1, 2];
const FALLBACK_COUNTRY = 'us';
/** The ids the two labelled site lists name their add field with. */
const PERMITTED_INPUT_ID = 'permitted-urls';
const ALLOWED_INPUT_ID = 'allowed-urls';
const PROFILE_MIME = 'application/x-apple-aspen-config';
/** The signer. The key is the founder's and never leaves the server. */
const SIGN_URL = '/api/sign';
/** The server names the profile, so every download saves under one name. */
const PROFILE_FILENAME = 'attentionawareness.mobileconfig';
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** How long an armed Remove waits for its second click before standing down. */
const REMOVE_CONFIRM_MS = 3000;
/** A chip names a host; the scheme carries nothing the user needs to read. */
const SITE_SCHEME = /^https?:\/\//u;
/** How much of the profile the preview draws before it starts counting. */
const PREVIEW_APPS = 12;
const PREVIEW_SITES = 6;
/** The tick on the chosen country, the size of the flag beside it. */
const CHECK_SIZE = 16;
/** How many apps one site row names before the rest are left implied. */
const ROW_APPS = 3;

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
  body: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '60ch',
    textWrap: 'pretty',
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
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
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
  // The wide column of the site's other pages, so the head and every section
  // share a left edge.
  content: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    maxWidth: `calc(760px + 2 * ${spacing.s4})`,
    paddingInline: spacing.s4,
    width: '100%',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
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
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'flex',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    listStyleType: 'none',
    width: 'fit-content',
  },
  // The two lines under the lead: a step quieter and smaller.
  headNote: {
    color: colors.muted,
    fontSize: font.sizeMd,
    margin: 0,
  },
  // The frame of the site's other pages (`PageRoot`), kept here because the
  // replay mask goes on this element.
  page: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    // The stacking context that keeps the head's paper above the page's own
    // background instead of behind it.
    isolation: 'isolate',
    minHeight: '100vh',
    overflowX: 'clip',
    paddingBlockEnd: spacing.s16,
    position: 'relative',
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
  // The icons read as one stack, so each one steps over the last.
  previewOverlap: {
    marginInlineStart: -8,
  },
  previewPills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  previewSites: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  // Labels and badges draw at medium weight on their own; here nothing is set
  // heavier than the text around it.
  regular: {
    fontWeight: font.weightRegular,
  },
  // The one destructive colour on the page: it means "this click deletes".
  removeArmed: {
    color: {
      ':hover': {
        '@media (hover: hover)': colors.error,
        default: null,
      },
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
  // Sits in a muted line, so it takes the paragraph's own type.
  resetLink: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
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
  // Edge to edge inside the bar, so it reads as one line of the border.
  searchDivider: {
    alignSelf: 'stretch',
    backgroundColor: colors.border,
    flexShrink: 0,
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
  // The × that arms and drops a row, and the + that adds one.
  siteAction: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
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
      ':hover': {
        '@media (hover: hover)': colors.error,
        default: null,
      },
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
  steps: {
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    lineHeight: 1.5,
    margin: 0,
    paddingInlineStart: spacing.s6,
  },
  storefrontButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
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
  // Every row draws the tick and only the chosen one shows it, so choosing a
  // country moves nothing.
  storefrontCheck: {
    flexShrink: 0,
    marginInlineStart: 'auto',
  },
  storefrontCheckHidden: {
    visibility: 'hidden',
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
      ':hover': {
        '@media (hover: hover)': colors.border,
        default: null,
      },
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
  // 175 storefronts do not fit on a screen, so only the options scroll.
  storefrontOptions: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 320,
    overflowY: 'auto',
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
 * The config as the signer reads it. `deniedUrls` is derived, so the config
 * carries no editable copy of it: this is where the derivation lands, right
 * before the profile is previewed or signed.
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

/** The sites an allow list starts from: the everyday tools, nothing with a feed. */
const PRESET_ALLOWED: ReadonlyArray<string> =
  presets.stopa.webFilter.mode === 'allow' ? presets.stopa.webFilter.allowedUrls : [];

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
 * The "+N" at the end of a preview row, and the only place the rest of that
 * row is written out. Hover or the keyboard opens the list over the pill; a
 * phone opens a sheet.
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
  return (
    <Tip
      title={title}
      trigger={
        <button type="button" {...props(styles.previewMoreButton, style)}>
          {label}
        </button>
      }
    >
      {/* The tip opens in a portal, outside the page's own mark. */}
      <span {...replayMask} {...props(styles.previewList)}>
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </span>
    </Tip>
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
 * One plain row of the exceptions or the allow list: a tick that keeps it in
 * the profile, the host, and the two-step × that drops it.
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
 * One custom row's host, as a field with no chrome of its own. The draft is
 * local, so a half-typed host never reaches the profile: Enter and a blur
 * commit it, Escape puts the old one back, and a blank or unchanged value
 * commits nothing.
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

function BuildPage() {
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
  // The second gate, on the download alone: an installed profile comes off an
  // erased phone and no other way, so it is said out loud before it is signed.
  const [permanent, setPermanent] = useState(false);
  // The signer is a round trip, and it can turn the download down.
  const [signing, setSigning] = useState(false);
  const [signFailure, setSignFailure] = useState<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchWrap = useRef<HTMLDivElement>(null);
  const storefrontFilter = useRef<HTMLInputElement>(null);
  const storefrontMenu = useRef<HTMLDivElement>(null);

  const effectiveConfig = useMemo(
    () => withDerivedSites(config, customSites, excludedSites, removedSites, excludedEntries),
    [config, customSites, excludedSites, removedSites, excludedEntries],
  );
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

  // The navigator exists only in the browser: reading it during render would
  // desync the SSR HTML from the first client render. Adopting what it holds
  // IS synchronizing with an external system, the one case the rule leaves to
  // an effect, and it runs once, so nothing cascades.
  /* oxlint-disable react/set-state-in-effect -- one-shot read of browser-only state */
  useEffect(() => {
    const preferred = initialStorefront();
    if (preferred !== FALLBACK_COUNTRY) {
      setCountry(preferred);
    }
  }, []);
  /* oxlint-enable react/set-state-in-effect */

  // The config carries no icons, so ids nothing is known about are looked up
  // in one request. Caching every answer, misses included, empties the list
  // and stops the effect.
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
  function onStorefrontKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
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
    // The stored name is the short one: the grid and the preview have no room
    // for the App Store tagline. The seller url rides along, because the sites
    // of an uncurated app come from it.
    setConfig({
      ...config,
      blockedApps: [
        ...config.blockedApps,
        { bundleId: app.bundleId, name: shortAppName(app.name), sellerUrl: app.sellerUrl },
      ],
    });
    posthog.capture('app_block_added', {
      total_blocked_apps: config.blockedApps.length + 1,
    });
    posthog.logger.info('profile blocklist updated', {
      action: 'added',
      total_blocked_apps: config.blockedApps.length + 1,
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
      posthog.capture('app_block_removed', {
        total_blocked_apps: config.blockedApps.length - 1,
      });
      posthog.logger.info('profile blocklist updated', {
        action: 'removed',
        total_blocked_apps: config.blockedApps.length - 1,
      });
      return;
    }
    setArmedRemove(bundleId);
  }

  // One click, no confirmation: the link only shows while the list differs
  // from the preset, so there is nothing to lose that was not chosen on
  // purpose. The recommended apps come back with every site they imply, so
  // the rows that were unticked or deleted are forgotten too; the user's own
  // urls stay.
  function onResetClick() {
    setArmedRemove(null);
    setConfig({ ...config, blockedApps: [...presets.mert.blockedApps] });
    setExcludedSites([]);
    setRemovedSites([]);
  }

  // Each list starts from its preset: the recommended exceptions for a deny
  // list, the everyday tools for an allow list. Unticked rows belong to the
  // list that is being left, so they go with it.
  function setWebMode(mode: WebMode) {
    posthog.capture('web_filter_mode_changed', { web_filter_mode: mode });
    setExcludedEntries([]);
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
      setConfig({ ...config, webFilter: { allowedUrls: [...PRESET_ALLOWED], mode } });
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
   * It mints the identifier for this one download, so every download is a
   * profile of its own.
   */
  async function download() {
    if (signing) {
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
      const webFilterSiteCount =
        effectiveConfig.webFilter.mode === 'deny'
          ? effectiveConfig.webFilter.deniedUrls.length
          : effectiveConfig.webFilter.mode === 'allow'
            ? effectiveConfig.webFilter.allowedUrls.length
            : 0;
      const profileMode = effectiveConfig.lockRemoval ? 'permanent' : 'trial';
      posthog.capture('profile_downloaded', {
        blocked_apps_count: effectiveConfig.blockedApps.length,
        profile_mode: profileMode,
        web_filter_mode: effectiveConfig.webFilter.mode,
        web_filter_site_count: webFilterSiteCount,
      });
      posthog.logger.info('signed profile downloaded', {
        blocked_apps_count: effectiveConfig.blockedApps.length,
        profile_mode: profileMode,
        web_filter_mode: effectiveConfig.webFilter.mode,
        web_filter_site_count: webFilterSiteCount,
      });
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
  const siteSummary =
    filter.mode === 'deny'
      ? m.gen_summary_sites_blocked({ count: filter.deniedUrls.length })
      : filter.mode === 'allow'
        ? m.gen_summary_sites_allowed({ count: filter.allowedUrls.length })
        : m.gen_summary_sites_none();
  // The list is the recommended one while it holds exactly the preset apps and
  // none of their sites were unticked or deleted; only then is there nothing
  // to reset to.
  const recommended =
    excludedSites.length === 0 &&
    removedSites.length === 0 &&
    config.blockedApps.length === presets.mert.blockedApps.length &&
    presets.mert.blockedApps.every((app) => blockedIds.has(app.bundleId));
  // The preview draws the profile instead of listing it: the icons of the apps
  // it hides, and the hosts it turns away. Whatever does not fit is counted.
  const previewApps = config.blockedApps.slice(0, PREVIEW_APPS);
  const hiddenApps = config.blockedApps.length - previewApps.length;
  const deniedSites = filter.mode === 'deny' ? filter.deniedUrls : [];
  const previewSites = deniedSites.slice(0, PREVIEW_SITES);
  const hiddenSites = deniedSites.length - previewSites.length;
  // Apple's adult filter rides on a deny list and on nothing else.
  const adultFilter = filter.mode === 'deny' && config.autoFilterAdult;
  // Trial mode is the removal lock turned around: a trial profile comes off in
  // Settings, so the download asks for no acknowledgement.
  const trial = !config.lockRemoval;

  const [guideBefore, guideAfter] = m.build_guide({ guide: LINK_SLOT }).split(LINK_SLOT);
  const [macBefore, macAfter] = m.build_mac({ mac: LINK_SLOT }).split(LINK_SLOT);

  return (
    // Everything here may name what the visitor blocks: replay masks it all.
    <main {...replayMask} {...props(styles.page)}>
      <PageHeader eyebrow={m.page_eyebrow_build()} title={m.gen_step2_title()} wide>
        <p {...props(page.flush)}>{m.build_lead()}</p>
        <p {...props(styles.headNote)}>
          {guideBefore}
          <a href={GUIDE_URL}>{m.build_guide_link()}</a>
          {guideAfter}
        </p>
        <p {...props(styles.headNote)}>
          {macBefore}
          <a href={MAC_URL}>{m.build_mac_link()}</a>
          {macAfter}
        </p>
      </PageHeader>

      <div {...props(styles.content)}>
        <section {...props(styles.section)}>
          <h2 {...props(page.sectionTitle)}>{m.build_apps_title()}</h2>
          <p {...props(styles.body)}>{m.build_apps_body()}</p>
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
                          {...props(styles.storefrontOption)}
                        >
                          <span aria-hidden="true" {...props(styles.storefrontFlag)}>
                            {flagEmoji(storefront.code)}
                          </span>
                          <span>{storefront.label}</span>
                          <Check
                            aria-hidden="true"
                            size={CHECK_SIZE}
                            {...props(
                              styles.storefrontCheck,
                              storefront.code !== country && styles.storefrontCheckHidden,
                            )}
                          />
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
          {recommended ? null : (
            <p {...props(layout.muted)}>
              <button onClick={onResetClick} type="button" {...props(styles.resetLink)}>
                {m.gen_apps_reset()}
              </button>
            </p>
          )}
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(page.sectionTitle)}>{m.gen_web_title()}</h2>
          <div aria-label={m.gen_web_mode_label()} role="radiogroup" {...props(styles.choice)}>
            <Label style={styles.regular}>
              <input
                checked={filter.mode === 'deny'}
                name="web-mode"
                onChange={() => setWebMode('deny')}
                type="radio"
                {...props(controls.base, controls.radio)}
              />
              {m.gen_web_mode_deny()}
            </Label>
            <Label style={styles.regular}>
              <input
                checked={filter.mode === 'allow'}
                name="web-mode"
                onChange={() => setWebMode('allow')}
                type="radio"
                {...props(controls.base, controls.radio)}
              />
              {m.gen_web_mode_allow()}
            </Label>
            <Label style={styles.regular}>
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
            <>
              <p {...props(styles.body)}>{m.build_web_deny_body()}</p>
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
              <Field>
                <FieldLabel htmlFor={PERMITTED_INPUT_ID} style={styles.regular}>
                  {m.gen_web_permitted_label()}
                </FieldLabel>
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
                        onListRemoveClick(`${PERMITTED_INPUT_ID}:${url}`, () =>
                          removePermitted(url),
                        )
                      }
                      onToggle={() => toggleEntry(url)}
                      url={url}
                    />
                  ))}
                </SiteList>
              </Field>
            </>
          ) : null}
          {filter.mode === 'allow' ? (
            <>
              <p {...props(styles.body)}>{m.build_web_allow_body()}</p>
              <Field>
                <FieldLabel htmlFor={ALLOWED_INPUT_ID} style={styles.regular}>
                  {m.gen_web_allowed_label()}
                </FieldLabel>
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
            </>
          ) : null}
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(page.sectionTitle)}>{m.gen_restrictions_title()}</h2>
          {filter.mode === 'deny' ? (
            <Label style={styles.regular}>
              <input
                checked={config.autoFilterAdult}
                onChange={(event) =>
                  setConfig({ ...config, autoFilterAdult: event.target.checked })
                }
                type="checkbox"
                {...props(controls.base, controls.checkbox)}
              />
              {m.gen_web_auto_filter()}
            </Label>
          ) : null}
          <div {...props(styles.choice)}>
            <Label style={styles.regular}>
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
              <Label style={styles.regular}>
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
                <Label style={styles.regular}>
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
              <CardTitle style={page.sectionTitle}>{m.gen_output_title()}</CardTitle>
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
                  <Badge style={styles.regular} variant="outline">
                    {config.lockRemoval ? m.gen_summary_locked_on() : m.gen_summary_locked_off()}
                  </Badge>
                  {adultFilter ? (
                    <Badge style={styles.regular} variant="outline">
                      {m.gen_summary_adult()}
                    </Badge>
                  ) : null}
                </div>
              </div>
              {trial ? null : (
                <Label style={styles.regular}>
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
                  disabled={(!trial && !permanent) || signing}
                  onClick={() => void download()}
                >
                  {signing ? m.gen_signing() : trial ? m.gen_download_trial() : m.gen_download()}
                </Button>
              </div>
              {signFailure === null ? null : (
                <p role="alert" {...props(layout.muted)}>
                  {signFailure}
                </p>
              )}
              <p {...props(layout.muted)}>{m.build_stack_note()}</p>
            </CardContent>
          </Card>
        </section>

        <section {...props(styles.section)}>
          <h2 {...props(page.sectionTitle)}>{m.gen_install_title()}</h2>
          <ol {...props(styles.steps)}>
            <li>{m.build_install_1()}</li>
            <li>{m.build_install_2()}</li>
            <li>{m.build_install_3()}</li>
          </ol>
          <p {...props(styles.body)}>{m.build_install_phone()}</p>
          <p {...props(layout.muted)}>{m.gen_install_note()}</p>
        </section>

        <PageFoot />
      </div>
    </main>
  );
}
