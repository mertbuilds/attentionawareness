import assert from 'node:assert/strict';
import { test } from 'node:test';
import { announcePhoneDownload, onPhoneDownload } from './download-started.ts';
import type { DownloadPress } from './download-started.ts';

/** A press from `placement`. No document here: any object stands for the button. */
function pressFrom(placement: string): DownloadPress {
  // @ts-expect-error The button is only ever handed back.
  return { button: new EventTarget(), placement };
}

test('a press before the popup is in waits for it, past a menu that opens first', () => {
  const menu: Array<string> = [];
  const popup: Array<string> = [];
  announcePhoneDownload(pressFrom('hero'));
  const stopMenu = onPhoneDownload((press) => menu.push(press.placement), false);
  assert.deepEqual(menu, []);
  const stopPopup = onPhoneDownload((press) => popup.push(press.placement), true);
  stopMenu();
  stopPopup();
  assert.deepEqual(menu, []);
  assert.deepEqual(popup, ['hero']);
});

test('a press the menu alone hears still waits for the popup', () => {
  const menu: Array<string> = [];
  const popup: Array<string> = [];
  const stopMenu = onPhoneDownload((press) => menu.push(press.placement), false);
  announcePhoneDownload(pressFrom('header'));
  assert.deepEqual(menu, ['header']);
  const stopPopup = onPhoneDownload((press) => popup.push(press.placement), true);
  stopMenu();
  stopPopup();
  assert.deepEqual(popup, ['header']);
});

test('a press the popup hears is not kept for the next to come', () => {
  const menu: Array<string> = [];
  const popup: Array<string> = [];
  const later: Array<string> = [];
  const stopMenu = onPhoneDownload((press) => menu.push(press.placement), false);
  const stopPopup = onPhoneDownload((press) => popup.push(press.placement), true);
  announcePhoneDownload(pressFrom('closing'));
  stopMenu();
  stopPopup();
  const stopLater = onPhoneDownload((press) => later.push(press.placement), true);
  stopLater();
  assert.deepEqual(menu, ['closing']);
  assert.deepEqual(popup, ['closing']);
  assert.deepEqual(later, []);
});
