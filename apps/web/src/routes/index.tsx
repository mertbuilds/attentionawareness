import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
} from '@keepyourattention/ui';
import { colors, font, radius, spacing } from '@keepyourattention/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppResult } from '../lib/app-search.ts';
import { defaultStorefront, lookupApps, searchApps, storefronts } from '../lib/app-search.ts';
import { layout } from '../lib/layout.ts';
import { buildProfile, presets } from '../lib/profile/index.ts';
import type { BlockedApp, ProfileConfig } from '../lib/profile/index.ts';
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
const SUPERVISE_URL = '/supervise';
const PROFILE_MIME = 'application/x-apple-aspen-config';
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** Above every other icon in the fan, whatever the stack order says. */
const POPPED_DEPTH = 99;

/** `Select` shows an item's label instead of the raw storefront code. */
const storefrontItems = storefronts.map((storefront) => ({
  label: storefront.label,
  value: storefront.code,
}));

type WebMode = ProfileConfig['webFilter']['mode'];

/** Raw textarea buffers. The parsed arrays live in the config. */
type UrlText = { allowed: string; denied: string; permitted: string };

/**
 * What the App Store knows about one blocked app. The config stores only a
 * bundle id and a name, so artwork and developer are fetched and cached here:
 * `undefined` is still loading, `null` is a storefront that has no such app.
 */
type AppMeta = { developer: string; iconUrl: string };
type MetaCache = Record<string, AppMeta | null>;

const styles = create({
  addTile: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: {
      ':hover': colors.fg,
      default: colors.border,
    },
    borderRadius: 11,
    borderStyle: 'dashed',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    gap: spacing.s3,
    minWidth: 0,
    padding: spacing.s2,
    textAlign: 'start',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0ms',
      default: '150ms',
    },
    transitionProperty: 'border-color, color',
    width: '100%',
  },
  addTileActive: {
    borderColor: colors.fg,
    color: colors.fg,
  },
  addTileHint: {
    fontSize: font.sizeSm,
  },
  addTileIcon: {
    alignItems: 'center',
    // Follows the tile's own border color, hover included.
    borderColor: 'inherit',
    borderRadius: 11,
    borderStyle: 'dashed',
    borderWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexShrink: 0,
    fontSize: 24,
    height: 48,
    justifyContent: 'center',
    lineHeight: 1,
    width: 48,
  },
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
  choice: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: {
      '@media (min-width: 640px)': spacing.s16,
      default: spacing.s12,
    },
    maxWidth: 760,
    width: '100%',
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
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  hero: {
    maxWidth: 900,
    width: '100%',
  },
  heroQuiet: {
    color: colors.muted,
  },
  heroTitle: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 'clamp(40px, 7.5vw, 64px)',
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
  resultArtwork: {
    borderRadius: 9,
    height: 40,
    width: 40,
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  searchPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
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
  stepNumber: {
    color: colors.muted,
    fontFamily: MONOSPACE,
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s1,
    margin: 0,
    paddingInlineStart: spacing.s4,
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

function urlTextOf(config: ProfileConfig): UrlText {
  const filter = config.webFilter;
  return {
    allowed: filter.mode === 'allow' ? filter.allowedUrls.join('\n') : '',
    denied: filter.mode === 'deny' ? filter.deniedUrls.join('\n') : '',
    permitted: filter.mode === 'deny' ? filter.permittedUrls.join('\n') : '',
  };
}

function readStoredConfig(): ProfileConfig | null {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : (JSON.parse(raw) as ProfileConfig);
  } catch {
    return null;
  }
}

function writeStoredConfig(config: ProfileConfig): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Private mode or a full quota must not break the generator.
  }
}

/** The browser's own storefront, but only if the picker offers it. */
function initialStorefront(): string {
  const code = defaultStorefront();
  return storefronts.some((storefront) => storefront.code === code) ? code : FALLBACK_COUNTRY;
}

