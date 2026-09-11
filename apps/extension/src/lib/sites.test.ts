import { expect, test } from 'vitest';
import { siteFor } from './sites.ts';

test('matches the four sites and their subdomains', () => {
  expect(siteFor('x.com')).toBe('x');
  expect(siteFor('www.x.com')).toBe('x');
  expect(siteFor('twitter.com')).toBe('x');
  expect(siteFor('mobile.twitter.com')).toBe('x');
  expect(siteFor('www.youtube.com')).toBe('youtube');
  expect(siteFor('m.youtube.com')).toBe('youtube');
  expect(siteFor('www.instagram.com')).toBe('instagram');
  expect(siteFor('www.tiktok.com')).toBe('tiktok');
});

test('matches nothing else', () => {
  expect(siteFor('example.com')).toBeNull();
  expect(siteFor('notx.com')).toBeNull();
  expect(siteFor('x.com.evil.example')).toBeNull();
  expect(siteFor('')).toBeNull();
});
