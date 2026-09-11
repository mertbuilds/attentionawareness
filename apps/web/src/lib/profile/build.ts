import type { ProfileConfig } from './types.ts';

/**
 * `PayloadVersion` is the payload FORMAT version, not a revision counter: it
 * is the integer 1 in every payload, top level and sub, forever. One constant
 * so no payload can drift — iOS rejects the profile otherwise.
 */
const PAYLOAD_VERSION = '<key>PayloadVersion</key><integer>1</integer>';

const IDENTIFIER_PATTERN = /^[a-z0-9]+(\.[a-z0-9-]+)+$/i;

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

const DICT_INDENT = '    ';

const KEY_INDENT = '      ';

export class InvalidProfileIdentifierError extends Error {
  readonly identifier: string;

  constructor(identifier: string) {
    super(`Profile identifier must be reverse-domain, got "${identifier}"`);
    this.name = 'InvalidProfileIdentifierError';
    this.identifier = identifier;
  }
}

function defaultUuid(): string {
  return crypto.randomUUID();
}

/** Text nodes only, so the three structural characters are enough. */
function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function stringLine(indent: string, key: string, value: string): string {
  return `${indent}<key>${key}</key><string>${escapeXml(value)}</string>`;
}

function boolLine(indent: string, key: string, value: boolean): string {
  return `${indent}<key>${key}</key><${value ? 'true' : 'false'}/>`;
}

function stringArrayLines(
  indent: string,
  key: string,
  values: ReadonlyArray<string>,
): Array<string> {
  return [
    `${indent}<key>${key}</key>`,
    `${indent}<array>`,
    ...values.map((value) => `${indent}  <string>${escapeXml(value)}</string>`),
    `${indent}</array>`,
  ];
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === '') {
    return '';
  }
  const withScheme = SCHEME_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.endsWith('/') ? withScheme.slice(0, -1) : withScheme;
}

/** Normalizes, drops empties, dedupes while preserving the original order. */
function normalizeUrls(urls: ReadonlyArray<string>): Array<string> {
  const normalized = new Set<string>();
  for (const url of urls) {
    const value = normalizeUrl(url);
    if (value !== '') {
      normalized.add(value);
    }
  }
  return [...normalized];
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(SCHEME_PATTERN, '');
  }
}

/**
 * Apple's allow-list form (iOS 14.5+): with `AutoFilterEnabled` false, Safari
 * reaches these sites and nothing else.
 */
function bookmarkArrayLines(indent: string, urls: ReadonlyArray<string>): Array<string> {
  return [
    `${indent}<key>AllowListBookmarks</key>`,
    `${indent}<array>`,
    ...urls.flatMap((url) => [
      `${indent}  <dict>`,
      stringLine(`${indent}    `, 'URL', url),
      stringLine(`${indent}    `, 'Title', hostnameOf(url)),
      `${indent}  </dict>`,
    ]),
    `${indent}</array>`,
  ];
}

function restrictionsLines(config: ProfileConfig, uuid: string): Array<string> {
  const lines = [
    `${DICT_INDENT}<dict>`,
    stringLine(KEY_INDENT, 'PayloadType', 'com.apple.applicationaccess'),
    stringLine(KEY_INDENT, 'PayloadIdentifier', `${config.identifier}.restrictions`),
    stringLine(KEY_INDENT, 'PayloadUUID', uuid),
    `${KEY_INDENT}${PAYLOAD_VERSION}`,
    stringLine(KEY_INDENT, 'PayloadDisplayName', 'Restrictions'),
    boolLine(KEY_INDENT, 'allowAppInstallation', config.allowAppStore),
  ];
  if (config.blockedApps.length > 0) {
    lines.push(
      ...stringArrayLines(
        KEY_INDENT,
        'blockedAppBundleIDs',
        config.blockedApps.map((app) => app.bundleId),
      ),
    );
  }
  lines.push(`${DICT_INDENT}</dict>`);
  return lines;
}

function webFilterLines(config: ProfileConfig, nextUuid: () => string): Array<string> {
  const { webFilter } = config;
  if (webFilter.mode === 'off') {
    return [];
  }
  const lines = [
    `${DICT_INDENT}<dict>`,
    stringLine(KEY_INDENT, 'PayloadType', 'com.apple.webcontent-filter'),
    stringLine(KEY_INDENT, 'PayloadIdentifier', `${config.identifier}.webfilter`),
    stringLine(KEY_INDENT, 'PayloadUUID', nextUuid()),
    `${KEY_INDENT}${PAYLOAD_VERSION}`,
    stringLine(KEY_INDENT, 'PayloadDisplayName', 'Web Filter'),
    stringLine(KEY_INDENT, 'FilterType', 'BuiltIn'),
    boolLine(KEY_INDENT, 'AutoFilterEnabled', webFilter.mode === 'deny' && config.autoFilterAdult),
    boolLine(KEY_INDENT, 'SafariHistoryRetentionEnabled', !config.allowPrivateBrowsing),
  ];
  if (webFilter.mode === 'deny') {
    const permitted = normalizeUrls(webFilter.permittedUrls);
    const denied = normalizeUrls(webFilter.deniedUrls);
    if (permitted.length > 0) {
      lines.push(...stringArrayLines(KEY_INDENT, 'PermittedURLs', permitted));
    }
    if (denied.length > 0) {
      lines.push(...stringArrayLines(KEY_INDENT, 'BlacklistedURLs', denied));
    }
  } else {
    const allowed = normalizeUrls(webFilter.allowedUrls);
    if (allowed.length > 0) {
      lines.push(...bookmarkArrayLines(KEY_INDENT, allowed));
    }
  }
  lines.push(`${DICT_INDENT}</dict>`);
  return lines;
}

/**
 * Builds the .mobileconfig XML for a keepyourattention profile. Pure: pass `uuid` to get
 * deterministic output, otherwise every build mints fresh payload UUIDs.
 */
export function buildProfile(config: ProfileConfig, options?: { uuid?: () => string }): string {
  if (!IDENTIFIER_PATTERN.test(config.identifier)) {
    throw new InvalidProfileIdentifierError(config.identifier);
  }

  const uuid = options?.uuid ?? defaultUuid;
  const nextUuid = (): string => uuid().toUpperCase();
  const profileUuid = nextUuid();

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    stringLine('  ', 'PayloadType', 'Configuration'),
    stringLine('  ', 'PayloadIdentifier', config.identifier),
    stringLine('  ', 'PayloadUUID', profileUuid),
    `  ${PAYLOAD_VERSION}`,
    stringLine('  ', 'PayloadDisplayName', config.displayName),
    stringLine('  ', 'PayloadOrganization', config.organization),
    boolLine('  ', 'PayloadRemovalDisallowed', config.lockRemoval),
    '  <key>PayloadContent</key>',
    '  <array>',
    ...restrictionsLines(config, nextUuid()),
    ...webFilterLines(config, nextUuid),
    '  </array>',
    '</dict>',
    '</plist>',
  ];
  return `${lines.join('\n')}\n`;
}
