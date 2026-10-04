# ADR-0002: Mac app files from R2

Date: 2026-10-01. Status: accepted. Amended by ADR-0008 on 2026-10-04: the Mac app is now open source in this repo, in `apps/mac`, under AGPL-3.0. The files still come from R2.

## Why

When this was decided the Mac app was closed source and lived in a private repo, so its GitHub release URLs did not serve the public. The dmg, the Sparkle feed and `latest.json` need a public home, and the feed URL is baked into every shipped copy of the app, so that home can never move.

## Decision

- The files live in the private R2 bucket bound to the web Worker as `MAC_FILES`, under the same path as their URL: `/mac/appcast.xml` is the key `mac/appcast.xml`.
- The Worker serves them at fixed URLs: `/mac/appcast.xml` (the Sparkle feed in the shipped app), `/mac/latest.json` (read by the download button) and `/mac/attention-awareness-<version>.dmg`. `src/lib/mac-files.ts` answers GET and HEAD with single byte ranges and conditional requests; any other path under `/mac/` is a 404 before R2 is asked.
- `/mac/*` is in `assets.run_worker_first`, so a file under `public/mac/` can never shadow the bucket.
- The app's release script (`apps/mac/scripts/release.sh`) uploads the files; the Worker only serves them.

## Cache policy

| File                         | `cache-control`                       | Why                                                                     |
| ---------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `appcast.xml`, `latest.json` | `public, max-age=300`                 | They change with every release; a new version shows within five minutes |
| Versioned dmg                | `public, max-age=31536000, immutable` | A published dmg name never gets new bytes                               |

The dmg policy relies on the release script never reusing a dmg name (see `apps/mac/scripts/release.sh`). A rebuilt dmg uploaded under an old name would stay cached for a year.

## Consequences

- Shipped apps keep updating: the feed URL is the same one they already have.
- Every download is a Worker request; R2 has no egress fees.
- The bucket stays private: the Worker is the only way in, and it reads nothing outside the served file shape.
- Local dev reads a simulated bucket under `apps/web/.cloudflare/state`, seeded by hand (see AGENTS.md).
