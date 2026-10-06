# ADR-0011: The Mac release keys are held in a GitHub environment

Date: 2026-10-05. Status: accepted.

## Why

- A Mac release was one script on the owner's Mac (`apps/mac/scripts/release.sh`), so no release could be made without that Mac.
- The owner wants a release to need a tag and one approval, from any device.

## Decision

- GitHub Actions runs the same script on a macOS runner (`.github/workflows/mac-release.yml`), started by a tag `mac-v<version>` or by hand on `main` as a dry run.
- The environment `mac-release` holds what the script needs: the Developer ID certificate with its private key, an App Store Connect API key for the notary service, the Sparkle EdDSA private key and the S3 key pair of an R2 API token for the one bucket. They are environment secrets, so no other workflow can read them.
- The bucket credential is the S3 key pair (Access Key ID and Secret Access Key) of an R2 Account API token with Object Read & Write on that one bucket. The script uploads with `curl --aws-sigv4` to the bucket's S3 endpoint. The token value is not used: `cf r2 objects` calls the Cloudflare REST API, which answers 403 to a token scoped to one bucket and takes only a token with R2 access to the whole account. The S3 endpoint accepts the scoped key pair and refuses every other bucket.
- The script still runs on the owner's Mac with its own keychain and files. The setup and the list of secrets are in `apps/mac/README.md`, "Release".

## The guards

- The environment has one required reviewer, the owner, and no bypass for administrators. Every run waits for the approval.
- The environment accepts the branch `main` and tags `mac-v*` only.
- A tag ruleset on `mac-v*` restricts creation, update and deletion, with the owner as the only bypass. It is needed because, for a tag, GitHub runs the workflow file of the tagged commit: without it a writer could tag a commit of their own whose workflow sends the secrets out.
- The reviewer confirms before approving that the run's commit is on `main` and is the bump commit. The run's name says whether it is a dry run or a real release.
- The workflow checks the tag name and that the commit is on `main`. This only stops an honest mistake, since the workflow file comes from the tagged commit.
- The tests run before any key is on the runner. The keys go into a keychain and files made for the run and are deleted in a last step that always runs.
- The job reads no cache. libimobiledevice and OpenSSL are built from source on every run, at commits written in `scripts/build-libimobiledevice.sh`. Sparkle is pinned to a commit, the actions to commit SHAs, dmgbuild by hashes and xcodegen by a sha256. The job installs no node package and no `cf`.
- A dry run is not handed the bucket's key pair.
- No agent creates a `mac-v*` tag or approves a `mac-release` deployment (`AGENTS.md`).

## Update 2026-10-06: the tag trigger is removed

- The owner wants no step by hand but the approval. A tag pushed by hand was a second step, and it was the weak one: for a tag, GitHub runs the workflow file of the tagged commit, so the whole design rested on a tag ruleset.
- A release is now asked for by a push to `main` that raises `CURRENT_PROJECT_VERSION` in `apps/mac/project.yml` above the published build. The job `detect` decides that with no secret and no environment, so a change to `project.yml` with no newer build asks for no approval.
- The approval of the environment `mac-release` is the gate. The reviewer confirms the version and the build in the run's summary, and that the commit is the bump on `main`.
- The environment accepts the branch `main` only. The tag pattern `mac-v*` is removed from it, so no run on a tag can reach the secrets.
- `main` has a ruleset: a pull request is required, no force push, no deletion, the owner as the only bypass. It now does the work the tag ruleset did, because the workflow file that runs is the one on `main`.
- The workflow writes the tag `mac-v<version>` after a release, as a record, with the built-in token. A tag pushed with that token starts no workflow. The tag ruleset keeps update and deletion restricted and no longer restricts creation: the GitHub Actions app cannot be put on the bypass list of a ruleset here, and a bypass would also let it move and delete tags. A tag made by someone else ships nothing.
- The workflow has no `pull_request` trigger and must never get one.
- No agent approves a `mac-release` deployment or makes a `mac-v*` tag by hand. An agent merges a Mac version bump only when the owner asked for that release (`AGENTS.md`).
- This replaces, above: "started by a tag" in the decision, and the guards about the tag pattern of the environment, the tag ruleset, the check of the tag name and the agents' rule. In "The risk that remains", read "bypass the ruleset on `main`" for "change the tag ruleset".

## The risk that remains

- The Sparkle key and the bucket's key pair together can ship an update to every installed copy of the app. With the Developer ID certificate that update also passes Gatekeeper.
- Whoever can approve a run, change the environment or change the tag ruleset can ship. That is the owner's GitHub account, so that account is now as valuable as the keys. It needs a hardware key or passkey as its second factor.
- An approved run executes code we do not write: the runner image, Homebrew's autotools, the pinned actions and the pinned sources. A fault in one of them at the pinned version reaches the keys.
- GitHub itself holds the secrets.

## If a key leaks

- Developer ID certificate: revoke it at developer.apple.com, Certificates, IDs & Profiles. Make a new one in Xcode, export it and replace the two `.p12` secrets. Ask Apple before revoking when a release is in use, because a revoked certificate can stop copies signed with it from opening.
- App Store Connect API key: revoke it in App Store Connect, Users and Access, Integrations. Make a new key and replace the three notary secrets.
- Bucket key pair: delete its token in the Cloudflare dashboard, R2, API tokens. That ends the key pair at once. Make a new Account API token with Object Read & Write on the same bucket and replace `MAC_R2_S3_ACCESS_KEY_ID` and `MAC_R2_S3_SECRET_ACCESS_KEY`. Then check `mac/appcast.xml` and `mac/latest.json` in the bucket against the last release.
- Sparkle key: it cannot be revoked, because its public half (`SUPublicEDKey`) is inside every installed copy. Alone it ships nothing: an update also has to be served from `attentionawareness.com/mac/`, so first make sure the bucket's key pair is safe. Then make a new pair with Sparkle's `generate_keys`, put the new public key in `project.yml` and ship one release signed with the old key and the Developer ID. Copies that take that release trust the new key from then on. Copies that never take it keep trusting the old one.
