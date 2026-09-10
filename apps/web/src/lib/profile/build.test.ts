import { describe, expect, it } from 'vitest';
import { buildProfile, InvalidProfileIdentifierError } from './build.ts';
import { presets } from './presets.ts';
import type { ProfileConfig } from './types.ts';

const baseConfig: ProfileConfig = {
  allowAppStore: true,
  allowPrivateBrowsing: true,
  autoFilterAdult: false,
  blockedApps: [{ bundleId: 'com.atebits.Tweetie2', name: 'X' }],
  displayName: 'Dumbphone',
  identifier: 'com.example.dumbphone',
  lockRemoval: true,
  organization: 'Me',
  webFilter: { deniedUrls: ['https://x.com'], mode: 'deny', permittedUrls: [] },
};

function config(overrides: Partial<ProfileConfig>): ProfileConfig {
  return { ...baseConfig, ...overrides };
}

function sequentialUuid(): () => string {
  const values = [
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  ];
  let index = 0;
  return () => values[index++] ?? 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
}

function count(xml: string, pattern: RegExp): number {
  return [...xml.matchAll(pattern)].length;
}

describe('buildProfile', () => {
  it('opens with the plist preamble', () => {
    const xml = buildProfile(baseConfig);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist ')).toBe(true);
    expect(xml.endsWith('</dict>\n</plist>\n')).toBe(true);
  });

  it('emits PayloadVersion as the integer 1 once per payload', () => {
    for (const profile of [
      buildProfile(baseConfig),
      buildProfile(config({ webFilter: { mode: 'off' } })),
      buildProfile(config({ webFilter: { allowedUrls: ['https://claude.ai'], mode: 'allow' } })),
    ]) {
      const payloads = count(profile, /<key>PayloadType<\/key>/g);
      expect(payloads).toBeGreaterThan(1);
      expect(count(profile, /<key>PayloadVersion<\/key>/g)).toBe(payloads);
      expect(count(profile, /<key>PayloadVersion<\/key><integer>1<\/integer>/g)).toBe(payloads);
    }
  });

  it('uses the injected uuid function, uppercased, in payload order', () => {
    const xml = buildProfile(baseConfig, { uuid: sequentialUuid() });
    expect(xml).toContain(
      '<key>PayloadUUID</key><string>AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA</string>',
    );
    expect(xml.indexOf('BBBBBBBB')).toBeGreaterThan(xml.indexOf('AAAAAAAA'));
    expect(xml.indexOf('CCCCCCCC')).toBeGreaterThan(xml.indexOf('BBBBBBBB'));
    expect(xml).not.toContain('aaaaaaaa');
  });

  it('spends no uuid on a web filter it does not emit', () => {
    const xml = buildProfile(config({ webFilter: { mode: 'off' } }), { uuid: sequentialUuid() });
    expect(count(xml, /<key>PayloadUUID<\/key>/g)).toBe(2);
    expect(xml).not.toContain('CCCCCCCC');
  });

  it('escapes XML special characters', () => {
    const xml = buildProfile(
      config({
        displayName: 'Mert & <Co>',
        webFilter: {
          deniedUrls: ['https://x.com/?a=1&b=2'],
          mode: 'deny',
          permittedUrls: [],
        },
      }),
    );
    expect(xml).toContain('<key>PayloadDisplayName</key><string>Mert &amp; &lt;Co&gt;</string>');
    expect(xml).toContain('<string>https://x.com/?a=1&amp;b=2</string>');
  });

  it('derives the sub-payload identifiers from the profile identifier', () => {
    const xml = buildProfile(config({ identifier: 'com.acme.focus' }));
    expect(xml).toContain('<key>PayloadIdentifier</key><string>com.acme.focus</string>');
    expect(xml).toContain(
      '<key>PayloadIdentifier</key><string>com.acme.focus.restrictions</string>',
    );
    expect(xml).toContain('<key>PayloadIdentifier</key><string>com.acme.focus.webfilter</string>');
  });

  it('rejects identifiers that are not reverse-domain', () => {
    for (const identifier of ['', 'dumbphone', '.com.example', 'com..example', 'com example']) {
      expect(() => buildProfile(config({ identifier }))).toThrow(InvalidProfileIdentifierError);
    }
    expect(() => buildProfile(config({ identifier: 'com.example.dumb-phone' }))).not.toThrow();
  });

  it('always emits the restrictions payload with allowAppInstallation', () => {
    expect(buildProfile(config({ allowAppStore: true }))).toContain(
      '<key>allowAppInstallation</key><true/>',
    );
    expect(buildProfile(config({ allowAppStore: false }))).toContain(
      '<key>allowAppInstallation</key><false/>',
    );
  });

  it('omits blockedAppBundleIDs when no apps are blocked', () => {
    const xml = buildProfile(config({ blockedApps: [] }));
    expect(xml).toContain('<string>com.apple.applicationaccess</string>');
    expect(xml).not.toContain('blockedAppBundleIDs');
  });

  it('lists blocked bundle ids in order', () => {
    const xml = buildProfile(
      config({
        blockedApps: [
          { bundleId: 'com.atebits.Tweetie2', name: 'X' },
          { bundleId: 'com.burbn.instagram', name: 'Instagram' },
        ],
      }),
    );
    expect(xml).toContain(
      [
        '      <key>blockedAppBundleIDs</key>',
        '      <array>',
        '        <string>com.atebits.Tweetie2</string>',
        '        <string>com.burbn.instagram</string>',
        '      </array>',
      ].join('\n'),
    );
  });

  it('mirrors PayloadRemovalDisallowed from lockRemoval', () => {
    expect(buildProfile(config({ lockRemoval: true }))).toContain(
      '<key>PayloadRemovalDisallowed</key><true/>',
    );
    expect(buildProfile(config({ lockRemoval: false }))).toContain(
      '<key>PayloadRemovalDisallowed</key><false/>',
    );
  });

  it('builds a deny filter from denied and permitted urls', () => {
    const xml = buildProfile(
      config({
        autoFilterAdult: true,
        webFilter: {
          deniedUrls: ['https://x.com', 'https://reddit.com'],
          mode: 'deny',
          permittedUrls: ['https://accounts.youtube.com'],
        },
      }),
    );
    expect(xml).toContain('<key>FilterType</key><string>BuiltIn</string>');
    expect(xml).toContain('<key>AutoFilterEnabled</key><true/>');
    expect(xml).toContain(
      [
        '      <key>PermittedURLs</key>',
        '      <array>',
        '        <string>https://accounts.youtube.com</string>',
        '      </array>',
        '      <key>BlacklistedURLs</key>',
        '      <array>',
        '        <string>https://x.com</string>',
        '        <string>https://reddit.com</string>',
        '      </array>',
      ].join('\n'),
    );
    expect(xml).not.toContain('AllowListBookmarks');
  });

  it('omits empty url keys in deny mode', () => {
    const xml = buildProfile(
      config({ webFilter: { deniedUrls: [], mode: 'deny', permittedUrls: [] } }),
    );
    expect(xml).toContain('<string>com.apple.webcontent-filter</string>');
    expect(xml).not.toContain('PermittedURLs');
    expect(xml).not.toContain('BlacklistedURLs');
  });

  it('builds an allow filter as AllowListBookmarks titled by hostname', () => {
    const xml = buildProfile(
      config({
        autoFilterAdult: true,
        webFilter: {
          allowedUrls: ['https://claude.ai', 'maps.google.com'],
          mode: 'allow',
        },
      }),
    );
    // The allow-list only bites while the auto filter is off.
    expect(xml).toContain('<key>AutoFilterEnabled</key><false/>');
    expect(xml).toContain(
      [
        '      <key>AllowListBookmarks</key>',
        '      <array>',
        '        <dict>',
        '          <key>URL</key><string>https://claude.ai</string>',
        '          <key>Title</key><string>claude.ai</string>',
        '        </dict>',
        '        <dict>',
        '          <key>URL</key><string>https://maps.google.com</string>',
        '          <key>Title</key><string>maps.google.com</string>',
        '        </dict>',
        '      </array>',
      ].join('\n'),
    );
    expect(xml).not.toContain('BlacklistedURLs');
  });

  it('omits the whole web filter payload when the filter is off', () => {
    const xml = buildProfile(config({ webFilter: { mode: 'off' } }));
    expect(xml).not.toContain('com.apple.webcontent-filter');
    expect(xml).not.toContain('SafariHistoryRetentionEnabled');
    expect(xml).not.toContain('AutoFilterEnabled');
    expect(xml).not.toContain('ContentFilterUUID');
    expect(xml).toContain('<string>com.apple.applicationaccess</string>');
  });

  // Without it an unsupervised iPhone rejects the profile outright.
  it('emits an uppercase ContentFilterUUID after FilterType in both filter modes', () => {
    const filters: Array<ProfileConfig['webFilter']> = [
      { deniedUrls: ['https://x.com'], mode: 'deny', permittedUrls: [] },
      { allowedUrls: ['https://claude.ai'], mode: 'allow' },
    ];
    for (const webFilter of filters) {
      const xml = buildProfile(config({ webFilter }), { uuid: sequentialUuid() });
      expect(xml).toContain(
        [
          '      <key>FilterType</key><string>BuiltIn</string>',
          '      <key>ContentFilterUUID</key><string>DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD</string>',
        ].join('\n'),
      );
    }
  });

  it('inverts allowPrivateBrowsing into SafariHistoryRetentionEnabled', () => {
    expect(buildProfile(config({ allowPrivateBrowsing: false }))).toContain(
      '<key>SafariHistoryRetentionEnabled</key><true/>',
    );
    expect(buildProfile(config({ allowPrivateBrowsing: true }))).toContain(
      '<key>SafariHistoryRetentionEnabled</key><false/>',
    );
  });

  it('normalizes urls and dedupes them in order', () => {
    const xml = buildProfile(
      config({
        webFilter: {
          deniedUrls: [' x.com ', 'https://x.com/', 'x.com', 'http://old.example.com', '  '],
          mode: 'deny',
          permittedUrls: [],
        },
      }),
    );
    expect(xml).toContain(
      [
        '      <key>BlacklistedURLs</key>',
        '      <array>',
        '        <string>https://x.com</string>',
        '        <string>http://old.example.com</string>',
        '      </array>',
      ].join('\n'),
    );
  });
});

describe('presets', () => {
  it('builds the mert preset with every blocked bundle id', () => {
    const xml = buildProfile(presets.mert);
    expect(presets.mert.blockedApps).toHaveLength(12);
    for (const app of presets.mert.blockedApps) {
      expect(xml).toContain(`<string>${app.bundleId}</string>`);
    }
    expect(xml).toContain('<string>https://accounts.youtube.com</string>');
  });

  it('builds the stopa preset as an allow list with no App Store', () => {
    const xml = buildProfile(presets.stopa);
    expect(xml).toContain('<key>allowAppInstallation</key><false/>');
    expect(xml).toContain('<key>AllowListBookmarks</key>');
    expect(xml).toContain('<key>Title</key><string>wikipedia.org</string>');
  });

  it('builds the minimal preset without a web filter', () => {
    const xml = buildProfile(presets.minimal);
    expect(xml).toContain('<key>PayloadRemovalDisallowed</key><false/>');
    expect(xml).not.toContain('com.apple.webcontent-filter');
  });
});
