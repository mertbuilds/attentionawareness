import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { sentences, strings } from '../lib/strings.ts';
import { mockChrome } from '../test/chrome.ts';
import { Options } from './options.tsx';

const RULES = [
  { css: 'h1 { display: none }', domain: 'reddit.com', enabled: true, id: 'one' },
  { css: 'aside { display: none }', domain: 'news.ycombinator.com', enabled: false, id: 'two' },
];

let extension = mockChrome();

beforeEach(() => {
  extension = mockChrome({ custom: RULES });
});

function domainFields(): Array<HTMLInputElement> {
  return screen.getAllByRole<HTMLInputElement>('textbox', { name: strings.domainLabel });
}

function cssFields(): Array<HTMLTextAreaElement> {
  return screen.getAllByRole<HTMLTextAreaElement>('textbox', { name: strings.cssLabel });
}

/** The first row's field, once the page has read storage. */
async function firstDomainField(): Promise<HTMLInputElement> {
  await screen.findByRole('button', { name: strings.add });
  await waitFor(() => expect(domainFields().length).toBeGreaterThan(0));
  const [field] = domainFields();
  if (field === undefined) {
    throw new Error('no rule on the page');
  }
  return field;
}

test('draws the rules that are already saved', async () => {
  render(<Options />);

  await waitFor(() => expect(domainFields()).toHaveLength(2));
  expect(domainFields().map((field) => field.value)).toEqual([
    'reddit.com',
    'news.ycombinator.com',
  ]);
  expect(cssFields().map((field) => field.value)).toEqual([
    'h1 { display: none }',
    'aside { display: none }',
  ]);
  expect(screen.getByRole('switch', { name: 'reddit.com' })).toBeChecked();
  expect(screen.getByRole('switch', { name: 'news.ycombinator.com' })).not.toBeChecked();
});

test('Add rule opens a row and writes it once the typing stops', async () => {
  extension = mockChrome();
  render(<Options />);

  await userEvent.click(await screen.findByRole('button', { name: strings.add }));
  expect(domainFields()).toHaveLength(1);
  expect(extension.store['custom']).toBeUndefined();

  await waitFor(() => {
    expect(extension.store['custom']).toEqual([
      { css: '', domain: '', enabled: true, id: expect.any(String) },
    ]);
  });
  expect(await screen.findByText(strings.saved)).toBeVisible();
});

test('a typed URL is stored as the domain inside it', async () => {
  render(<Options />);
  const field = await firstDomainField();

  await userEvent.clear(field);
  await userEvent.type(field, 'https://Reddit.com/r/x');
  await userEvent.tab();

  expect(field.value).toBe('reddit.com');
  await waitFor(() => {
    expect(extension.store['custom']).toEqual([{ ...RULES[0], domain: 'reddit.com' }, RULES[1]]);
  });
});

test('a domain that is not one says so, and asks for nothing', async () => {
  render(<Options />);
  const field = await firstDomainField();

  await userEvent.clear(field);
  await userEvent.type(field, 'reddit');
  await userEvent.tab();

  expect(await screen.findByText(strings.badDomain)).toBeVisible();
  expect(extension.requestPermissions).not.toHaveBeenCalled();
});

test('a new host is asked for, and a refused one leaves the rule off', async () => {
  extension = mockChrome();
  extension.requestPermissions.mockResolvedValue(false);
  render(<Options />);

  await userEvent.click(await screen.findByRole('button', { name: strings.add }));
  await userEvent.type(await firstDomainField(), 'reddit.com');
  await userEvent.tab();

  expect(extension.requestPermissions).toHaveBeenCalledWith({
    origins: ['*://*.reddit.com/*', '*://reddit.com/*'],
  });
  expect(await screen.findByText(sentences.denied('reddit.com'))).toBeVisible();
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: 'reddit.com' })).not.toBeChecked();
  });
  await waitFor(() => {
    expect(extension.store['custom']).toEqual([
      { css: '', domain: 'reddit.com', enabled: false, id: expect.any(String) },
    ]);
  });
});

test('a site the manifest already covers is never asked for', async () => {
  extension = mockChrome();
  render(<Options />);

  await userEvent.click(await screen.findByRole('button', { name: strings.add }));
  await userEvent.type(await firstDomainField(), 'youtube.com');
  await userEvent.tab();

  expect(extension.requestPermissions).not.toHaveBeenCalled();
});

test('Remove takes two clicks', async () => {
  render(<Options />);

  await waitFor(() => expect(domainFields()).toHaveLength(2));
  const [remove] = screen.getAllByRole('button', { name: strings.remove });
  await userEvent.click(remove as HTMLElement);

  expect(domainFields()).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: strings.removeConfirm }));

  expect(domainFields()).toHaveLength(1);
  await waitFor(() => expect(extension.store['custom']).toEqual([RULES[1]]));
});

test('Tab in the CSS field indents instead of leaving it', async () => {
  render(<Options />);
  await waitFor(() => expect(cssFields()).toHaveLength(2));
  const [field] = cssFields();

  await userEvent.clear(field as HTMLTextAreaElement);
  // `{{` is how user-event types one brace, and `{Enter}` is the key.
  await userEvent.type(field as HTMLTextAreaElement, 'a {{{Enter}');
  await userEvent.tab();

  expect((field as HTMLTextAreaElement).value).toBe('a {\n  ');
  expect(field).toHaveFocus();
});
