import { Integer, PrintableString } from 'asn1js';
import { AttributeTypeAndValue, Certificate } from 'pkijs';
import { ensurePkijsEngine } from '../lib/sign.ts';
import type { SigningSecrets } from '../lib/sign.ts';

/** X.500 commonName, the only attribute these throwaway names carry. */
const COMMON_NAME = '2.5.4.3';
const AUTHORITY = 'keepyourattention test authority';
const LEAF = 'keepyourattention test';
const RSA = {
  hash: 'SHA-256',
  modulusLength: 2048,
  name: 'RSASSA-PKCS1-v1_5',
  publicExponent: new Uint8Array([1, 0, 1]),
} satisfies RsaHashedKeyGenParams;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const PEM_WIDTH = /.{1,64}/gu;

function pem(label: string, der: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  return `-----BEGIN ${label}-----\n${(base64.match(PEM_WIDTH) ?? []).join('\n')}\n-----END ${label}-----\n`;
}

function commonName(value: string): AttributeTypeAndValue {
  return new AttributeTypeAndValue({
    type: COMMON_NAME,
    value: new PrintableString({ value }),
  });
}

async function certificate(
  subject: string,
  keys: CryptoKeyPair,
  issuer?: { key: CryptoKey; name: string },
): Promise<Certificate> {
  const cert = new Certificate();
  cert.version = 2;
  cert.serialNumber = new Integer({ value: Date.now() });
  cert.issuer.typesAndValues.push(commonName(issuer?.name ?? subject));
  cert.subject.typesAndValues.push(commonName(subject));
  cert.notBefore.value = new Date(Date.now() - YEAR_MS);
  cert.notAfter.value = new Date(Date.now() + YEAR_MS);
  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  await cert.sign(issuer?.key ?? keys.privateKey, 'SHA-256');
  return cert;
}

/**
 * A one-off certificate authority and the leaf it issues, so a test can sign
 * without the real Developer ID key ever coming near it.
 */
export async function throwawaySecrets(): Promise<SigningSecrets> {
  ensurePkijsEngine();
  const authority = await crypto.subtle.generateKey(RSA, true, ['sign', 'verify']);
  const leaf = await crypto.subtle.generateKey(RSA, true, ['sign', 'verify']);
  const authorityCert = await certificate(AUTHORITY, authority);
  const leafCert = await certificate(LEAF, leaf, { key: authority.privateKey, name: AUTHORITY });
  return {
    certPem: pem('CERTIFICATE', leafCert.toSchema(true).toBER(false)),
    chainPem: pem('CERTIFICATE', authorityCert.toSchema(true).toBER(false)),
    keyPkcs8Pem: pem('PRIVATE KEY', await crypto.subtle.exportKey('pkcs8', leaf.privateKey)),
  };
}
