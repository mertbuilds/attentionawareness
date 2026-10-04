import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shareSheet, shareUrl } from './share.ts';

const POPUP =
  'https://attentionawareness.com/?utm_source=share&utm_medium=popup&utm_campaign=download';

test('the popup shares the site with its own tags and nothing after them', () => {
  assert.equal(shareUrl('popup'), POPUP);
});

test('a phone shares the same link under its own name, open at the download', () => {
  assert.equal(
    shareUrl('phone'),
    'https://attentionawareness.com/?utm_source=share&utm_medium=phone&utm_campaign=download',
  );
  assert.equal(
    shareUrl('phone', 'way-out'),
    'https://attentionawareness.com/?utm_source=share&utm_medium=phone&utm_campaign=download#way-out',
  );
});

test('the thank-you shares the same link under its own name', () => {
  assert.equal(
    shareUrl('thanks'),
    'https://attentionawareness.com/?utm_source=share&utm_medium=thanks&utm_campaign=download',
  );
});

test('the campaign is one word, whatever the placement', () => {
  for (const placement of ['popup', 'phone', 'thanks'] as const) {
    const url = new URL(shareUrl(placement));
    assert.equal(url.searchParams.get('utm_campaign'), 'download');
    assert.equal(url.searchParams.get('utm_medium'), placement);
    assert.deepEqual([...url.searchParams.keys()], ['utm_source', 'utm_medium', 'utm_campaign']);
    assert.doesNotMatch(url.href, /%20|\s/);
  }
});

test('the share sheet gets the link and the name apart, and no sentence to join to the link', () => {
  const sheet = shareSheet(POPUP, 'Attention Awareness');
  assert.deepEqual(sheet, { title: 'Attention Awareness', url: POPUP });
  assert.equal('text' in sheet, false);
  assert.doesNotMatch(sheet.title, /https?:/);
});
