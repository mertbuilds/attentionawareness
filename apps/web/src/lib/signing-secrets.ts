import type { SigningSecrets } from './sign.ts';

/** The Worker bindings the signer reads. All three, or signing stays off. */
export type SigningEnv = {
  SIGNING_CERT_PEM?: string | undefined;
  SIGNING_CHAIN_PEM?: string | undefined;
  SIGNING_KEY_PKCS8_PEM?: string | undefined;
};

/**
 * A route handler never sees the Worker `env`, so `server.ts` hands the
 * bindings over on the way in, the same way it initialises the logger. Module
 * state, so it lives exactly as long as the isolate does.
 */
let secrets: SigningSecrets | null = null;

export function setSigningSecrets(env: SigningEnv): void {
  secrets =
    env.SIGNING_CERT_PEM === undefined ||
    env.SIGNING_CHAIN_PEM === undefined ||
    env.SIGNING_KEY_PKCS8_PEM === undefined
      ? null
      : {
          certPem: env.SIGNING_CERT_PEM,
          chainPem: env.SIGNING_CHAIN_PEM,
          keyPkcs8Pem: env.SIGNING_KEY_PKCS8_PEM,
        };
}

/** `null` when the secrets are missing, which is local dev without `.dev.vars`. */
export function signingSecrets(): SigningSecrets | null {
  return secrets;
}
