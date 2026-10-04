# ADR-0008: The Mac app is open source under AGPL-3.0

Date: 2026-10-04. Status: accepted. Amends ADR-0002.

## Why

- The fast supervision method (`apps/mac/Sources/Seed/`) holds material adapted from [Nugget](https://github.com/leminlimez/Nugget), which is under the GNU Affero General Public License, version 3. A program that holds AGPL code must be given out under the AGPL, so the app cannot be MIT.
- The owner does not want someone to take the app, change it and sell it as a closed product.

## Decision

- The Mac app moves from its private repo into this repo as `apps/mac`, as one import with no earlier history.
- `apps/mac` is under AGPL-3.0-only (`apps/mac/LICENSE`), Copyright (C) 2026 Mert Duzgun. Everything else in the repo stays MIT (`LICENSE`).
- `apps/mac/THIRD_PARTY_NOTICES.md` names Nugget and TrollRestore, what was taken and in which files. The license texts are in `apps/mac/Resources/Licenses/` and inside the app bundle.
- The app links to this repo from its About window and its Help menu, so every person who has the app can get the source.
- `apps/mac` is not a pnpm workspace package. Turbo, oxlint, oxfmt and lefthook leave it alone, and CI does not build it.

## What the AGPL does and does not do

- It does not forbid selling. Anyone may sell copies of the app, changed or not.
- Anyone who gives out the app, changed or not, must give the source of that version under the same license. Anyone who changes it and lets people use it over a network must offer those people the source of the changed version.
- So a closed resale is not allowed, and an open one is.

## Consequences

- The AGPL parts and the MIT parts must stay apart. Code from `apps/mac` does not go into `apps/web`, `apps/extension` or `packages/*`. Code can go the other way.
- The app links the libimobiledevice libraries (LGPL-2.1-or-later), OpenSSL (Apache-2.0) and Sparkle (MIT). All of them can be used with AGPL-3.0. No bundled component is GPL-2.0-only.
- A Mac build in CI is a follow-up. It needs a macOS arm64 runner, xcodegen, the `Vendor/` libraries (built by `scripts/build-libimobiledevice.sh` or cached) and a path filter on `apps/mac/**`.
