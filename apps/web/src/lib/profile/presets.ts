import type { ProfileConfig } from './types.ts';

/** Starting points the builder UI clones — never mutate one in place. */
export const presets: Record<'mert' | 'stopa' | 'minimal', ProfileConfig> = {
  mert: {
    allowAppStore: true,
    allowPrivateBrowsing: true,
    autoFilterAdult: true,
    // Only apps built around a vertical feed, ordered by average time per user
    // per day (Sensor Tower State of Mobile 2026, DataReportal Digital 2026).
    blockedApps: [
      { bundleId: 'com.zhiliaoapp.musically', name: 'TikTok' },
      { bundleId: 'com.google.ios.youtube', name: 'YouTube' },
      { bundleId: 'com.burbn.instagram', name: 'Instagram' },
      { bundleId: 'com.atebits.Tweetie2', name: 'X' },
      { bundleId: 'com.facebook.Facebook', name: 'Facebook' },
      { bundleId: 'com.toyopagroup.picaboo', name: 'Snapchat' },
      { bundleId: 'com.reddit.Reddit', name: 'Reddit' },
      { bundleId: 'pinterest', name: 'Pinterest' },
      { bundleId: 'com.burbn.barcelona', name: 'Threads' },
      { bundleId: 'com.linkedin.LinkedIn', name: 'LinkedIn' },
    ],
    displayName: 'attentionawareness',
    identifier: 'com.attentionawareness.profile',
    lockRemoval: true,
    organization: 'attentionawareness',
    webFilter: {
      deniedUrls: [
        'https://tiktok.com',
        'https://www.youtube.com',
        'https://m.youtube.com',
        'https://youtu.be',
        'https://instagram.com',
        'https://x.com',
        'https://twitter.com',
        'https://facebook.com',
        'https://snapchat.com',
        'https://reddit.com',
        'https://pinterest.com',
        'https://threads.net',
        'https://www.threads.com',
        'https://linkedin.com',
      ],
      mode: 'deny',
      // Sign-in for YouTube on other devices still has to resolve.
      permittedUrls: ['https://accounts.youtube.com'],
    },
  },
  minimal: {
    allowAppStore: true,
    allowPrivateBrowsing: true,
    autoFilterAdult: false,
    blockedApps: [],
    displayName: 'attentionawareness',
    identifier: 'com.attentionawareness.profile',
    lockRemoval: false,
    organization: 'attentionawareness',
    webFilter: { mode: 'off' },
  },
  stopa: {
    allowAppStore: true,
    allowPrivateBrowsing: true,
    autoFilterAdult: false,
    blockedApps: [],
    displayName: 'attentionawareness',
    identifier: 'com.attentionawareness.profile',
    lockRemoval: true,
    organization: 'attentionawareness',
    webFilter: {
      allowedUrls: [
        'https://maps.google.com',
        'https://mail.google.com',
        'https://calendar.google.com',
        'https://chatgpt.com',
        'https://claude.ai',
        'https://wikipedia.org',
      ],
      mode: 'allow',
    },
  },
};
