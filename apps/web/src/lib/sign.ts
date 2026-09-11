import { ObjectIdentifier, OctetString, UTCTime } from 'asn1js';
import {
  Attribute,
  Certificate,
  ContentInfo,
  CryptoEngine,
  EncapsulatedContentInfo,
  IssuerAndSerialNumber,
  setEngine,
  SignedAndUnsignedAttributes,
  SignedData,
  SignerInfo,
} from 'pkijs';
import type { ICryptoEngine } from 'pkijs';

/** The three PEM blobs the signer needs. They live in Worker secrets only. */
export type SigningSecrets = {
  /** The Developer ID Application leaf, PEM. */
  certPem: string;
  /** Every certificate between the leaf and an Apple root, PEM, in order. */
  chainPem: string;
  /** The leaf's private key as unencrypted PKCS#8, PEM. */
  keyPkcs8Pem: string;
};

/** RFC 5652: the content types, and the three signed attributes. */
const OID_DATA = '1.2.840.113549.1.7.1';
const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_CONTENT_TYPE = '1.2.840.113549.1.9.3';
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';

const HASH = 'SHA-256';
const KEY_ALGORITHM = 'RSASSA-PKCS1-v1_5';
/** `SignedAndUnsignedAttributes` tags signed attributes as `[0]`. */
const SIGNED_ATTRS = 0;

const PEM_BLOCK = /-----BEGIN [^-]+-----([\dA-Za-z+/=\s]+)-----END [^-]+-----/gu;
const WHITESPACE = /\s+/gu;

export class InvalidSigningSecretError extends Error {
  readonly secret: string;

  constructor(secret: string) {
    super(`Signing secret "${secret}" holds no PEM block`);
    this.name = 'InvalidSigningSecretError';
    this.secret = secret;
  }
}

let engineReady = false;

/**
 * pkijs reads its crypto off a global engine, and a Worker has no default one.
 * Set once per isolate, pointing at the runtime's own WebCrypto. Exported so a
 * test fixture can mint certificates through the same engine.
 */
export function ensurePkijsEngine(): void {
  if (engineReady) {
    return;
  }
  engineReady = true;
  // pkijs types its engine against a WebCrypto from before typed array buffers
  // split into shared and not, so the instance has to be told what it is.
  const engine = new CryptoEngine({ crypto: globalThis.crypto, name: 'cf' });
  setEngine('cf', engine as unknown as ICryptoEngine);
}

/** Every PEM block in one file, base64-decoded, in the order they appear. */
function derBlocks(pem: string): Array<Uint8Array<ArrayBuffer>> {
  return [...pem.matchAll(PEM_BLOCK)].map((match) =>
    Uint8Array.from(atob((match[1] ?? '').replaceAll(WHITESPACE, '')), (char) =>
      char.charCodeAt(0),
    ),
  );
}

/**
 * Wraps the profile XML in a CMS `SignedData` and returns it as DER: the
 * .mobileconfig iOS accepts as signed. The content is enveloped, not detached,
 * because that is the only form Apple's profile installer reads.
 */
export async function signProfile(
  xml: Uint8Array<ArrayBuffer>,
  secrets: SigningSecrets,
): Promise<Uint8Array<ArrayBuffer>> {
  ensurePkijsEngine();
  const leafDer = derBlocks(secrets.certPem)[0];
  if (leafDer === undefined) {
    throw new InvalidSigningSecretError('certPem');
  }
  const keyDer = derBlocks(secrets.keyPkcs8Pem)[0];
  if (keyDer === undefined) {
    throw new InvalidSigningSecretError('keyPkcs8Pem');
  }

  const leaf = Certificate.fromBER(leafDer);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyDer,
    { hash: HASH, name: KEY_ALGORITHM },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.digest(HASH, xml);

  const signed = new SignedData({
    // The intermediate rides along: a device holds the Apple roots, not the
    // authority in between, and cannot verify the leaf without it.
    certificates: [leaf, ...derBlocks(secrets.chainPem).map((der) => Certificate.fromBER(der))],
    encapContentInfo: new EncapsulatedContentInfo({
      eContent: new OctetString({ valueHex: xml }),
      eContentType: OID_DATA,
    }),
    signerInfos: [
      new SignerInfo({
        sid: new IssuerAndSerialNumber({
          issuer: leaf.issuer,
          serialNumber: leaf.serialNumber,
        }),
        signedAttrs: new SignedAndUnsignedAttributes({
          // A SET OF is DER-sorted, and these three OIDs differ in their last
          // byte alone, so OID order is byte order.
          attributes: [
            new Attribute({
              type: OID_CONTENT_TYPE,
              values: [new ObjectIdentifier({ value: OID_DATA })],
            }),
            new Attribute({
              type: OID_MESSAGE_DIGEST,
              values: [new OctetString({ valueHex: digest })],
            }),
            new Attribute({
              type: OID_SIGNING_TIME,
              values: [new UTCTime({ valueDate: new Date() })],
            }),
          ],
          type: SIGNED_ATTRS,
        }),
        // Version 1 is the issuer-and-serial-number form of `sid`.
        version: 1,
      }),
    ],
    version: 1,
  });
  // `sign` writes SHA-256 into both digest algorithm slots, then signs the
  // attributes rather than the content, which is what the message digest is for.
  await signed.sign(key, 0, HASH);

  const contentInfo = new ContentInfo({
    content: signed.toSchema(true),
    contentType: OID_SIGNED_DATA,
  });
  return new Uint8Array(contentInfo.toSchema().toBER(false));
}
