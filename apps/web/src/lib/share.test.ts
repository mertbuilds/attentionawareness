import { describe, expect, it } from 'vitest';
import { m } from '../paraglide/messages.js';
import { presets } from './profile/index.ts';
import {
  decodeShare,
  encodeFriendShare,
  encodeShare,
  friendName,
  FRIEND_NAME_MAX,
  sharedAppName,
  shareTargets,
  shareText,
  SITE_URL,
} from './share.ts';

/** The twelve apps the generator opens with, as the share text names them. */
const RECOMMENDED = presets.mert.blockedApps.map((app) => app.name);
/** The apps a share names before it only counts them. */
const NAMED_APPS = 3;

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

  it('writes a day the dial cannot stop on as the minutes it is', () => {
    expect(encodeShare({ bundleIds: [], hours: 5, minutes: 30 })).toBe('m=330');
    expect(encodeShare({ bundleIds: ['com.burbn.instagram'], hours: 0, minutes: 45 })).toBe(
      'm=45&a=ig',
    );
  });

  it('writes a whole day as its hours, minutes or no minutes', () => {
    expect(encodeShare({ bundleIds: [], hours: 5, minutes: 0 })).toBe('h=5');
    expect(encodeShare({ bundleIds: [], hours: 5 })).toBe('h=5');
  });
});

describe('decodeShare', () => {
  it('reads back everything encodeShare wrote', () => {
    const state = { bundleIds: presets.mert.blockedApps.map((app) => app.bundleId), hours: 7 };
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

  it('rounds hours onto the stop the slider has', () => {
    expect(decodeShare('h=7.5').hours).toBe(8);
    expect(decodeShare('h=4.2').hours).toBe(4);
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

  it('splits a day in minutes back into the hours and the rest', () => {
    expect(decodeShare('m=330')).toEqual({ bundleIds: [], hours: 5, minutes: 30 });
    expect(decodeShare('m=45')).toEqual({ bundleIds: [], hours: 0, minutes: 45 });
    expect(decodeShare('m=0')).toEqual({ bundleIds: [], hours: 0, minutes: 0 });
  });

  it('clamps a day in minutes into the twelve hours the page prices', () => {
    expect(decodeShare('m=720')).toEqual({ bundleIds: [], hours: 12, minutes: 0 });
    expect(decodeShare('m=9999')).toEqual({ bundleIds: [], hours: 12, minutes: 0 });
    expect(decodeShare('m=-30')).toEqual({ bundleIds: [], hours: 0, minutes: 0 });
  });

  it('takes the minutes over the hours wherever a link carries both', () => {
    expect(decodeShare('h=9&m=330')).toEqual({ bundleIds: [], hours: 5, minutes: 30 });
    expect(decodeShare('h=9&m=soon').hours).toBe(9);
  });

  it('reads back a day it wrote in minutes', () => {
    const state = { bundleIds: ['com.burbn.instagram'], hours: 5, minutes: 30 };
    expect(decodeShare(encodeShare(state))).toEqual(state);
  });
});

describe('encodeFriendShare', () => {
  it('points at the friend page, carrying the day, the apps and the name', () => {
    expect(
      encodeFriendShare({
        bundleIds: ['com.burbn.instagram', 'com.zhiliaoapp.musically'],
        hours: 5,
        name: 'Mert',
      }),
    ).toBe(`${SITE_URL}/friend?h=5&a=ig,tt&n=Mert`);
  });

  it('leaves out a name nobody gave', () => {
    expect(encodeFriendShare({ bundleIds: [], hours: 4 })).toBe(`${SITE_URL}/friend?h=4`);
    expect(encodeFriendShare({ bundleIds: [], hours: 4, name: '   ' })).toBe(
      `${SITE_URL}/friend?h=4`,
    );
  });

  it('carries a day the dial cannot stop on as the minutes it is', () => {
    expect(encodeFriendShare({ bundleIds: [], hours: 5, minutes: 30, name: 'Ada' })).toBe(
      `${SITE_URL}/friend?m=330&n=Ada`,
    );
  });

  it('writes a name the query string would otherwise lose', () => {
    expect(encodeFriendShare({ bundleIds: [], hours: 4, name: 'Ayşe & Co' })).toBe(
      `${SITE_URL}/friend?h=4&n=Ay%C5%9Fe%20%26%20Co`,
    );
  });

  it('is read back by the same parser the generator uses', () => {
    const state = { bundleIds: ['com.burbn.instagram'], hours: 5, minutes: 30 };
    const url = new URL(encodeFriendShare({ ...state, name: 'Mert' }));

    expect(decodeShare(url.search)).toEqual(state);
    expect(friendName(url.searchParams.get('n'))).toBe('Mert');
  });
});

describe('friendName', () => {
  it('keeps a first name as it was typed', () => {
    expect(friendName('Mert')).toBe('Mert');
  });

  it('reads no name from a link that carries none', () => {
    expect(friendName(undefined)).toBeUndefined();
    expect(friendName(null)).toBeUndefined();
    expect(friendName('')).toBeUndefined();
    expect(friendName('   ')).toBeUndefined();
  });

  it('takes a name down to one line of words', () => {
    expect(friendName('  Mert \n\t Duzgun  ')).toBe('Mert Duzgun');
    expect(friendName('Me\u0000rt')).toBe('Me rt');
  });

  it('cuts a name that is a paragraph down to a name', () => {
    expect(friendName('x'.repeat(100))).toBe('x'.repeat(FRIEND_NAME_MAX));
    // The cut lands mid-space, and a name never ends on one.
    expect(friendName(`${'x'.repeat(FRIEND_NAME_MAX)} and everyone else`)).toBe(
      'x'.repeat(FRIEND_NAME_MAX),
    );
  });
});

describe('sharedAppName', () => {
  it('names an app the recommended list knows', () => {
    expect(sharedAppName('com.zhiliaoapp.musically')).toBe('TikTok');
  });

  it('falls back to the last label of an id it has never seen', () => {
    expect(sharedAppName('com.example.chat')).toBe('chat');
    expect(sharedAppName('pinterest')).toBe('Pinterest');
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
