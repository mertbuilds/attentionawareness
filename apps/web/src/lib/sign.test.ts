import { ContentInfo, SignedData } from 'pkijs';
import { describe, expect, it } from 'vitest';
import { throwawaySecrets } from '../test/signing.ts';
import { InvalidSigningSecretError, signProfile } from './sign.ts';

const OID_DATA = '1.2.840.113549.1.7.1';
const XML = '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict/></plist>\n';

function parse(der: Uint8Array<ArrayBuffer>): SignedData {
  return new SignedData({ schema: ContentInfo.fromBER(der).content });
}

describe('signProfile', () => {
  it('embeds the profile and signs it with the certificate that came in', async () => {
    const secrets = await throwawaySecrets();

    const signed = parse(await signProfile(new TextEncoder().encode(XML), secrets));

    expect(signed.version).toBe(1);
    expect(signed.encapContentInfo.eContentType).toBe(OID_DATA);
    const content = signed.encapContentInfo.eContent?.getValue() ?? new ArrayBuffer(0);
    expect(new TextDecoder().decode(content)).toBe(XML);
    await expect(signed.verify({ signer: 0 })).resolves.toBe(true);
  });

  it('carries the chain, so a device can reach the issuer above the leaf', async () => {
    const secrets = await throwawaySecrets();

    const signed = parse(await signProfile(new TextEncoder().encode(XML), secrets));

    expect(signed.certificates).toHaveLength(2);
  });

  it('signs the three attributes, not the content', async () => {
    const secrets = await throwawaySecrets();

    const signed = parse(await signProfile(new TextEncoder().encode(XML), secrets));

    expect(
      signed.signerInfos[0]?.signedAttrs?.attributes.map((attribute) => attribute.type),
    ).toEqual(['1.2.840.113549.1.9.3', '1.2.840.113549.1.9.4', '1.2.840.113549.1.9.5']);
  });

  it('refuses a secret that holds no PEM block', async () => {
    const secrets = await throwawaySecrets();

    await expect(
      signProfile(new TextEncoder().encode(XML), { ...secrets, certPem: '' }),
    ).rejects.toThrow(InvalidSigningSecretError);
  });
});
