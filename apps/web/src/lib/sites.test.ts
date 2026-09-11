import { describe, expect, it } from 'vitest';
import { buildProfile } from './profile/build.ts';
import type { ProfileConfig } from './profile/types.ts';
import {
  curatedSites,
  hostFromSellerUrl,
  normalizeUrl,
  sitesForApp,
  sitesForApps,
} from './sites.ts';

const profileConfig: ProfileConfig = {
  allowAppStore: true,
  allowPrivateBrowsing: true,
  autoFilterAdult: false,
  blockedApps: [],
  displayName: 'attentionawareness',
  identifier: 'com.attentionawareness.profile',
  lockRemoval: true,
  organization: 'attentionawareness',
  webFilter: { mode: 'off' },
};

describe('hostFromSellerUrl', () => {
  it('reduces a real App Store seller url to its host', () => {
    expect(hostFromSellerUrl('http://x.com/')).toBe('x.com');
    expect(hostFromSellerUrl('https://www.reddit.com/mobile/download')).toBe('reddit.com');
    expect(hostFromSellerUrl('http://mobile.twitch.tv')).toBe('twitch.tv');
    expect(hostFromSellerUrl('http://www.facebook.com/mobile')).toBe('facebook.com');
    expect(hostFromSellerUrl('https://www.primevideo.com/help?nodeId=202064900')).toBe(
      'primevideo.com',
    );
  });

  it('lowercases the host and accepts a url without a scheme', () => {
    expect(hostFromSellerUrl('  HTTPS://WWW.Netflix.COM  ')).toBe('netflix.com');
    expect(hostFromSellerUrl('kick.com/browse')).toBe('kick.com');
  });

  it('keeps a subdomain that is not a mobile prefix', () => {
    expect(hostFromSellerUrl('https://support.google.com/youtubemusic')).toBe('support.google.com');
  });

  it('has no host for a value that names no site', () => {
    expect(hostFromSellerUrl(undefined)).toBeNull();
    expect(hostFromSellerUrl('not a url')).toBeNull();
    expect(hostFromSellerUrl('')).toBeNull();
    expect(hostFromSellerUrl('   ')).toBeNull();
    expect(hostFromSellerUrl('http://localhost:3000')).toBeNull();
    expect(hostFromSellerUrl('http://127.0.0.1')).toBeNull();
    expect(hostFromSellerUrl('http://[::1]')).toBeNull();
  });
});

describe('sitesForApp', () => {
  it('takes the curated sites when the bundle id has them', () => {
    expect(sitesForApp('com.atebits.Tweetie2')).toEqual({
      sites: ['https://x.com', 'https://twitter.com', 'https://t.co'],
      source: 'curated',
    });
  });

  it('prefers the curated sites over the seller url', () => {
    expect(sitesForApp('com.reddit.Reddit', 'https://www.reddit.com/mobile/download')).toEqual({
      sites: ['https://reddit.com', 'https://redd.it', 'https://old.reddit.com'],
      source: 'curated',
    });
  });

  it('hands back a copy, so a caller cannot edit the curated map', () => {
    sitesForApp('com.burbn.instagram').sites.push('https://example.com');
    expect(curatedSites['com.burbn.instagram']).toEqual(['https://instagram.com']);
  });

  it('derives the site from the seller url for an app it does not know', () => {
    expect(sitesForApp('com.example.app', 'http://www.example.com/mobile')).toEqual({
      sites: ['https://example.com'],
      source: 'seller',
    });
  });

  it('reads no site off an inherited object key', () => {
    expect(sitesForApp('constructor')).toEqual({ sites: [], source: 'none' });
  });

  it('has no sites for an app with no curated entry and no usable seller url', () => {
    expect(sitesForApp('com.example.app')).toEqual({ sites: [], source: 'none' });
    expect(sitesForApp('com.example.app', 'not a url')).toEqual({ sites: [], source: 'none' });
  });
});

describe('sitesForApps', () => {
  it('unions the sites in app order and lists each once', () => {
    expect(
      sitesForApps([
        { bundleId: 'com.google.ios.youtube' },
        { bundleId: 'com.google.ios.youtubekids' },
        { bundleId: 'com.example.app', sellerUrl: 'http://www.example.com/help' },
        { bundleId: 'com.google.ios.youtube' },
        { bundleId: 'com.example.other', sellerUrl: 'https://youtube.com/' },
      ]),
    ).toEqual([
      'https://youtube.com',
      'https://m.youtube.com',
      'https://youtu.be',
      'https://youtubekids.com',
      'https://example.com',
    ]);
  });

  it('skips apps that name no site', () => {
    expect(sitesForApps([{ bundleId: 'com.example.app' }])).toEqual([]);
    expect(sitesForApps([])).toEqual([]);
  });
});

describe('curatedSites', () => {
  it('writes every url the way a profile does', () => {
    for (const [bundleId, sites] of Object.entries(curatedSites)) {
      expect(sites.length, bundleId).toBeGreaterThan(0);
      for (const site of sites) {
        expect(normalizeUrl(site), bundleId).toBe(site);
        expect(site.startsWith('https://'), bundleId).toBe(true);
      }
    }
  });

  it('reaches a built profile unchanged', () => {
    const sites = sitesForApps(Object.keys(curatedSites).map((bundleId) => ({ bundleId })));
    const xml = buildProfile({
      ...profileConfig,
      webFilter: { deniedUrls: sites, mode: 'deny', permittedUrls: [] },
    });

    for (const site of sites) {
      expect(xml, site).toContain(`<string>${site}</string>`);
    }
  });
});

describe('normalizeUrl', () => {
  it('adds the scheme and drops a trailing slash', () => {
    expect(normalizeUrl('  x.com/  ')).toBe('https://x.com');
    expect(normalizeUrl('http://x.com')).toBe('http://x.com');
    expect(normalizeUrl('')).toBe('');
  });
});
