import { expect, test } from 'vitest';
import { buildCss, matchesDomain } from './css.ts';
import type { SiteId } from './sites.ts';
import { defaultSettings, type CustomRule, type Settings } from './storage.ts';

const rules: Record<SiteId, string> = {
  instagram: 'INSTAGRAM',
  tiktok: 'TIKTOK',
  x: 'X',
  youtube: 'YOUTUBE',
};

function settingsWith(patch: Partial<Settings>): Settings {
  return { ...defaultSettings, ...patch };
}

function customRule(patch: Partial<CustomRule>): CustomRule {
  return { css: 'CUSTOM', domain: 'reddit.com', enabled: true, id: 'one', ...patch };
}

test('matches a domain and everything under it', () => {
  expect(matchesDomain('reddit.com', 'reddit.com')).toBe(true);
  expect(matchesDomain('reddit.com', 'old.reddit.com')).toBe(true);
  expect(matchesDomain('*.reddit.com', 'old.reddit.com')).toBe(true);
  expect(matchesDomain(' Reddit.com ', 'OLD.REDDIT.COM')).toBe(true);
  expect(matchesDomain('reddit.com', 'notreddit.com')).toBe(false);
  expect(matchesDomain('reddit.com', 'reddit.com.evil.example')).toBe(false);
  expect(matchesDomain('', 'reddit.com')).toBe(false);
});

test('takes the site rule file when the site is on', () => {
  expect(buildCss({ hostname: 'x.com', rules, settings: defaultSettings, site: 'x' })).toBe('X');
});

test('takes nothing when that one site is off', () => {
  const settings = settingsWith({ sites: { ...defaultSettings.sites, x: false } });
  expect(buildCss({ hostname: 'x.com', rules, settings, site: 'x' })).toBe('');
});

test('takes nothing at all when the master switch is off', () => {
  const settings = settingsWith({
    custom: [customRule({})],
    enabled: false,
  });
  expect(buildCss({ hostname: 'reddit.com', rules, settings, site: 'x' })).toBe('');
});

test('appends a custom rule whose domain covers the host', () => {
  const settings = settingsWith({ custom: [customRule({})] });
  expect(buildCss({ hostname: 'old.reddit.com', rules, settings, site: null })).toBe('CUSTOM');
  expect(buildCss({ hostname: 'x.com', rules, settings, site: 'x' })).toBe('X');
});

test('skips a custom rule that is off, and one for another host', () => {
  const settings = settingsWith({
    custom: [customRule({ enabled: false }), customRule({ domain: 'news.example', id: 'two' })],
  });
  expect(buildCss({ hostname: 'reddit.com', rules, settings, site: null })).toBe('');
});
