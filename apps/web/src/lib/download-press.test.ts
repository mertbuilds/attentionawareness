import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadFor } from './download-press.ts';
import type { Download, Track } from './download-press.ts';
import { onDownloadStarted, onPhoneDownload } from './download-started.ts';
import type { DownloadPress } from './download-started.ts';

const RELEASE = {
  filename: 'attention-awareness-0.4.1.dmg',
  url: '/mac/attention-awareness-0.4.1-12.dmg',
};

/** One press on the download a device gets, and all that came of it. */
function press(mobile: boolean): {
  download: Download;
  events: Array<[string, Record<string, string>]>;
  phone: Array<DownloadPress>;
  started: Array<DownloadPress>;
} {
  const events: Array<[string, Record<string, string>]> = [];
  const started: Array<DownloadPress> = [];
  const phone: Array<DownloadPress> = [];
  const track: Track = (event, properties) => events.push([event, properties]);
  // The popup after a download listens to the first, the phone's popup to the second.
  const stopStarted = onDownloadStarted((heard) => started.push(heard), true);
  const stopPhone = onPhoneDownload((heard) => phone.push(heard), true);
  const download = downloadFor(RELEASE, mobile, 'hero', track);
  const event = { currentTarget: new EventTarget() };
  try {
    if (download.kind === 'phone') {
      // @ts-expect-error No document here: any object stands for the button.
      download.open(event);
    }
    if (download.kind === 'file') {
      // @ts-expect-error The same.
      download.start(event);
    }
  } finally {
    stopStarted();
    stopPhone();
  }
  return { download, events, phone, started };
}

test('a press on a phone opens its popup and starts no download', () => {
  const { download, events, phone, started } = press(true);
  assert.equal(download.kind, 'phone');
  assert.equal('url' in download, false);
  assert.equal('filename' in download, false);
  assert.equal(phone.length, 1);
  assert.equal(phone[0]?.placement, 'hero');
  assert.deepEqual(events, []);
  assert.deepEqual(started, []);
});

test('a press on a computer starts the file and opens the popup after a download', () => {
  const { download, events, phone, started } = press(false);
  assert.equal(download.kind, 'file');
  assert.equal('url' in download && download.url, RELEASE.url);
  assert.equal('filename' in download && download.filename, RELEASE.filename);
  assert.deepEqual(events, [['mac_download_started', { placement: 'hero' }]]);
  assert.equal(started.length, 1);
  assert.equal(started[0]?.placement, 'hero');
  assert.deepEqual(phone, []);
});

const track: Track = () => assert.fail('nothing is sent');

test('every device has the same button before the release is read, and with none', () => {
  for (const mobile of [true, false]) {
    assert.deepEqual(downloadFor(undefined, mobile, 'hero', track), { kind: 'reading' });
    assert.deepEqual(downloadFor(null, mobile, 'hero', track), { kind: 'unreleased' });
  }
});
