# attention awareness for Mac

Native macOS app (SwiftUI, macOS 14+) that supervises a connected iPhone and
installs restrictions over USB. There are two methods:

| iOS on the iPhone | Full copy (default) | Fast (experimental) |
| --- | --- | --- |
| 26 and earlier | yes | yes, picked by hand |
| 27 and later | yes | no |
| missing or unreadable version | yes | no |

The full copy backs up the iPhone, patches the copy and restores it. It is the
default on every iOS version and is not held to a version. The fast method
restores a small configuration backup and restarts the iPhone. It is
experimental, it is never picked by default, and the Ready screen only offers
it on iOS 26 and earlier, with no lower limit in the code.

Back up the iPhone first, with Finder or iCloud. The app does not erase the
iPhone, but things can go wrong, and that backup is the way back. We are not
responsible for lost data. The Ready screen says so, and Supervise stays off
for both methods until the person ticks "I backed up my iPhone".

The fast method uses an isolated temporary seed folder, never the full-copy
backup folder, and it makes no backup of its own. The first test on an iPhone
SE running iOS 26.6.2 applied supervision but reopened Setup Assistant and
redownloaded photos from iCloud. The seed now includes Nugget's setup-screen
skip list and managed setup-completion preferences. The hardware retest of
this correction, on the owner's iPhone on 2026-10-04 with app version 0.4.2,
went through: the iPhone came back supervised with its data kept. One fault
showed, in the app and not in the method: the wait after the restart did not
find the iPhone again until the cable was pulled and put back. The restore
resets the iPhone's pairing records, so after the restart it refuses this
Mac's pair record (InvalidHostID). macOS pairs again only when the iPhone is
plugged in, and right after the restart that is while it is still locked, so
nothing paired again until the cable was pulled. 0.4.3 pairs again itself
(see the wait below). One iPhone is one test, so the method stays
experimental, and unit tests do not establish that local data survives a
restore.

After the restart, for both methods, the job reads the iPhone every two
seconds on its own and waits on no connect or disconnect, because a restarted
iPhone is back on the cable before it answers. It only counts a read made
after one that missed the iPhone, so the answer from before the restart ends
nothing. While it waits it says what is missing: "Unlock iPhone." for an
iPhone that is locked, "Tap Trust on iPhone." for one that asks for trust.
Every lockdown session that meets InvalidHostID sends Pair once (`Pairing` in
`Sources/Device/Pairing.swift`): a locked iPhone answers that it needs its
passcode, an unlocked one shows Trust, and once Trust is tapped the next Pair
saves a new record through usbmuxd and the read goes on. Pair is sent at
most every 2 seconds to a locked iPhone and every 5 seconds while Trust is on
screen (`PairThrottle`); the handshake runs on every read, so a record saved
by anything on this Mac is picked up at once. A Pair the iPhone accepted whose
record is still refused is a failure ("couldn't keep the pairing"), not a wait
for Trust. Outside the job and Ready, the wizard reads the cable every 2.5
seconds while an iPhone on it is locked, waits for Trust or could not be read,
because an unlock sends no event, and reads nothing while every iPhone is
paired.
After 5 minutes for the fast method and 15 for the full copy the screen
becomes "iPhone Didn't Reconnect" with Check Again, and the reading goes on
underneath. Check Again reads the iPhone and nothing else: it sends no
configuration and restarts nothing.

The device layer writes every read's outcome to the Mac's log under the
subsystem `com.attentionawareness.mac`, category `device`: pairing states,
lockdown error codes, and the restart wait's steps, never a udid or a device
name. To read a run back:
`/usr/bin/log show --last 30m --info --predicate 'subsystem == "com.attentionawareness.mac"'`.

The full copy's patch logic was ported from a Python tool that did the same
thing by hand; that tool is retired and is not in this repo.

The app is free. There is no license key, no price and no account. People who
want to can support the work on a pay-what-you-want page, and the last screen
of a run that went through says so once, with a Support This Project button
and a Share button. The Help menu has Support This Project as well. The app
never asks again.