function storefrontLabel(code: string): string {
  return storefronts.find((storefront) => storefront.code === code)?.label ?? code;
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
 * on tap.
 */
function AppIconFan({ apps, meta }: { apps: ReadonlyArray<BlockedApp>; meta: MetaCache }) {
  const [popped, setPopped] = useState<string | null>(null);
  const poppedIndex = apps.findIndex((app) => app.bundleId === popped);
  const hasPop = poppedIndex !== -1;

  return (
    <span {...props(styles.fan)}>
      {apps.map((app, index) => (
        <button
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
        </button>
      ))}
    </span>
  );
}

function Generator() {
  const [config, setConfig] = useState<ProfileConfig>(presets.mert);
  const [urlText, setUrlText] = useState<UrlText>(urlTextOf(presets.mert));
  const [country, setCountry] = useState(FALLBACK_COUNTRY);
  const [meta, setMeta] = useState<MetaCache>({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<AppResult>>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showXml, setShowXml] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  const xml = useMemo(() => safeBuild(config), [config]);
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

  // localStorage and navigator exist only in the browser: reading either during
  // render would desync the SSR HTML from the first client render. Adopting
  // what they hold IS synchronizing with an external system, the one case the
  // rule leaves to an effect, and it runs once, so nothing cascades.
  /* oxlint-disable react/set-state-in-effect -- one-shot restore from browser-only storage */
  useEffect(() => {
    const stored = readStoredConfig();
    if (stored !== null) {
      setConfig(stored);
      setUrlText(urlTextOf(stored));
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

  // The input mounts with the panel, so the focus has to wait for that render.
  useEffect(() => {
    if (searchOpen) {
      searchInput.current?.focus();
    }
  }, [searchOpen]);

  function update(next: ProfileConfig) {
    setConfig(next);
    writeStoredConfig(next);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setSearchFailed(false);
    setSearching(value.trim() !== '');
  }

  function addApp(app: AppResult) {
    // The search row already carries the artwork, so adding it costs no lookup.
    setMeta((current) => ({
      ...current,
      [app.bundleId]: { developer: app.developer, iconUrl: app.iconUrl },
    }));
    update({
      ...config,
      blockedApps: [...config.blockedApps, { bundleId: app.bundleId, name: app.name }],
    });
  }

  function removeApp(bundleId: string) {
    update({
      ...config,
      blockedApps: config.blockedApps.filter((app) => app.bundleId !== bundleId),
    });
  }

  function setWebMode(mode: WebMode) {
    if (mode === 'deny') {
      update({
        ...config,
        webFilter: {
          deniedUrls: parseLines(urlText.denied),
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

  function onDeniedChange(text: string) {
    setUrlText({ ...urlText, denied: text });
    const filter = config.webFilter;
    if (filter.mode === 'deny') {
      update({ ...config, webFilter: { ...filter, deniedUrls: parseLines(text) } });
    }
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

  const filter = config.webFilter;
  // Only a deny list "blocks sites"; an allow list blocks everything else.
  const blockedSites = filter.mode === 'deny' ? filter.deniedUrls.length : 0;
  const siteSummary =
    filter.mode === 'deny'
      ? m.gen_summary_sites_blocked({ count: filter.deniedUrls.length })
      : filter.mode === 'allow'
        ? m.gen_summary_sites_allowed({ count: filter.allowedUrls.length })
        : m.gen_summary_sites_none();

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
                  <span {...props(styles.stepNumber)}>{index + 1}</span>
                  <CardTitle>{step.title}</CardTitle>
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
          <p {...props(layout.muted)}>{m.home_apps_subtitle()}</p>
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
                  aria-label={m.gen_app_remove()}
                  onClick={() => removeApp(app.bundleId)}
                  variant="ghost"
                >
                  ×
                </Button>
              </li>
            ))}
            {/* The trigger is a tile of the grid, not a control below it. */}
            <li>
              <button
                aria-expanded={searchOpen}
                aria-label={m.gen_app_search_open()}
                onClick={() => setSearchOpen(!searchOpen)}
                type="button"
                {...props(styles.addTile, searchOpen && styles.addTileActive)}
              >
                <span aria-hidden="true" {...props(styles.addTileIcon)}>
                  +
                </span>
                <span {...props(styles.appText)}>
                  <span {...props(styles.appName)}>{m.gen_app_search_open()}</span>
                  <span {...props(styles.addTileHint)}>{m.gen_app_search_hint()}</span>
                </span>
              </button>
            </li>
          </ul>
          {searchOpen ? (
            <div {...props(styles.searchPanel)}>
              <Field>
                <FieldLabel htmlFor="storefront">{m.gen_storefront_label()}</FieldLabel>
                <Select
                  items={storefrontItems}
                  onValueChange={(value: string | null) => setCountry(value ?? FALLBACK_COUNTRY)}
                  value={country}
                >
                  <SelectTrigger id="storefront">
                    {/* Read the label off our own state: the trigger then always
                        agrees with the storefront the search actually queries. */}
                    <SelectValue>{() => storefrontLabel(country)}</SelectValue>
                  </SelectTrigger>
                  {/* A plain dropdown below the trigger. Aligning the selected
                      item with the trigger drops the whole list over the cursor. */}
                  <SelectContent alignItemWithTrigger={false}>
                    {storefrontItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="app-search">{m.gen_app_search_label()}</FieldLabel>
                <Input
                  id="app-search"
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder={m.gen_app_search_placeholder()}
                  ref={searchInput}
                  value={query}
                />
              </Field>
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
              {!searching && query.trim() !== '' && results.length === 0 && !searchFailed ? (
                <p {...props(layout.muted)}>{m.gen_app_results_empty()}</p>
              ) : null}
              {!searching && query.trim() !== '' && results.length > 0 ? (
                <ul {...props(styles.list)}>
                  {results.map((app) => (
                    <li key={app.bundleId} {...props(styles.appRow)}>
                      <img
                        alt={app.name}
                        src={app.iconUrl}
                        {...props(styles.artwork, styles.resultArtwork)}
                      />
                      <span {...props(styles.appText)}>
                        <span {...props(styles.appName)}>{app.name}</span>
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
        </section>

        <Separator />

        <section {...props(styles.section)}>
          <h2 {...props(styles.sectionTitle)}>{m.gen_identity_title()}</h2>
          <Field data-invalid={xml === null || undefined}>
            <FieldLabel htmlFor="identifier">{m.gen_identifier_label()}</FieldLabel>
            <Input
              aria-invalid={xml === null || undefined}
              id="identifier"
              onChange={(event) => update({ ...config, identifier: event.target.value })}
              value={config.identifier}
            />
            <FieldDescription>{m.gen_identifier_help()}</FieldDescription>
            {xml === null ? <FieldError>{m.gen_identifier_error()}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="display-name">{m.gen_display_name_label()}</FieldLabel>
            <Input
              id="display-name"
              onChange={(event) => update({ ...config, displayName: event.target.value })}
              value={config.displayName}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="organization">{m.gen_organization_label()}</FieldLabel>
            <Input
              id="organization"
              onChange={(event) => update({ ...config, organization: event.target.value })}
              value={config.organization}
            />
          </Field>
        </section>

        <Separator />

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
            <Field>
              <FieldLabel htmlFor="denied-urls">{m.gen_web_denied_label()}</FieldLabel>
              <textarea
                id="denied-urls"
                onChange={(event) => onDeniedChange(event.target.value)}
                value={urlText.denied}
                {...props(styles.textarea)}
              />
              <FieldDescription>{m.gen_web_lines_help()}</FieldDescription>
            </Field>
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

        <Separator />

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

        <Separator />

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
              {showXml && xml !== null ? <pre {...props(styles.pre)}>{xml}</pre> : null}
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

        <Separator />

        <footer {...props(styles.footer)}>
          <p {...props(layout.muted)}>
            {m.gen_footer_open_source()}{' '}
            <a href={REPO_URL} rel="noreferrer" target="_blank">
              {m.gen_footer_repo()}
            </a>
          </p>
          <p {...props(layout.muted)}>{m.gen_footer_not_apple()}</p>
        </footer>
      </div>
    </main>
  );
}
