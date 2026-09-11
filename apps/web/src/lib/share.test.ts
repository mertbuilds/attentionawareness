import { describe, expect, it } from 'vitest';
import { m } from '../paraglide/messages.js';
import { presets } from './profile/index.ts';
import { decodeShare, encodeShare, shareTargets, shareText, SITE_URL } from './share.ts';

/** The twelve apps the generator opens with, as the share text names them. */
const RECOMMENDED = presets.mert.blockedApps.map((app) => app.name.toLowerCase());

const URL_WITH_STATE = `${SITE_URL}/?h=4&a=ig,tt`;

describe('encodeShare', () => {
  it('writes the recommended apps as their short codes', () => {
    expect(
      encodeShare({ bundleIds: ['com.burbn.instagram', 'com.zhiliaoapp.musically'], hours: 6 }),
    ).toBe('h=6&a=ig,tt');
  });

  it('writes an app it has no code for as its own bundle id', () => {
    expect(encodeShare({ bundleIds: ['com.example.chat'], hours: 4.5 })).toBe(
      'h=4.5&a=com.example.chat',
    );
  });

  it('leaves out the app list when nothing is blocked', () => {
    expect(encodeShare({ bundleIds: [], hours: 4 })).toBe('h=4');
  });
});

describe('decodeShare', () => {
  it('reads back everything encodeShare wrote', () => {
    const state = { bundleIds: presets.mert.blockedApps.map((app) => app.bundleId), hours: 7.5 };
    expect(decodeShare(encodeShare(state))).toEqual(state);
  });

  it('survives a link that lost its app list', () => {
    expect(decodeShare('h=3')).toEqual({ bundleIds: [], hours: 3 });
  });

  it('drops entries that name no app', () => {
    expect(decodeShare('a=ig,,<script>,tt').bundleIds).toEqual([
      'com.burbn.instagram',
      'com.zhiliaoapp.musically',
    ]);
  });

  it('lists an app once however often the link names it', () => {
    expect(decodeShare('a=ig,ig,com.burbn.instagram').bundleIds).toEqual(['com.burbn.instagram']);
  });

  it('keeps hours the slider can reach', () => {
    expect(decodeShare('h=12').hours).toBe(12);
  });

  it('clamps hours into the range the slider offers', () => {
    expect(decodeShare('h=13').hours).toBe(12);
    expect(decodeShare('h=99').hours).toBe(12);
    expect(decodeShare('h=-4').hours).toBe(1);
  });

  it('reads no hours from a value that is not a number', () => {
    expect(decodeShare('h=soon').hours).toBeUndefined();
    expect(decodeShare('h=').hours).toBeUndefined();
    expect(decodeShare('').hours).toBeUndefined();
  });
});

describe('shareText', () => {
  it('names three apps and counts the rest', () => {
    const text = shareText({
      appNames: RECOMMENDED,
      locale: 'en',
      url: URL_WITH_STATE,
      years: '5',
    });

    expect(text).toBe(
      m.share_text_more(
        { apps: 'instagram, threads, tiktok', count: 9, url: URL_WITH_STATE, years: '5' },
        { locale: 'en' },
      ),
    );
    expect(text).toContain(URL_WITH_STATE);
    // The fourth app onwards is counted, never named.
    expect(text).not.toContain('youtube');
  });

  it('names them all when there are three or fewer', () => {
    const text = shareText({
      appNames: ['instagram', 'tiktok'],
      locale: 'en',
      url: URL_WITH_STATE,
      years: '2.5',
    });

    expect(text).toBe(
      m.share_text_all(
        { apps: 'instagram, tiktok', url: URL_WITH_STATE, years: '2.5' },
        { locale: 'en' },
      ),
    );
    expect(text).toContain('instagram, tiktok');
  });
});

describe('shareTargets', () => {
  it('points each button at its own intent url', () => {
    const targets = shareTargets('took my time back', URL_WITH_STATE);

    expect(targets.x).toBe('https://x.com/intent/post?text=took%20my%20time%20back');
    expect(targets.whatsapp).toBe('https://wa.me/?text=took%20my%20time%20back');
    // LinkedIn writes its own text from the page it is handed.
    expect(targets.linkedin).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(URL_WITH_STATE)}`,
    );
  });
});