The app is open source under the GNU Affero General Public License, version 3
(`AGPL-3.0-only`): see [License](#license) at the end of this file and
[LICENSE](LICENSE). What the app takes or bundles from others, and under which
licenses, is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The window is the wizard: Connect, Ready, Supervising, Restrictions, Done, one
screen at a time. Both methods run on the Supervising screen; full-copy also
copies and patches there.

Unplugging the iPhone a run is about takes the window back to Connect from
any step, and unplugging any other iPhone changes nothing. A copy in progress
is cancelled the way Cancel cancels it, and the window goes back once the
helper has stopped. The one stretch left out is the restore: it reboots the
iPhone, so the phone leaving the cable is part of the job, which waits for it
to come back, and a restore that stopped part way keeps its screen, its copy
and its Try Again, because a new run would clear that copy first. Once the
restore is through, unplugging goes back to Connect again, so Check on iPhone
and the Restrictions guide both ask to keep iPhone connected. The last screen
stays up while it names a backup folder that would not go, because it is the
one place that folder is named.

## What the app sends

When a supervision finishes, the app sends one anonymous count, so the owner
can see that supervisions finish. It is sent when the person presses It's
Supervised at the end of the job, once for each run. Nothing is sent at
launch, on a failure or on a cancel, and nothing is sent again later.

The request is a `POST` to `https://e.attentionawareness.com/i/v0/e/`, the
site's own proxy in front of its PostHog project, with this body:

```json
{
  "api_key": "phc_DfvN33UTDFBHJfUfC46o4aKL33aGLR7qEmEJYfWjh9gi",
  "event": "supervision_finished",
  "distinct_id": "<a new random UUID for every event>",
  "properties": {
    "app_version": "0.4.0",
    "method": "full_copy",
    "ios_major": 26,
    "macos_major": 15,
    "$process_person_profile": false,
    "$geoip_disable": true
  }
}
```

- `method` is `full_copy` or `fast`. `ios_major` is the first number of the
  iOS version, and it is left out when the iPhone gave no version.
- `distinct_id` is made new for each event and is not stored, so two counts
  cannot be tied to each other or to a person. `api_key` is the public key
  the website ships to every browser.
- Nothing names the iPhone, the Mac or the person, and nothing about the
  blocked apps and sites is sent, not even how many.
- The request carries the IP address of the Mac, as every request does, and
  the proxy and PostHog see it in transit. `$process_person_profile: false`
  means PostHog makes no person profile. `$geoip_disable: true` means no place
  is worked out from the address: no country, no city, no coordinates.
  Whether PostHog stores the address with the event is a setting of the
  PostHog project ("IP data capture"), not something the app controls. It is
  set to discard, so the count holds no address.
- The request has three headers of its own: `Content-Type: application/json`,
  `User-Agent: attentionawareness-mac/0.4.0` (the app version, in place of the
  one macOS would write, which names the Darwin build) and
  `Accept-Language: en` (in place of the languages this Mac is set to).
- The request has a timeout of 5 seconds and is never sent again. A failure is
  silent and changes nothing in the app.
- A debug build sends nothing, so `--demo`, `--ui-smoke` and the tests send
  nothing. There is no switch to turn the count off in a Release build.

The Ready screen and the About window say it in these words: "When a
supervision finishes, the app sends one anonymous count. It holds the app
version, the method, and the first number of the iOS version and of the macOS
version. Nothing that names you or your iPhone." The code is `Sources/Event/`,
and the reasons are in
`docs/adr/0009-mac-app-one-anonymous-event.md` at the root of the repo.

## Build

Apple Silicon only, macOS 14 and up. The vendored C libraries are built arm64
with a deployment target of 14.0, and the app carries no Intel slice.

You need:

- Xcode, with its command line tools.
- [Homebrew](https://brew.sh). `scripts/build-libimobiledevice.sh` installs
  the autotools it needs through it.
- xcodegen: `brew install xcodegen`.
- For a release only, dmgbuild: `pip3 install --user dmgbuild`.

Every command in this file runs from `apps/mac`. The scripts find that folder
from their own place, so they also run from anywhere else.

```sh
cd apps/mac
bash scripts/build-libimobiledevice.sh
bash scripts/vendor.sh
xcodegen generate
xcodebuild -scheme AttentionAwareness -configuration Debug build
xcodebuild test -scheme AttentionAwareness -destination 'platform=macOS,arch=arm64'
```

Run `scripts/vendor.sh` before `xcodegen generate`. It fills `Vendor/`, and
without it xcodegen stops with "missing source directory" for
`Vendor/bin/idevicebackup2`.

A Debug build signs ad hoc (`CODE_SIGN_IDENTITY: '-'` in `project.yml`), so it
needs no Developer ID and no Apple account. Only a release needs the Developer
ID.

The app lands at `build/Build/Products/Debug/attention awareness.app` when you
pass `-derivedDataPath build`, otherwise in the usual DerivedData directory. A
quick check without opening a window:

```sh
"build/Build/Products/Debug/attention awareness.app/Contents/MacOS/attention awareness" --devices
```

It prints the number of connected iPhones and exits. `--probe` goes further and
prints everything `Sources/Device/` reads from each connected iPhone as JSON,
which is how the device layer is checked without the window. `--backup <udid>
<root>` and `--restore <udid> <root>` run the backup engine from a terminal.

`--restore` and `--seed` change the connected iPhone the way the window does,
and they do not ask first. Back up the iPhone with Finder or iCloud before you
use one. That backup is the way back, and we are not responsible for lost
data. `--backup` only copies the iPhone. `--patch` changes a backup folder on
this Mac and reaches no iPhone; it keeps an untouched copy and prints where.

`--seed <udid>` runs the fast method without a window. It reads the current
cloud configuration and preserves its other policy keys, checks the live iOS
version before restoring, writes the cloud configuration and managed
`mobile/com.apple.purplebuddy.plist` setup-completion preferences in its own
temporary root, then runs the bundled
helper with `restore --system --no-reboot --skip-apps`. Only a successful restore
is followed by a diagnostics-relay restart. Ctrl+C asks the helper to stop and
waits for it before removing the temporary seed. If configuration was restored
but restart fails, restart iPhone before repeating a restore. This flag changes
the connected phone; the corrected two-payload seed still needs a hardware retest.

The fast method's iOS 27 refusal follows [Apple's managed-device restore documentation](https://support.apple.com/guide/deployment/restore-managed-apple-devices-depd44f04xc4/1/web/1.0)
and [Nugget's iOS 27 data-loss warning](https://github.com/leminlimez/Nugget#readme).
There is no version override for the fast method. The full copy has no version
check: it runs on iOS 27 and later as it did before the fast method existed.

`--patch <backup folder>` loads a backup folder, plans the change, applies it
and checks it, printing the flag before and after and the folder the untouched
copy went to, which is how the patch layer is checked against a real backup
without the wizard. `BACKUP_PASSWORD` carries the password of an encrypted backup. Nothing
is sent to an iPhone.

`--ui-smoke` builds every step of the wizard offscreen and prints the size each
one asks for, so the window can be checked on a Mac whose display is asleep. Add
a folder, `--ui-smoke /tmp/shots`, and it writes a picture of each step there as
well. Add `--appearance light` or `--appearance dark` to draw them that way,
whatever this Mac is set to. It also unplugs the iPhone from each step past Connect and exits non-zero
when one of them lands on a step other than the one it should.

`--demo` opens the real window on a wizard that reaches no iPhone, no disk and
no site, with a bar under it for driving the states by hand. Every view is the
one that ships; only the other end of it changes. A transfer runs in about
twenty five seconds and reads like the hour it stands for: the bar climbs, the
estimate says how much longer, and the elapsed time counts the minutes a real
cable would have taken. The demo bar jumps to any step and sets what the wizard
finds when it looks: how many iPhones are on the cable, Find My on or off,
backups encrypted or not, a phone that is already supervised, a profile already
installed, what this Mac already holds, how the reader's own backups read in
iCloud and in Finder, Full Disk Access granted, refused, or still refused after
a trip to System Settings, and whether the next transfer or install succeeds,
fails or is cancelled. Setting the iPhones to None at any step unplugs the one
the run is about, and going from Two to One unplugs the other one.

Nothing real is in reach of it. The demo is built on a watcher that reads no
bus, an engine that refuses to start the helper and a backups list that reads
and deletes nothing, and every method that would patch a backup, ask the site
for a signature or send anything to a phone is replaced by one that waits a
moment and says what the bar asked for. It writes nothing anywhere, and it is
the one hidden flag that opens a window. The one thing outside the window it
can still reach is System Settings, when the Full Disk Access button on the
Ready screen is pressed, which is left alone so that button can be read the way it
works. It writes nothing either. Its Reopen button does not quit the demo: it
stands for the launch that follows instead.

The demo is a debug build alone. `Sources/Demo/` is wrapped in `#if DEBUG`,
along with the flag that builds it, the window it opens and the Demo menu, so a
Release build carries none of it.

`--sign-profile <file>` asks the site to sign the profile the Restrictions
screen installs and writes it, so the signing side can be checked without an iPhone.
It prints the size and whether the bytes are the DER of a signed CMS message.
`AA_SITE_URL` points it at a dev server, and that variable is also the only
thing that makes the app trust a certificate the system does not know, for that
one host:

```sh
AA_SITE_URL=https://aa.localhost \
  "build/Build/Products/Debug/attention awareness.app/Contents/MacOS/attention awareness" \
  --sign-profile /tmp/aa.mobileconfig
```

## Layout

- `project.yml` is the source of truth. `AttentionAwareness.xcodeproj` is
  generated by [xcodegen](https://github.com/yonaskolb/XcodeGen) and gitignored,
  so never edit project settings in Xcode: edit `project.yml` and regenerate.
- `Sources/` holds the Swift code, `Info.plist`, the entitlements (empty dict,
  no sandbox: the app needs usbmuxd and unsandboxed file access) and the icon.
  `AppIcon.icns` is drawn by `scripts/render-app-icon.ts` from the brand mark's
  outlines in `packages/ui/src/brand.ts`, on Apple's macOS icon grid;
  `scripts/app-icon.svg` is the drawing. Run
  `node apps/mac/scripts/render-app-icon.ts` from the repo root after a change
  and commit both.
- `Sources/UI/` is the window: `WizardStep` is the step order and nothing else,
  which is why the tests can run it; `BackupSafetyNet` works out whether the
  reader already has a backup of their own, from what the iPhone says about its
  iCloud backups and from Finder's own folder on this Mac, where the backups
  the reader archived count as well, and is values for the same reason; `WizardModel` holds one run of the wizard and owns the
  device watcher, the backup engine and the list of backups on this Mac; the
  rest is one file per screen, plus `DevicePicker` for choosing between
  connected iPhones. Errors from
  the three layers are shown in the step that caused them, never in a modal
  alert.
- Finder's backup folder is the one thing in the app that wants Full Disk
  Access, and the backup this app makes needs none of it: that one goes under
  Application Support, which macOS does not protect. macOS also offers no way
  for an app to ask for the permission, so while the folder is refused and no
  recent iCloud backup covers the reader, the Ready screen's backup row asks
  for Full Disk Access in words, with a button that opens the list in System
  Settings. The app looks again the moment it is back in front. When the
  folder is still refused after that trip, the row asks for a reopen instead,
  because macOS can wait for an app to open again before the switch counts,
  and its Reopen button quits the app and opens it again, with Open System
  Settings beside it for a switch that is not on yet. A refusal costs the run
  nothing: the iCloud answer is there either way and every button works the
  same.
- `Sources/Demo/` is the `--demo` flag and nothing else, and every file of it
  is behind `#if DEBUG`: `DemoScript` is the timeline a demo transfer runs to
  and `DemoConditions` the switches the bar writes, both plain values the tests
  run; `DemoWorld` makes the iPhones and backups out of those switches;
  `DemoModel` is the wizard with every method that reaches the world replaced;
  `DemoBar` is the bar itself.
- `Sources/Event/` is the one anonymous count: `SupervisionFinishedEvent` is
  what is in it, as values the tests read key by key, and
  `SupervisionEventSender` is the request that carries it. Only the window's
  own model is handed the sender; the demo, the smoke and the tests get none.
- `Sources/Device/` is the device layer: `DeviceWatcher` publishes the iPhones on
  the cable and re-reads them on every connect and disconnect, along with every
  udid usbmuxd lists, read or not, which is what says a phone was unplugged
  rather than slow to answer. One read is out at a time; when it is still out
  after 20 seconds the next starts beside it, at most four together, and the
  slow one still lands unless a newer one landed first. `Lockdown` reads
  the values the wizard checks, `MCInstall` reads supervision and installs a
  profile over USB.
- `Sources/Profile/` is the profile the Restrictions screen installs: `ProfileConfig`
  mirrors the type of the same name in `apps/web/src/lib/profile/types.ts`
  of this repo, field for field, because
  it is encoded straight into the body `POST /api/sign` validates, and
  `ProfileConfig.default` is a copy of the `mert` preset in
  `apps/web/src/lib/profile/presets.ts`. `ProfileSigner` posts it and hands back the signed
  `.mobileconfig` bytes; the signing certificate stays on the site and never
  comes near the app.
- `Resources/Images/` holds the screenshots the "i" popovers show. The folder
  is a folder reference in `project.yml`, so it is copied into the app whole
  and a new screenshot is a file drop and a rebuild, with no project or code
  change. One name is looked for: `check-supervised.png`, the top of the iPhone
  Settings app with the "This iPhone is supervised" line under the name, shown
  on the last screen and on the "Check on iPhone" end of the job. It is only
  for a run that supervises, because undoing supervision takes that line away
  again. `.jpg` works as well, and where no file of that name is there the
  popover is its words alone.
- `Resources/Licenses/` holds the license texts of what the app bundles or
  takes code from, with the app's own license among them as `AGPL-3.0.txt`,
  and `THIRD_PARTY_NOTICES.md` names each component, its version and where
  its source is. Both are copied into `Contents/Resources`, so every copy of the
  app carries them. A new or bumped component is a change to both.
- `Vendor/` is filled by the two scripts below and gitignored except for
  `Vendor/include/module.modulemap`. The ignore rules for the app are in the
  `.gitignore` at the root of the repo.
- `scripts/build-libimobiledevice.sh` clones libplist, libimobiledevice-glue,
  libusbmuxd, libtatsu, libimobiledevice and OpenSSL at the release tags
  Homebrew ships, builds each one with `-arch arm64` and
  `MACOSX_DEPLOYMENT_TARGET=14.0`, and installs them into `Vendor/prefix`.
  Sources land in `Vendor/src`. Autotools come from Homebrew and are installed
  if missing. A component already in the prefix is skipped; `--force` rebuilds
  everything. The Homebrew bottles cannot be used as they are: they are built
  for the newest macOS, so linking them makes ld warn and the app would not
  run on 14. OpenSSL is built from source too, for the same reason, which
  keeps libimobiledevice on the pairing SSL path it is tested with.
- `scripts/vendor.sh` copies the dylibs, the `idevicebackup2` helper and the
  headers out of `Vendor/prefix`, rewrites every install name to `@rpath/`,
  and fails if a path outside the OS survives or if anything reports a minimum
  OS version above 14.0. Without `Vendor/prefix` it falls back to Homebrew with
  a warning, and then only the minimum-version check is downgraded to a warning
  as well, so a dev build still runs on the machine that built it. Run it again
  after rebuilding `Vendor/prefix`.
- The dylibs are embedded in `Contents/Frameworks`, the helper in
  `Contents/Helpers`, both signed on copy.

## Release

```sh
bash scripts/bump.sh 0.4.1        # the next marketing version, and one on the build number
bash scripts/release.sh
```

`scripts/bump.sh` is the only place the two version numbers are edited: it sets
`MARKETING_VERSION` in `project.yml` and adds one to `CURRENT_PROJECT_VERSION`.
Sparkle compares the build number (`CFBundleVersion`), so it has to go up on
every release even when the marketing version stays the same. `release.sh`
holds it to that: it reads the highest `<sparkle:version>` in the published
appcast and stops when the build number is not above it, once from
`project.yml` before it builds anything and once from the built app's
`Info.plist`.

`scripts/release.sh` builds Release, signs with the Developer ID, notarizes,
staples, writes a dmg, signs the dmg for Sparkle and uploads three files to the
private R2 bucket with `cf r2 objects put`, from Cloudflare's `cf` cli. The
script does not carry the bucket name: put it in
`~/.config/attentionawareness/release.env` (mode 600) as `R2_BUCKET=<bucket>`,
the bucket bound as `MAC_FILES` in `apps/web/cloudflare.config.ts` of this
repo, and the script stops before it builds when it is not set. The site serves each
file at `https://attentionawareness.com/mac/<file>`:

- `mac/attention-awareness-<version>-<build>.dmg`, the download. The site
  serves a dmg as immutable for a year, so a name is never used twice: the
  build number is in it, and the script stops when the site already serves
  that name.
- `mac/latest.json`, `{ version, build, url, filename, size, sha256, date }`
  for the download page, where `url` is the dmg on the site and `filename` is
  the name a person should get on disk, `attention-awareness-<version>.dmg`,
  with no build number. The download link sets it as its `download` attribute;
  `cf r2 objects put` cannot store a Content-Disposition, so the bucket cannot
  say it.
- `mac/appcast.xml`, the feed Sparkle reads (`SUFeedURL`), written by
  `generate_appcast` with `https://attentionawareness.com/mac/` as
  `--download-url-prefix`. The feed already published is the input, read from
  the bucket or else from the site, so older versions keep their entry.

The dmg goes up first and the feed last, so neither small file ever points at a
download that is not there. Each upload is live at once, with no site deploy in
between. Everything is also left in `build/release/site/`, and the script prints
every path it wrote. Uploading needs `cf auth login` with the Cloudflare account
that holds the bucket, and a release without `--dry-run` checks that with
`cf auth whoami` before it builds anything.

Release notes come from `release-notes/<version>.md` when that file is there,
and from a two-line default when it is not. `generate_appcast` embeds the file
in the feed, so it is the text Sparkle shows in its update window.

The script needs the notary keychain profile `attentionawareness-notary`.
Create it once with:

```sh
xcrun notarytool store-credentials attentionawareness-notary \
  --apple-id "<your-apple-id-email>" \
  --team-id "3HGP3W3TLD" \
  --password "<app-specific-password>"
```

The app-specific password comes from appleid.apple.com → Sign-in & Security →
App-Specific Passwords. Without the profile the script stops before it builds
anything and prints that command. Two flags are there for checking the pipeline
without shipping anything: `--dry-run` does everything but the uploads and
prints each upload command instead, and `--no-notarize` skips the notary
service and stapling. `--no-notarize` is refused without `--dry-run`, because
Gatekeeper stops a dmg that is not notarized on every Mac but this one.

The picture behind the dmg window is `scripts/dmg-background.png` and its
`@2x` twin, both tracked, and dmgbuild joins them into one retina picture. They
are drawn by `scripts/dmg-background.html`: black, like the site in its dark
theme. The icon labels are Finder's: it draws them black in light appearance,
so there they do not show on the black ground, and the picture names both icons
in its own text. After a change to the html, run
`bash scripts/render-dmg-background.sh` and commit the two pictures. The icon
positions live in `scripts/dmg-settings.py`, and the height of the row again
at the top of the html.

## Auto-update

[Sparkle 2](https://sparkle-project.org) comes in as a Swift package, declared in
`project.yml` under `packages:`. Xcode embeds `Sparkle.framework` in
`Contents/Frameworks` and signs it with the app's identity, and the same package
brings down `sign_update` and `generate_appcast`, so the tools always match the
framework inside the app.

The package ships the framework ad-hoc signed, and Xcode's embed step re-signs
only the outer bundle, which would leave `Updater.app`, the two XPC services and
`Autoupdate` ad-hoc and the notary service would refuse the app. The
"Sign Sparkle's nested helpers" build phase in `project.yml` signs those four
inside out, right before Xcode seals the app.

`App.swift` holds one `SPUStandardUpdaterController`, built last in `init()` so
that every hidden flag still exits without asking the site for anything.
"Check for Updates" sits in the app menu under About. The feed, the public key
and the once-a-day schedule are `SUFeedURL`, `SUPublicEDKey`,
`SUEnableAutomaticChecks` and `SUScheduledCheckInterval` in `project.yml`, which
writes them into `Sources/Info.plist`. The app is not sandboxed, so hardened
runtime is all Sparkle asks of the entitlements, and they stay an empty dict.

The EdDSA private key that signs an update is
`~/.config/attentionawareness/sparkle-ed25519.key` (mode 600), with a second copy
in the login keychain, where `generate_keys` put it. The release script signs
from the file, because reading the key out of the keychain opens a dialog and
waits for a person. Neither copy is ever in the repo. Lose both and no copy of
the app already out there will ever accept another update.

## License

Copyright (C) 2026 Mert Duzgun

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License as published by the Free
Software Foundation, version 3.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
details.

The full text is in [LICENSE](LICENSE). The SPDX identifier is
`AGPL-3.0-only`. The source code is at
<https://github.com/mertbuilds/attentionawareness>, in `apps/mac`, and the
app links to it from its About window and its Help menu.

The fast method in `Sources/Seed/` holds material adapted from
[Nugget](https://github.com/leminlimez/Nugget), which is under the AGPL
version 3, and that is why the app is under the same license. What the app
takes or bundles from others, and under which licenses, is in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
