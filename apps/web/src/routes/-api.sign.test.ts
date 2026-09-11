import { ContentInfo, SignedData } from 'pkijs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { presets } from '../lib/profile/index.ts';
import type { ProfileConfig } from '../lib/profile/index.ts';
import { setSigningSecrets } from '../lib/signing-secrets.ts';
import { throwawaySecrets } from '../test/signing.ts';

// The route only needs the file-route factory; the test calls the handler.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
}));

const { Route } = await import('./api.sign.ts');

type Handler = (context: { request: Request }) => Promise<Response>;

const post = (Route as unknown as { server: { handlers: { POST: Handler } } }).server.handlers.POST;
const secrets = await throwawaySecrets();

/** One address per request, so the rate limiter never sees a second call. */
let caller = 0;

/** The body the page sends: the reader's choices, and no identifier. */
function payload(overrides: Partial<ProfileConfig> = {}): unknown {
  const { allowAppStore, allowPrivateBrowsing, autoFilterAdult, blockedApps, webFilter } = {
    ...presets.mert,
    ...overrides,
  };
  return {
    config: { allowAppStore, allowPrivateBrowsing, autoFilterAdult, blockedApps, webFilter },
  };
}

function sign(body: unknown, ip?: string): Promise<Response> {
  caller += 1;
  return post({
    request: new Request('https://attentionawareness.com/api/sign', {
      body: JSON.stringify(body),
      headers: {
        'cf-connecting-ip': ip ?? `203.0.113.${caller}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    }),
  });
}

/** The profile back out of the signature, which is where it travels. */
async function signedXml(response: Response): Promise<string> {
  const content = ContentInfo.fromBER(await response.arrayBuffer());
  const signed = new SignedData({ schema: content.content });
  return new TextDecoder().decode(signed.encapContentInfo.eContent?.getValue());
}

describe('POST /api/sign', () => {
  beforeEach(() => {
    setSigningSecrets({
      SIGNING_CERT_PEM: secrets.certPem,
      SIGNING_CHAIN_PEM: secrets.chainPem,
      SIGNING_KEY_PKCS8_PEM: secrets.keyPkcs8Pem,
    });
  });

  it('answers a valid config with a signed profile', async () => {
    const response = await sign(payload());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/x-apple-aspen-config');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="attentionawareness.mobileconfig"',
    );
    const xml = await signedXml(response);
    expect(xml).toContain('<key>PayloadRemovalDisallowed</key><true/>');
    expect(xml).toContain('com.atebits.Tweetie2');
  });

  it('mints a fresh identifier for every download', async () => {
    const first = await signedXml(await sign(payload()));
    const second = await signedXml(await sign(payload()));

    const identifier = /<key>PayloadIdentifier<\/key><string>([^<]+)<\/string>/u;
    const one = identifier.exec(first)?.[1] ?? '';
    const two = identifier.exec(second)?.[1] ?? '';
    expect(one).toMatch(/^com\.attentionawareness\./u);
    expect(two).toMatch(/^com\.attentionawareness\./u);
    expect(one).not.toBe(two);
  });

  it('locks the profile when the body says nothing about removal', async () => {
    const response = await sign(payload());

    expect(await signedXml(response)).toContain('<key>PayloadRemovalDisallowed</key><true/>');
  });

  it('leaves a trial profile removable when the body asks for one', async () => {
    const response = await sign({
      config: { ...(payload() as { config: object }).config, lockRemoval: false },
    });

    expect(await signedXml(response)).toContain('<key>PayloadRemovalDisallowed</key><false/>');
  });

  it('turns down a removal lock that is not a boolean', async () => {
    const response = await sign({
      config: { ...(payload() as { config: object }).config, lockRemoval: 'no' },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringContaining('lockRemoval') });
  });

  it('turns down a bundle id that is not one', async () => {
    const response = await sign(
      payload({ blockedApps: [{ bundleId: 'not a bundle', name: 'X' }] }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringContaining('bundleId') });
  });

  it('turns down a web filter it does not know', async () => {
    const response = await sign(
      payload({ webFilter: { mode: 'sideways' } as unknown as ProfileConfig['webFilter'] }),
    );

    expect(response.status).toBe(400);
  });

  it('says so when the signing secrets are missing', async () => {
    setSigningSecrets({});

    const response = await sign(payload());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'signing unavailable' });
  });

  it('turns one caller away after enough profiles', async () => {
    const ip = '198.51.100.7';
    const answers = [];
    for (let attempt = 0; attempt < 31; attempt += 1) {
      answers.push((await sign(payload({ blockedApps: [] }), ip)).status);
    }

    expect(answers.filter((status) => status === 200)).toHaveLength(30);
    expect(answers.at(-1)).toBe(429);
  });
});
