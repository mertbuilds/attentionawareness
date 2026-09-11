import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { defaultSettings } from '../lib/storage.ts';
import { sentences, SITE_ORDER, siteStrings, strings } from '../lib/strings.ts';
import { mockChrome } from '../test/chrome.ts';
import { Popup } from './popup.tsx';

let extension = mockChrome();

beforeEach(() => {
  extension = mockChrome();
});

test('shows a row per site, every one of them on', async () => {
  render(<Popup />);

  expect(await screen.findByRole('switch', { checked: true, name: strings.master })).toBeVisible();
  for (const site of SITE_ORDER) {
    const { hides, name } = siteStrings[site];
    expect(screen.getByRole('switch', { checked: true, name })).toBeEnabled();
    expect(screen.getByText(hides)).toBeVisible();
  }
});

test('the master switch writes that it is off, and takes the rows with it', async () => {
  render(<Popup />);

  await userEvent.click(await screen.findByRole('switch', { name: strings.master }));

  expect(extension.store['enabled']).toBe(false);
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: siteStrings.x.name })).toBeDisabled();
  });
  for (const site of SITE_ORDER) {
    expect(screen.getByRole('switch', { name: siteStrings[site].name })).toBeDisabled();
  }
});

test('a site switch writes only its own site', async () => {
  render(<Popup />);

  await userEvent.click(await screen.findByRole('switch', { name: siteStrings.youtube.name }));

  expect(extension.store['sites']).toEqual({ ...defaultSettings.sites, youtube: false });
  expect(extension.store['enabled']).toBeUndefined();
});

test('counts the custom rules that are on, and says nothing when none are', async () => {
  extension = mockChrome({
    custom: [
      { css: 'a{}', domain: 'a.example', enabled: true, id: 'one' },
      { css: 'b{}', domain: 'b.example', enabled: false, id: 'two' },
    ],
  });
  render(<Popup />);

  expect(await screen.findByText(sentences.customCount(1))).toBeVisible();
});

test('the footer opens the options page and the site', async () => {
  render(<Popup />);

  await userEvent.click(await screen.findByRole('button', { name: strings.customCss }));
  expect(extension.openOptionsPage).toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: strings.website }));
  expect(extension.createTab).toHaveBeenCalledWith({ url: 'https://attentionawareness.com' });
});
