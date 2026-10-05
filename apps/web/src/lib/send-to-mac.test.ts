import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Track } from './download-press.ts';
import { canShare, copyLink, shareLink } from './send-to-mac.ts';
import type { Sender } from './send-to-mac.ts';

const URL =
  'https://attentionawareness.com/?utm_source=share&utm_medium=phone&utm_campaign=download#way-out';
const SHEET = { title: 'attention awareness', url: URL };

/** A browser that keeps what it was handed, and the events sent from it. */
function browser(share?: Sender['share']): {
  copied: Array<string>;
  events: Array<[string, Record<string, string>]>;
  sender: Sender;
  track: Track;
} {
  const copied: Array<string> = [];
  const events: Array<[string, Record<string, string>]> = [];
  return {
    copied,
    events,
    sender: {
      clipboard: {
        writeText: async (text) => {
          copied.push(text);
        },
      },
      share,
    },
    track: (event, properties) => events.push([event, properties]),
  };
}

test('share hands the link to the share sheet and says so', async () => {
  const shared: Array<{ title: string; url: string }> = [];
  const { copied, events, sender, track } = browser(async (sheet) => {
    shared.push(sheet);
  });
  assert.equal(canShare(sender), true);
  assert.equal(await shareLink(sender, SHEET, track), 'share_sheet');
  assert.deepEqual(shared, [SHEET]);
  assert.deepEqual(copied, []);
  assert.deepEqual(events, [['mac_download_link_shared', { share_method: 'share_sheet' }]]);
});

test('copy puts the link on the clipboard and says so', async () => {
  const { copied, events, sender, track } = browser(async () => {});
  assert.equal(await copyLink(sender, URL, track), 'clipboard');
  assert.deepEqual(copied, [URL]);
  assert.deepEqual(events, [['mac_download_link_shared', { share_method: 'clipboard' }]]);
});

test('without a share sheet, share copies', async () => {
  const { copied, events, sender, track } = browser();
  assert.equal(canShare(sender), false);
  assert.equal(await shareLink(sender, SHEET, track), 'clipboard');
  assert.deepEqual(copied, [URL]);
  assert.deepEqual(events, [['mac_download_link_shared', { share_method: 'clipboard' }]]);
});

test('a share sheet the reader closes shares nothing', async () => {
  const { copied, events, sender, track } = browser(async () => {
    throw new DOMException('closed', 'AbortError');
  });
  assert.equal(await shareLink(sender, SHEET, track), undefined);
  assert.deepEqual(copied, []);
  assert.deepEqual(events, []);
});

test('a share sheet that fails copies the link', async () => {
  const { copied, events, sender, track } = browser(async () => {
    throw new Error('no sheet');
  });
  assert.equal(await shareLink(sender, SHEET, track), 'clipboard');
  assert.deepEqual(copied, [URL]);
  assert.deepEqual(events, [['mac_download_link_shared', { share_method: 'clipboard' }]]);
});

test('a clipboard that refuses sends nothing', async () => {
  const { events, track } = browser();
  const sender: Sender = {
    clipboard: {
      writeText: async () => {
        throw new Error('refused');
      },
    },
  };
  assert.equal(await copyLink(sender, URL, track), undefined);
  assert.deepEqual(events, []);
});
