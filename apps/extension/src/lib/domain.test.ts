import { expect, test } from 'vitest';
import { normalizeDomain, originPatterns } from './domain.ts';

test('takes a domain out of whatever the address bar handed over', () => {
  expect(normalizeDomain('reddit.com')).toBe('reddit.com');
  expect(normalizeDomain('  Reddit.com  ')).toBe('reddit.com');
  expect(normalizeDomain('https://Reddit.com/r/x')).toBe('reddit.com');
  expect(normalizeDomain('http://old.reddit.com:8080/r/x?q=1#top')).toBe('old.reddit.com');
  expect(normalizeDomain('*.reddit.com')).toBe('reddit.com');
  expect(normalizeDomain('reddit.com.')).toBe('reddit.com');
  expect(normalizeDomain('https://user:pass@news.ycombinator.com/')).toBe('news.ycombinator.com');
});

test('refuses everything that is not a host', () => {
  expect(normalizeDomain('')).toBeNull();
  expect(normalizeDomain('   ')).toBeNull();
  expect(normalizeDomain('reddit')).toBeNull();
  expect(normalizeDomain('localhost')).toBeNull();
  expect(normalizeDomain('127.0.0.1')).toBeNull();
  expect(normalizeDomain('red dit.com')).toBeNull();
  expect(normalizeDomain('-reddit.com')).toBeNull();
  expect(normalizeDomain('reddit..com')).toBeNull();
  expect(normalizeDomain('https://')).toBeNull();
});

test('asks for the domain and everything under it', () => {
  expect(originPatterns('reddit.com')).toEqual(['*://*.reddit.com/*', '*://reddit.com/*']);
});
