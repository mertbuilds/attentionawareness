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
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import type { AppResult } from '../lib/app-search.ts';
import { defaultStorefront, searchApps, storefronts } from '../lib/app-search.ts';
import { layout } from '../lib/layout.ts';
import { buildProfile, presets } from '../lib/profile/index.ts';
import type { ProfileConfig } from '../lib/profile/index.ts';
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
const PROFILE_MIME = 'application/x-apple-aspen-config';
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** `Select` shows an item's label instead of the raw storefront code. */
const storefrontItems = storefronts.map((storefront) => ({
  label: storefront.label,
  value: storefront.code,
}));

type WebMode = ProfileConfig['webFilter']['mode'];

/** Raw textarea buffers. The parsed arrays live in the config. */
type UrlText = { allowed: string; denied: string; permitted: string };

const styles = create({
  appRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
  },
  appText: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    gap: spacing.s1,
    minWidth: 0,
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
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  icon: {
    borderRadius: radius.base,
    flexShrink: 0,
    height: 32,
    width: 32,
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
    overflowWrap: 'anywhere',
  },
  page: {
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font.family,
    gap: spacing.s6,
    marginInline: 'auto',
    maxWidth: 720,
    minHeight: '100vh',
    paddingBlock: spacing.s8,
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
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  sectionTitle: {
    fontSize: font.sizeMd,
    fontWeight: font.weightBold,
    margin: 0,
  },
  skeletonRow: {
    height: 40,
    width: '100%',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s1,
    margin: 0,
    paddingInlineStart: spacing.s4,
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
  title: {
    fontSize: 40,
    fontWeight: font.weightBold,
    letterSpacing: '-0.02em',
    margin: 0,
    textWrap: 'balance',
  },
  titleRow: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
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

function Generator() {
  const [config, setConfig] = useState<ProfileConfig>(presets.mert);
  const [urlText, setUrlText] = useState<UrlText>(urlTextOf(presets.mert));
  const [country, setCountry] = useState(FALLBACK_COUNTRY);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<AppResult>>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [showXml, setShowXml] = useState(false);

  const xml = useMemo(() => safeBuild(config), [config]);
  const blockedIds = useMemo(
    () => new Set(config.blockedApps.map((app) => app.bundleId)),
    [config.blockedApps],
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

  function update(next: ProfileConfig) {
    setConfig(next);
    writeStoredConfig(next);
  }

  function applyPreset(preset: ProfileConfig) {
    update(preset);
    setUrlText(urlTextOf(preset));
  }

  function onQueryChange(value: string) {
    setQuery(value);
    setSearchFailed(false);
    setSearching(value.trim() !== '');
  }

  function addApp(app: AppResult) {
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

  return (
    <main {...props(styles.page)}>
      <header {...props(styles.header)}>
        <h1 {...props(styles.title)}>{m.app_name()}</h1>
        <p>{m.app_tagline()}</p>
        <h2 {...props(styles.sectionTitle)}>{m.gen_tiers_title()}</h2>
        <p {...props(layout.muted)}>{m.gen_tier_sites()}</p>
        <p {...props(layout.muted)}>
          {m.gen_tier_supervised()} <a href="/supervise">{m.gen_supervise_link()}</a>
        </p>
      </header>

      <Separator />

      <section {...props(styles.section)}>
        <h2 {...props(styles.sectionTitle)}>{m.gen_presets_title()}</h2>
        <div {...props(styles.row)}>
          <Button onClick={() => applyPreset(presets.mert)} variant="outline">
            {m.gen_preset_mert()}
          </Button>
          <Button onClick={() => applyPreset(presets.stopa)} variant="outline">
            {m.gen_preset_stopa()}
          </Button>
          <Button onClick={() => applyPreset(presets.minimal)} variant="outline">
            {m.gen_preset_minimal()}
          </Button>
        </div>
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
        <div {...props(styles.titleRow)}>
          <h2 {...props(styles.sectionTitle)}>{m.gen_apps_title()}</h2>
          <Badge variant="outline">{m.gen_needs_supervision()}</Badge>
        </div>
        <Field>
          <FieldLabel htmlFor="storefront">{m.gen_storefront_label()}</FieldLabel>
          <Select
            items={storefrontItems}
            onValueChange={(value: string | null) => setCountry(value ?? FALLBACK_COUNTRY)}
            value={country}
          >
            <SelectTrigger id="storefront">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
        {!searching && results.length > 0 ? (
          <ul {...props(styles.list)}>
            {results.map((app) => (
              <li key={app.bundleId} {...props(styles.appRow)}>
                <img alt={app.name} src={app.iconUrl} {...props(styles.icon)} />
                <span {...props(styles.appText)}>
                  <span>{app.name}</span>
                  <span {...props(layout.muted)}>{app.developer}</span>
                  <span {...props(styles.mono)}>{app.bundleId}</span>
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
        <h3 {...props(styles.sectionTitle)}>{m.gen_apps_selected_title()}</h3>
        {config.blockedApps.length === 0 ? (
          <p {...props(layout.muted)}>{m.gen_apps_empty()}</p>
        ) : (
          <ul {...props(styles.list)}>
            {config.blockedApps.map((app) => (
              <li key={app.bundleId} {...props(styles.appRow)}>
                <span {...props(styles.appText)}>
                  <span>{app.name}</span>
                  <span {...props(styles.mono)}>{app.bundleId}</span>
                </span>
                <Button onClick={() => removeApp(app.bundleId)} variant="ghost">
                  {m.gen_app_remove()}
                </Button>
              </li>
            ))}
          </ul>
        )}
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
              <li>{config.lockRemoval ? m.gen_summary_locked_on() : m.gen_summary_locked_off()}</li>
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
        <h3 {...props(styles.sectionTitle)}>{m.gen_install_title()}</h3>
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
    </main>
  );
}
