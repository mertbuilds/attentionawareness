import { expect, test } from 'vitest';
import { customDomains, desiredMatches } from './registration.ts';
import { defaultSettings, type CustomRule, type Settings } from './storage.ts';

function settingsWith(custom: Array<Partial<CustomRule>>): Settings {
  return {
    ...defaultSettings,
    custom: custom.map((rule, index) => ({
      css: 'CUSTOM',
      domain: 'reddit.com',
      enabled: true,
      id: String(index),
      ...rule,
    })),
  };
}

function granted(...domains: Array<string>): Array<string> {
  return domains.flatMap((domain) => [`*://*.${domain}/*`, `*://${domain}/*`]);
}

test('needs a registration for every enabled rule outside the four sites', () => {
  const settings = settingsWith([
    { domain: 'https://Reddit.com/r/x' },
    { domain: 'reddit.com' },
    { domain: 'news.ycombinator.com' },
    { domain: 'www.youtube.com' },
    { domain: 'hn.example', enabled: false },
    { domain: 'not a domain' },
  ]);
  expect(customDomains(settings)).toEqual(['news.ycombinator.com', 'reddit.com']);
});

test('registers only the domains whose origins were granted', () => {
  const settings = settingsWith([{ domain: 'reddit.com' }, { domain: 'news.ycombinator.com' }]);
  expect(desiredMatches(settings, granted('reddit.com'))).toEqual([
    '*://*.reddit.com/*',
    '*://reddit.com/*',
  ]);
});

test('leaves out a domain granted only half', () => {
  const settings = settingsWith([{ domain: 'reddit.com' }]);
  expect(desiredMatches(settings, ['*://*.reddit.com/*'])).toEqual([]);
});

test('registers nothing when there is nothing to register', () => {
  expect(desiredMatches(defaultSettings, granted('reddit.com'))).toEqual([]);
});

test('keeps the registration when the master switch is off', () => {
  const settings = { ...settingsWith([{ domain: 'reddit.com' }]), enabled: false };
  expect(desiredMatches(settings, granted('reddit.com'))).toEqual([
    '*://*.reddit.com/*',
    '*://reddit.com/*',
  ]);
});
