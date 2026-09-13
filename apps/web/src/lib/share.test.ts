import { describe, expect, it } from 'vitest';
import { m } from '../paraglide/messages.js';
import { presets } from './profile/index.ts';
import { decodeShare, encodeShare, shareTargets, shareText, SITE_URL } from './share.ts';

/** The twelve apps the generator opens with, as the share text names them. */
const RECOMMENDED = presets.mert.blockedApps.map((app) => app.name);
/** The apps a share names before it only counts them. */
const NAMED_APPS = 3;

const URL_WITH_STATE = `${SITE_URL}/?h=4&a=ig,tt`;

describe('encodeShare', () => {
  it('writes the recommended apps as their short codes', () => {
    expect(
      encodeShare({ bundleIds: ['com.burbn.instagram', 'com.zhiliaoapp.musically'], minutes: 360 }),
    ).toBe('h=6&a=ig,tt');
  });

  it('writes an app it has no code for as its own bundle id', () => {
    expect(encodeShare({ bundleIds: ['com.example.chat'], minutes: 270 })).toBe(
      'm=270&a=com.example.chat',
    );
  });

  it('writes a whole hour as hours, and anything else as minutes', () => {
    expect(encodeShare({ bundleIds: [], minutes: 240 })).toBe('h=4');
    expect(encodeShare({ bundleIds: [], minutes: 255 })).toBe('m=255');
    expect(encodeShare({ bundleIds: [], minutes: 0 })).toBe('h=0');
  });

  it('leaves out the app list when nothing is blocked', () => {
    expect(encodeShare({ bundleIds: [], minutes: 240 })).toBe('h=4');
  });
});

describe('decodeShare', () => {
  it('reads back everything encodeShare wrote', () => {
    const state = { bundleIds: presets.mert.blockedApps.map((app) => app.bundleId), minutes: 420 };
    expect(decodeShare(encodeShare(state))).toEqual(state);
  });

  it('reads back a day with minutes on it', () => {
    const state = { bundleIds: ['com.burbn.instagram'], minutes: 255 };
    expect(decodeShare(encodeShare(state))).toEqual(state);
  });

  it('survives a link that lost its app list', () => {
    expect(decodeShare('h=3')).toEqual({ bundleIds: [], minutes: 180 });
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

  it('keeps a day the register can hold', () => {
    expect(decodeShare('h=12').minutes).toBe(720);
    expect(decodeShare('m=255').minutes).toBe(255);
  });

  it('reads an hour with a fraction on it as the minutes it comes to', () => {
    expect(decodeShare('h=7.5').minutes).toBe(450);
    expect(decodeShare('h=4.25').minutes).toBe(255);
  });

  it('rounds a fraction of a minute onto the nearer one', () => {
    expect(decodeShare('m=255.4').minutes).toBe(255);
    expect(decodeShare('m=255.6').minutes).toBe(256);
  });

  it('clamps a day into the range the register offers', () => {
    expect(decodeShare('m=9999').minutes).toBe(779);
    expect(decodeShare('h=13').minutes).toBe(779);
    expect(decodeShare('h=-4').minutes).toBe(0);
  });

  it('falls back on the hours when the minutes are unreadable', () => {
    expect(decodeShare('m=soon&h=3').minutes).toBe(180);
  });

  it('reads no day from a value that is not a number', () => {
    expect(decodeShare('h=soon').minutes).toBeUndefined();
    expect(decodeShare('m=soon').minutes).toBeUndefined();
    expect(decodeShare('h=').minutes).toBeUndefined();
    expect(decodeShare('').minutes).toBeUndefined();
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
        {
          apps: 'Instagram, Threads, TikTok',
          count: RECOMMENDED.length - NAMED_APPS,
          url: URL_WITH_STATE,
          years: '5',
        },
        { locale: 'en' },
      ),
    );
    expect(text).toContain(URL_WITH_STATE);
    // The fourth app onwards is counted, never named.
    expect(text).not.toContain('YouTube');
  });

  it('names them all when there are three or fewer', () => {
    const text = shareText({
      appNames: ['Instagram', 'TikTok'],
      locale: 'en',
      url: URL_WITH_STATE,
      years: '2.5',
    });

    expect(text).toBe(
      m.share_text_all(
        { apps: 'Instagram, TikTok', url: URL_WITH_STATE, years: '2.5' },
        { locale: 'en' },
      ),
    );
    expect(text).toContain('Instagram, TikTok');
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
