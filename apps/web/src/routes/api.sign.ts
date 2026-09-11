import { createFileRoute } from '@tanstack/react-router';
import { buildProfile } from '../lib/profile/index.ts';
import type { BlockedApp, ProfileConfig } from '../lib/profile/index.ts';
import { signProfile } from '../lib/sign.ts';
import { signingSecrets } from '../lib/signing-secrets.ts';

const PROFILE_MIME = 'application/x-apple-aspen-config';
const FILENAME = 'keepyourattention.mobileconfig';
/**
 * Every download gets its own identifier, so a second profile stacks on the
 * first instead of replacing it. Nothing installed can be loosened afterwards.
 */
const IDENTIFIER_PREFIX = 'com.keepyourattention.';
const BRAND = 'keepyourattention';

const BUNDLE_ID = /^[A-Za-z0-9.-]{2,200}$/u;
const MAX_APPS = 200;
const MAX_BUNDLE_ID = 200;
const MAX_NAME = 80;
const MAX_URLS = 500;
const MAX_URL = 500;

/** Per isolate, so it only takes the edge off a flood. 30 signatures a minute. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
/** How many callers are tracked before the expired ones are swept out. */
const RATE_TRACKED = 1000;

const hits = new Map<string, { count: number; start: number }>();

class InvalidConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConfigError';
  }
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hit = hits.get(ip);
  if (hit === undefined || now - hit.start >= RATE_WINDOW_MS) {
    if (hits.size >= RATE_TRACKED) {
      for (const [key, tracked] of hits) {
        if (now - tracked.start >= RATE_WINDOW_MS) {
          hits.delete(key);
        }
      }
    }
    hits.set(ip, { count: 1, start: now });
    return false;
  }
  hit.count += 1;
  return hit.count > RATE_LIMIT;
}

function json(body: { error: string }, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json' },
    status,
  });
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidConfigError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new InvalidConfigError(`${field} must be a boolean`);
  }
  return value;
}

function asText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.length > max) {
    throw new InvalidConfigError(`${field} must be a string of at most ${max} characters`);
  }
  return value;
}

function asArray(value: unknown, field: string, max: number): Array<unknown> {
  if (!Array.isArray(value)) {
    throw new InvalidConfigError(`${field} must be an array`);
  }
  if (value.length > max) {
    throw new InvalidConfigError(`${field} takes at most ${max} entries`);
  }
  return value as Array<unknown>;
}

function asUrls(value: unknown, field: string): Array<string> {
  return asArray(value, field, MAX_URLS).map((url) => asText(url, `${field} entries`, MAX_URL));
}

function asBlockedApps(value: unknown): Array<BlockedApp> {
  return asArray(value, 'blockedApps', MAX_APPS).map((entry) => {
    const app = asRecord(entry, 'blockedApps entries');
    const bundleId = asText(app.bundleId, 'bundleId', MAX_BUNDLE_ID);
    if (!BUNDLE_ID.test(bundleId)) {
      throw new InvalidConfigError(`bundleId "${bundleId}" is not a bundle identifier`);
    }
    return {
      bundleId,
      name: asText(app.name, 'name', MAX_NAME),
      ...(app.sellerUrl === undefined
        ? {}
        : { sellerUrl: asText(app.sellerUrl, 'sellerUrl', MAX_URL) }),
    };
  });
}

function asWebFilter(value: unknown): ProfileConfig['webFilter'] {
  const filter = asRecord(value, 'webFilter');
  if (filter.mode === 'off') {
    return { mode: 'off' };
  }
  if (filter.mode === 'allow') {
    return { allowedUrls: asUrls(filter.allowedUrls, 'allowedUrls'), mode: 'allow' };
  }
  if (filter.mode === 'deny') {
    return {
      deniedUrls: asUrls(filter.deniedUrls, 'deniedUrls'),
      mode: 'deny',
      permittedUrls: asUrls(filter.permittedUrls, 'permittedUrls'),
    };
  }
  throw new InvalidConfigError('webFilter mode must be allow, deny or off');
}

/**
 * The reader chooses what to block. Everything that decides whether the
 * profile can be undone is the server's, and is written here, not read.
 */
function parseConfig(body: unknown): ProfileConfig {
  const config = asRecord(asRecord(body, 'body').config, 'config');
  return {
    allowAppStore: asBoolean(config.allowAppStore, 'allowAppStore'),
    allowPrivateBrowsing: asBoolean(config.allowPrivateBrowsing, 'allowPrivateBrowsing'),
    autoFilterAdult: asBoolean(config.autoFilterAdult, 'autoFilterAdult'),
    blockedApps: asBlockedApps(config.blockedApps),
    displayName: BRAND,
    identifier: `${IDENTIFIER_PREFIX}${crypto.randomUUID().toLowerCase()}`,
    lockRemoval: true,
    organization: BRAND,
    webFilter: asWebFilter(config.webFilter),
  };
}

/**
 * Signs one profile with the founder's Developer ID certificate. The key never
 * leaves the Worker, and nothing about the profile is logged.
 */
async function sign({ request }: { request: Request }): Promise<Response> {
  const secrets = signingSecrets();
  if (secrets === null) {
    return json({ error: 'signing unavailable' }, 503);
  }
  if (rateLimited(request.headers.get('cf-connecting-ip') ?? 'unknown')) {
    return json({ error: 'too many requests' }, 429);
  }

  let config: ProfileConfig;
  try {
    config = parseConfig(await request.json());
  } catch (error) {
    return json(
      { error: error instanceof InvalidConfigError ? error.message : 'invalid body' },
      400,
    );
  }

  let der: Uint8Array<ArrayBuffer>;
  try {
    der = await signProfile(new TextEncoder().encode(buildProfile(config)), secrets);
  } catch {
    // The reader can do nothing about a bad key, and the reason is ours to fix.
    return json({ error: 'signing failed' }, 500);
  }
  return new Response(der, {
    headers: {
      'cache-control': 'no-store',
      'content-disposition': `attachment; filename="${FILENAME}"`,
      'content-type': PROFILE_MIME,
    },
  });
}

export const Route = createFileRoute('/api/sign')({
  server: {
    handlers: {
      POST: sign,
    },
  },
});
