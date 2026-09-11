# Profile signing

Every profile the site hands out is signed on the server with the founder's
Apple **Developer ID Application** certificate. The private key lives in Worker
secrets. It never reaches the browser, a build artifact, or git.

## Why it is signed

A `.mobileconfig` is a plist. Signing wraps that plist in a CMS `SignedData`
structure (PKCS#7, DER) and gives iOS three things:

- **A name on the install sheet.** An unsigned profile installs as
  "Unsigned"; a signed one shows "Verified" and the certificate's common name.
- **The same-signer rule.** iOS lets a profile be replaced in place only by a
  profile with the same `PayloadIdentifier` **and** the same signer. An
  unsigned profile can never replace a signed one. So nobody can hand the phone
  a looser copy of an installed profile, not even a copy built from the XML on
  this site.
- **A unique identifier per download.** `POST /api/sign` mints
  `com.keepyourattention.<uuid>` for every single download and ignores whatever
  the browser sent. Two downloads are two different profiles: the second one
  stacks on the first instead of replacing it. Together with
  `PayloadRemovalDisallowed`, an installed profile comes off an erased phone
  and no other way. A trial profile is the one exception: the reader asks for
  it, `PayloadRemovalDisallowed` is `false`, and Settings takes it off.

The content is **enveloping**, not detached: the profile XML travels inside the
signature. That is the only form Apple's profile installer reads.

The signature carries the leaf certificate **and** the Apple intermediate that
issued it ("Developer ID Certification Authority"). A device ships with the
Apple roots but not with that intermediate, so a signature without the chain
verifies on a Mac with the full keychain and fails on a phone. Always include
it.

`src/lib/sign.ts` builds the `SignedData` with `pkijs` on the Worker's own
WebCrypto: SHA-256 digests, one `SignerInfo` (issuer and serial number, with
`contentType`, `messageDigest` and `signingTime` as signed attributes), and
RSA PKCS#1 v1.5 over those attributes.

## Exporting the certificate

You need a **Developer ID Application** certificate in your login keychain,
with its private key. Confirm it is there:

```sh
security find-identity -v -p codesigning
```

Export the identity as a `.p12`. In Keychain Access: **My Certificates**, right
click the "Developer ID Application: NAME (TEAMID)" row, **Export**, pick
Personal Information Exchange (.p12), set a passphrase. From the CLI the same
thing is:

```sh
security export -k ~/Library/Keychains/login.keychain-db \
  -t identities -f pkcs12 -o developer-id.p12
```

Split the `.p12` into the two PEM files the Worker wants:

```sh
# the leaf certificate -> SIGNING_CERT_PEM
openssl pkcs12 -in developer-id.p12 -clcerts -nokeys -out cert.pem

# the private key, then PKCS#8 unencrypted -> SIGNING_KEY_PKCS8_PEM
openssl pkcs12 -in developer-id.p12 -nocerts -nodes -out key.pem
openssl pkcs8 -topk8 -nocrypt -in key.pem -out key.pkcs8.pem
```

`crypto.subtle.importKey('pkcs8', ...)` reads only unencrypted PKCS#8, which is
what `openssl pkcs8 -topk8 -nocrypt` writes: the header must say
`-----BEGIN PRIVATE KEY-----`, not `RSA PRIVATE KEY` and not `ENCRYPTED`.

Now the intermediate. Check which one issued your leaf:

```sh
openssl x509 -in cert.pem -noout -issuer
```

Download the matching file from <https://www.apple.com/certificateauthority/>
("Developer ID Certification Authority", `DeveloperIDCA.cer`, or the G2 one,
`DeveloperIDG2CA.cer`) and convert it to PEM:

```sh
curl -O https://www.apple.com/certificateauthority/DeveloperIDCA.cer
openssl x509 -inform der -in DeveloperIDCA.cer -out chain.pem
```

`chain.pem` may hold more than one certificate; every block in it is included
in the signature, in order. Delete `developer-id.p12` and `key.pem` when you
are done.

## Production

Three Worker secrets, set from `apps/web` so wrangler finds the config:

```sh
wrangler secret put SIGNING_CERT_PEM      < cert.pem
wrangler secret put SIGNING_CHAIN_PEM     < chain.pem
wrangler secret put SIGNING_KEY_PKCS8_PEM < key.pkcs8.pem
```

Multi-line PEM is fine; pass the file on stdin as above rather than pasting.
Rotating a certificate is the same three commands with new files. A profile
signed by the old certificate stays installed and stays valid: the same-signer
rule only decides what may replace it.

## Local

Signing is off until the secrets exist. Without them `/api/sign` answers `503`
and the page shows "Signing is not available right now", so the generator, the
XML view and every test keep working on a bare checkout.

To sign locally, copy `apps/web/.dev.vars.example` to `apps/web/.dev.vars` and
fill in the three values. `.dev.vars` is gitignored, and `wrangler` loads it for
`vite dev` through the Cloudflare plugin. PEM newlines survive if you quote the
value and write `\n` escapes:

```sh
SIGNING_CERT_PEM="-----BEGIN CERTIFICATE-----\nMIIF...\n-----END CERTIFICATE-----\n"
```

## Checking a signed profile

```sh
# what the server produced, verified against the system roots
security cms -D -i keepyourattention.mobileconfig | head

# the certificates that rode along
openssl pkcs7 -inform der -in keepyourattention.mobileconfig -print_certs -noout
```

The second command must list the leaf **and** the Apple intermediate. If it
lists only the leaf, `SIGNING_CHAIN_PEM` is empty or wrong, and the profile
will not verify on a phone.
