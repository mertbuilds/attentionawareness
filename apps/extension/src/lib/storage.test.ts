import { beforeEach, expect, test } from 'vitest';
import { mockChrome } from '../test/chrome.ts';
import {
  defaultSettings,
  getSettings,
  mergeSettings,
  onSettingsChange,
  setSettings,
} from './storage.ts';

beforeEach(() => {
  mockChrome();
});

test('empty storage is the defaults', () => {
  expect(mergeSettings(undefined)).toEqual(defaultSettings);
  expect(mergeSettings({})).toEqual(defaultSettings);
});

test('merges a partial sites object over the defaults', () => {
  expect(mergeSettings({ sites: { tiktok: false } }).sites).toEqual({
    ...defaultSettings.sites,
    tiktok: false,
  });
});

test('drops values of the wrong shape', () => {
  const settings = mergeSettings({
    custom: [
      { css: 'a{}', domain: 'a.example', enabled: true, id: 'one' },
      { domain: 'b.example' },
    ],
    enabled: 'yes',
    sites: { x: 'no', youtube: false },
  });
  expect(settings.enabled).toBe(true);
  expect(settings.sites).toEqual({ ...defaultSettings.sites, youtube: false });
  expect(settings.custom).toEqual([{ css: 'a{}', domain: 'a.example', enabled: true, id: 'one' }]);
});

test('reads what was written', async () => {
  await setSettings({ enabled: false });
  expect(await getSettings()).toEqual({ ...defaultSettings, enabled: false });
});

test('calls back on a change, and stops on unsubscribe', async () => {
  const seen: Array<boolean> = [];
  const unsubscribe = onSettingsChange((settings) => {
    seen.push(settings.enabled);
  });

  await setSettings({ enabled: false });
  await Promise.resolve();
  unsubscribe();
  await setSettings({ enabled: true });
  await Promise.resolve();

  expect(seen).toEqual([false]);
});
