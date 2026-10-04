import type { SessionRecordingOptions } from 'posthog-js';

/**
 * Session replay shows the site's own copy and hides what a visitor chose.
 * Masking follows marked elements, not the address, so a portal opened from
 * `/build` stays covered: every element that renders the apps or sites a
 * visitor picks carries this attribute, portals included.
 * Why: `docs/adr/0003-session-replay.md` and `docs/adr/0004-posthog-proxy-domain.md`.
 */
export const replayMask = { 'data-replay-mask': '' } as const;

const MASKED = '[data-replay-mask]';
/** App Store icons: the picture alone names the app. */
const APP_STORE_ICON = 'img[src*="mzstatic.com"]';
/** Attributes that carry an app's or a site's name inside a marked subtree. */
const MASKED_ATTRIBUTES = ['alt', 'aria-label', 'title'];

/**
 * OpenPanel's recorder masks attributes nowhere, so it does not record a
 * marked subtree at all: the replay draws an empty box of the same size.
 * Inputs stay masked everywhere.
 */
export const openPanelReplay = {
  blockSelector: `${MASKED}, ${APP_STORE_ICON}`,
  enabled: true,
  maskAllInputs: true,
  maskAllText: false,
  sampleRate: 0.1,
} as const;

/**
 * PostHog records a marked subtree with its text and naming attributes masked.
 * App Store icons and requests never reach it, wherever they are. `class`
 * stays visible: a StyleX page replays unstyled without it.
 */
export const posthogReplay = {
  blockSelector: APP_STORE_ICON,
  maskAllInputs: true,
  maskAttributeFn: (
    name: string,
    value: string,
    element?: { closest(selector: string): unknown },
  ) =>
    MASKED_ATTRIBUTES.includes(name) && (element === undefined || element.closest(MASKED) !== null)
      ? '*'
      : value,
  maskCapturedNetworkRequestFn: (request) =>
    /itunes\.apple\.com|mzstatic\.com/u.test(request.name) ? null : request,
  maskTextSelector: `${MASKED}, ${MASKED} *`,
} satisfies SessionRecordingOptions;
