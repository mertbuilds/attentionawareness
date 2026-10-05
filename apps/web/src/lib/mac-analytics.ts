/**
 * Counts the Mac app's downloads and update checks on the server, where no
 * blocker can drop them: one OpenPanel event per dmg download and per Sparkle
 * feed check. The event goes out after the file is already on its way.
 */
import { isLiveHost } from './canonical.ts';

/** The self-hosted OpenPanel's event API, the same host `/op` proxies to. */
const TRACK_URL = 'https://analytics.vinena.studio/api/track';
const APPCAST_PATH = '/mac/appcast.xml';
/**
 * `attention-awareness-<version>-<build>.dmg`, or `-<version>.dmg` from before
 * the build number joined the name.
 */
const DMG_NAME = /^\/mac\/attention-awareness-(\d+(?:\.\d+)*)(?:-(\d+))?\.dmg$/u;
/** Sparkle's agent is `<app name>/<app version> Sparkle/<sparkle version>`. */
const SPARKLE_AGENT = /\/([^\s/]+) Sparkle\//u;
/**
 * A page on a dev server, a LAN address or a Workers preview. `latest.json`
 * names the live dmg, so a download pressed on a local page reaches the live
 * site; it is not counted.
 */
const LOCAL_REFERRER =
  /(?:^|\.)(?:localhost|local)$|\.workers\.dev$|^\d{1,3}(?:\.\d{1,3}){3}$|^\[/u;
/** The app's own requests say `attention awareness mac/<version>`. */
const APP_AGENT = 'attention awareness mac/';

export type MacEvent = {
  name: 'mac_appcast_check' | 'mac_download';
  /** An `undefined` value is left out of the sent JSON. */
  properties: Record<string, string | undefined>;
};

/** The Worker bindings the sender reads. Both, or nothing is sent. */
export type MacAnalyticsEnv = {
  OPENPANEL_CLIENT_ID?: string | undefined;
  OPENPANEL_CLIENT_SECRET?: string | undefined;
};

/**
 * The event a response under `/mac/` counts as, or `null`. A download is a GET
 * of a dmg answered with the whole file or with a range from its first byte,
 * so a resumed or split download counts once and a HEAD, a 304, a miss or a
 * press on a local or preview page not at all. A feed check is a GET of the appcast that was answered.
 */
export function macFileEvent(request: Request, url: URL, response: Response): MacEvent | null {
  if (request.method !== 'GET') {
    return null;
  }
  const agent = request.headers.get('user-agent') ?? '';
  const sparkleVersion = SPARKLE_AGENT.exec(agent)?.[1];
  if (url.pathname === APPCAST_PATH) {
    return response.status === 200 || response.status === 304
      ? { name: 'mac_appcast_check', properties: { app_version: sparkleVersion } }
      : null;
  }
  if (!url.pathname.startsWith('/mac/') || !url.pathname.endsWith('.dmg')) {
    return null;
  }
  const fromFirstByte =
    response.status === 200 ||
    (response.status === 206 &&
      (response.headers.get('content-range')?.startsWith('bytes 0-') ?? false));
  if (!fromFirstByte) {
    return null;
  }
  const referrer = request.headers.get('referer');
  const referrerHost = referrer === null ? undefined : URL.parse(referrer)?.hostname;
  if (referrerHost !== undefined && LOCAL_REFERRER.test(referrerHost)) {
    return null;
  }
  const [, version, build] = DMG_NAME.exec(url.pathname) ?? [];
  return {
    name: 'mac_download',
    properties: {
      build,
      referrer_host: referrerHost,
      source: sparkleVersion !== undefined || agent.startsWith(APP_AGENT) ? 'sparkle' : 'browser',
      version,
    },
  };
}

/**
 * Sends the event to OpenPanel with the visitor's address and agent, so each
 * visitor is a device of their own. Never rejects, so the caller can hand it
 * to `waitUntil`, and skips silently off the live site or without the
 * client credentials.
 */
export async function sendMacEvent(
  event: MacEvent,
  request: Request,
  env: MacAnalyticsEnv,
): Promise<void> {
  const clientId = env.OPENPANEL_CLIENT_ID;
  const clientSecret = env.OPENPANEL_CLIENT_SECRET;
  if (!clientId || !clientSecret || !isLiveHost(new URL(request.url).hostname)) {
    return;
  }
  const headers = new Headers({
    'content-type': 'application/json',
    'openpanel-client-id': clientId,
    'openpanel-client-secret': clientSecret,
  });
  const agent = request.headers.get('user-agent');
  if (agent !== null) {
    headers.set('user-agent', agent);
  }
  // `x-client-ip` alone collapses every server event into one device.
  const ip = request.headers.get('cf-connecting-ip');
  if (ip !== null) {
    headers.set('openpanel-client-ip', ip);
    headers.set('x-client-ip', ip);
  }
  try {
    await fetch(TRACK_URL, {
      body: JSON.stringify({ payload: event, type: 'track' }),
      headers,
      method: 'POST',
    });
  } catch {
    // A lost event never costs a download.
  }
}
