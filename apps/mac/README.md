# attention awareness for Mac

Native macOS app (SwiftUI, macOS 14+) that supervises a connected iPhone and
installs restrictions over USB. It has one method, the fast one: it restores a
small configuration backup and restarts the iPhone. Which iPhones get a run:

| iOS on the iPhone | What the app does |
| --- | --- |
| 26 and earlier | runs the fast method |
| 27 | runs the fast method with one more step, the live step |
| 28 and later | no run: Connect shows "iOS 28 Is Not Supported Yet" and opens the manual guide or the profile builder |
| missing or unreadable version | no run: Connect shows "Couldn't Read the iOS Version" and opens the same guide or builder |

The rule is `IOSSupport` in `Sources/Seed/IOSSupport.swift`: the first number
of the version, compared as a number, 27 or below runs. A version that is
missing or does not read is never taken for an earlier one, because the app
is not tested on iOS 28 or later. In place of Continue, Connect says why and
has two buttons. Open the Guide, the filled one, opens the manual guide with Apple
Configurator on the site (`SiteLink.guide`,
`https://attentionawareness.com/guide?utm_source=mac-app&utm_medium=referral&utm_campaign=ios27_guide`).
That way erases the iPhone, and the screen says so.
Open the Profile Builder, the bordered one before it, opens the profile
builder on the site (`SiteLink.profileBuilder`,
`https://attentionawareness.com/build?utm_source=mac-app&utm_medium=referral&utm_campaign=ios27_builder`),
so the restrictions profile need not be made in Apple Configurator. Both
campaigns keep the name they had when the screen was for iOS 27. The screen follows the
iPhone Connect has picked: another iPhone on iOS 27 or earlier brings Continue back. An
iPhone on iOS 28 that is already supervised, by Apple Configurator for
example, still gets Manage Restrictions, because the restrictions profile does
not care how the iPhone got supervised, and that path runs no restore.

Behind the screen, two guards refuse the restore on iOS 28 and later and on
an unknown version, each from a fresh read of the iPhone: `WizardModel` before the job
(`verifyFastSupportsIOS`) and `SeedEngine` before it reads the configuration
and again right before the restore (`gate`). `WizardModel.start()` and
`startJob()` refuse the run as well.

How iOS 27 got its run: on 2026-10-05 an iPhone SE on iOS 27.2 went through
both methods the app had then. The fast restore finished with no error, and
the iPhone came back erased and not supervised. The full copy (back up the
whole iPhone, patch the copy, restore it) also finished with no error, and the
iPhone also came back erased and not supervised. So the full copy was taken
out of the app, and 0.4.4 and 0.4.5 refused iOS 27. This matched
[Apple's managed-device restore documentation](https://support.apple.com/guide/deployment/restore-managed-apple-devices-depd44f04xc4/1/web/1.0)
and [Nugget's iOS 27 data-loss warning](https://github.com/leminlimez/Nugget#readme).
The same day the run below, with a different restore and the live step, kept
all data on that iPhone, and a Release build now runs it on iOS 27.
On iOS 26 and earlier the fast method supervises a real iPhone as before, and the app
finds it again after the restart.

What we think the first fast run was missing on iOS 27: Apple's deployment
guide, linked above, says that on iOS 27 a restore does not bring supervision
or management back. So we expect iOS 27 to ignore the cloud configuration the
restore puts back and to take it only live. No run of ours tests this alone.
A run there has one more step, the live step, and its restore is a different one. The
seed holds the supervision domain alone (four records, no
`com.apple.purplebuddy.plist`), and the helper runs with
`restore --skip-apps --remove --reboot`: no system files, items that are not
restored are removed, and the restore restarts the iPhone itself. The restore
only has to bring the iPhone back, not supervised. In some runs the iPhone
then shows the Setup Assistant screen "Restore Completed", and in some it
does not. The app
waits until this Mac has paired again (unlock, Trust, passcode), then sends
the same configuration live over MCInstall (`SetCloudConfiguration`) and reads
it back (`SeedEngine.applyLiveConfiguration`). Only then is Continue tapped on
the iPhone, where it shows that screen, and the run goes on as on iOS 26: the
look at Settings, then Restrictions. The window says each of these while it
waits, and "If iPhone shows Restore Completed, tap Continue now." once the
setting went through. The last screen says "iPhone may ask for your Apple
account password once." When the iPhone did
not take the setting within 90 seconds, the screen is "iPhone Didn't Take the
Setting", and Try Again sends the setting again alone: no second restore and
no restart. Cancel and Supervise again do the same, also when the iPhone left
the cable in between and the window went back to Connect: the app keeps the
owed step for that iPhone until the setting went through, a run on another
iPhone starts or the app quits. A run that takes supervision off goes the
same way.

What is known about iOS 27, and no more than this:

- On an iPhone SE with iOS 27.2 our earlier run (the restore with
  `--system --no-reboot`, then our own restart) finished with no error, and
  the iPhone came back erased and not supervised.
- On 2026-10-05 another tool that uses this sequence (a small restore that
  restarts the iPhone, then `SetCloudConfiguration` over MCInstall while the
  iPhone is on Restore Completed) supervised that same iPhone SE on iOS 27.2
  and kept its data. Its restore sends no system files and removes the items
  it does not restore, and its seed holds the supervision domain alone.
- On 2026-10-05 this app ran the live step on that same iPhone SE with iOS
  27.2. The restore restarted the iPhone, the app paired again on Restore
  Completed, and `SetCloudConfiguration` was acknowledged and read back. The
  iPhone still came back erased. That restore sent system files
  (`--system --skip-apps --reboot`) and a seed with the setup state.
- So `--no-reboot` with our own restart was not the cause of the erase: a
  restore with system files that restarts the iPhone itself erased it too.

Device results from 2026-10-05, on one iPhone SE (2nd generation) with iOS
27.2 and a Debug build of this app, in both directions: runs that supervise
and runs that take supervision off. Each run changed at most one thing from
the set the app sends on iOS 27 (no system files, remove, no setup file, the
restore restarts the iPhone). The Debug build had a switch for each change
then, and they are gone now:

1. Nothing changed, a run that takes supervision off: all data kept, and the
   iPhone ended not supervised.
2. The restore sent no remove, a run that supervises, on an iPhone signed in
   to an Apple account: photos, apps and the Apple account kept, and the
   iPhone ended supervised.
3. The seed also held the setup records and the setup file, a run that takes
   supervision off: all data kept, not supervised. The iPhone still stopped
   on Restore Completed.
4. Nothing changed, a run that supervises: all data kept, supervised. The
   iPhone did not show Restore Completed in this run. We think the setting
   arrived first and the iPhone then skips that screen. One more such run on the iPhone that was
   then supervised also kept all data. That time the iPhone asked for Trust
   and showed Restore Completed and a privacy screen.
5. The restore sent system files, a run that takes supervision off: after
   the passcode the iPhone showed the Apple logo with a progress bar for a
   long time. Then the Apple account was signed out and the photos were
   gone. Apps and Safari tabs stayed.

What these show: system files (`RestoreSystemFiles` true) is what loses data
on iOS 27. Remove and the setup file do not lose data. Who restarts the
iPhone was not tested alone: both runs with system files lost data, one with
each way of restarting. This
agrees with the earlier run of that day in the list above, which sent system
files, no remove and the setup file, and lost data too. The settings of each
mode are in one place, `SeedMode.settings`, and the `fast: restore started`
log line gives the values a run used.

Also seen in these runs:

- The first screen after the restart is white and says "Press home to
  upgrade". That is on an iPhone with a Home button; on other iPhones the
  person swipes up. Then comes the passcode. Then, in some runs, a Trust
  prompt, and in some runs Restore Completed with a Continue button.
- After every run, a tap on the Apple account at the top of Settings asks for
  the Apple account password once. The account stays.
- With the app's profile installed on iOS 27.2, a blocked app shows no popup
  any more: it is not on the Home Screen and cannot be opened. Website
  blocking and the adult content filter work as before.

A Release build runs this on iOS 27. Not tested: other iPhone models, iOS
27.0.x, and iOS 26 on a device after this change (its code path is
untouched).

Back up the iPhone first, with Finder or iCloud. The app does not erase the
iPhone, but things can go wrong, and that backup is the way back. We are not
responsible for lost data. The Ready screen says so, and Supervise stays off
until the person ticks "I backed up my iPhone".

The fast method uses an isolated temporary seed folder and makes no backup of
its own. At launch the app moves the copy of iPhone that 0.4.0 to 0.4.2 kept
under `~/Library/Application Support/attention awareness/Backups` to the Trash,
never deletes it, and removes the two `transferRate.*` defaults
(`OldBackupCopy`). The first test on an iPhone SE
running iOS 26.6.2 applied supervision but reopened Setup Assistant and
redownloaded photos from iCloud.
The seed now includes Nugget's setup-screen skip list and managed
setup-completion preferences. The hardware retest of this correction, on the
owner's iPhone on 2026-10-04 with app version 0.4.2, went through: the iPhone
came back supervised with its data kept. One fault showed, in the app and not
in the method: the wait after the restart did not find the iPhone again until
the cable was pulled and put back. The restore resets the iPhone's pairing
records, so after the restart it refuses this Mac's pair record
(InvalidHostID). macOS pairs again only when the iPhone is plugged in, and
right after the restart that is while it is still locked, so nothing paired
again until the cable was pulled. 0.4.3 pairs again itself (see the wait
below). Unit tests do not establish that local data survives a restore.

After the restart, the job reads the iPhone every two
seconds on its own and waits on no connect or disconnect, because a restarted
iPhone is back on the cable before it answers. It only counts a read made
after one that missed the iPhone, so the answer from before the restart ends
nothing. While it waits it says what is missing: "Unlock iPhone." for an
iPhone that is locked, "Tap Trust on iPhone." for one that asks for trust.
Every lockdown session that meets InvalidHostID sends Pair once (`Pairing` in
`Sources/Device/Pairing.swift`): a locked iPhone answers that it needs its
passcode, an unlocked one shows Trust, and once Trust is tapped the next Pair
saves a new record through usbmuxd and the read goes on. A locked iPhone
gets Pair every 2 seconds, since it shows nothing. After the first Pair that
shows Trust, no Pair is sent on a timer: one sent while the person types the
passcode cancels it and the iPhone answers UserDeniedPairing until the cable
is pulled (seen on the owner's iPhone). As usbmuxd's preflight does, the app
listens on the insecure notification proxy (`TrustObserver`) for
`request_pair`, which comes once Trust is tapped and the passcode entered, and
then sends one Pair. UserDeniedPairing is final until the iPhone leaves the
cable. The handshake runs on every read, so a record saved by anything on
this Mac is used at once. If no `request_pair` is heard two minutes after
Trust showed (the proxy did not start, Don't Trust, or the alert closed with
the screen lock), the read asks for a replug, and a `request_pair` that comes
later still sends its one Pair. A Pair the iPhone accepted whose record is
still refused is a failure ("couldn't keep the pairing") on every read until
a replug, not a wait for Trust. Both keep the iPhone listed as needing a
replug, so the connect screen and the restart wait say "Unplug iPhone".
Outside the job and Ready, the wizard reads the cable every 2.5 seconds while
an iPhone on it is locked, waits for Trust or could not be read, because an
unlock sends no event, and reads nothing while every iPhone is paired.

After 5 minutes the screen becomes "iPhone Didn't Reconnect" with Check Again, and the reading goes on
underneath. Check Again reads the iPhone and nothing else: it sends no
configuration and restarts nothing.

A Debug build takes `--debug-forget-pairing`: it gives the Mac's own pair
record for the iPhone on the cable a HostID the iPhone does not know, which
is the state the restore leaves, then opens the window. It touches nothing on
the iPhone, and a replug lets macOS pair again.

A Debug build also takes `--debug-unsupervise`, for running the supervise
flow many times on one iPhone without erasing it. The run is the usual one,
but the flag it writes takes supervision off, so it
starts on a supervised iPhone, ends once the iPhone says it is not
supervised, skips the Restrictions step and sends no count. The window says
so over every step. The next launch without the flag supervises again.

A Debug build also takes `--debug-fast-any-ios`, for testing the fast method
on a version the app refuses: iOS 28 or later, or an iPhone that gives no
version. Use an iPhone whose data you can lose: no such version is tested.
Connect then skips the
guide screen and offers Continue, and the run goes past both version guards.
On iOS 28 or later the run takes the live step described above, as on iOS
27; an iPhone that gives no version gets the run iOS 26 gets. That run sends
system files, and system files lost data on iOS 27.2, so the flag can lose
data on such an iPhone.
On iOS 27 and earlier nothing changes. The window shows a red line over every step,
and the launch says so in Terminal and in the log. It combines with
`--debug-unsupervise`. A Release build has none of the debug flags.

What a person does on the iPhone in a run on iOS 27: nothing
while the restore runs. The iPhone restarts by itself. When it is back, press
the Home button or swipe up, then enter the passcode. If it asks, tap Trust
and enter the passcode. If it shows Restore Completed, stay on it and do not
tap Continue. When the window says "If iPhone shows Restore Completed, tap
Continue now.", tap Continue if that screen is there, finish the setup
screens, and look at the top of Settings. A tap on the Apple account there
can ask for the Apple account password once.

The device layer writes every read's outcome to the Mac's log under the
subsystem `com.attentionawareness.mac`, category `device`: pairing states,
lockdown error codes, and the restart wait's steps, never a udid or a device
name. To read a run back:
`/usr/bin/log show --last 30m --info --predicate 'subsystem == "com.attentionawareness.mac"'`.

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
screen at a time. The fast method runs on the Supervising screen.

Unplugging the iPhone a run is about takes the window back to Connect from
any step, and unplugging any other iPhone changes nothing. A helper that still
has the iPhone is cancelled the way Cancel cancels it, and the window goes
back once it has stopped. The one stretch left out is the restore: the run
restarts the iPhone, so the phone leaving the cable is part of the job, which
waits for it to come back, and a restore that stopped part way keeps its
screen and its Try Again. Once the iPhone is back, unplugging goes back to
Connect again, so Check on iPhone and the Restrictions guide both ask to keep
iPhone connected.

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
    "app_version": "0.4.3",
    "method": "fast",
    "ios_major": 26,
    "macos_major": 15,
    "$process_person_profile": false,
    "$geoip_disable": true
  }
}
```

- `method` is always `fast`, the one method the app has. Versions before
  0.4.3 also sent `full_copy`; the key stays so the counts read the same.
  `ios_major` is the first number of the iOS version, and it is left out when
  the iPhone gave no version.
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
  `User-Agent: attentionawareness-mac/0.4.3` (the app version, in place of the
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
which is how the device layer is checked without the window.

`--seed` changes the connected iPhone the way the window does, and it does
not ask first. Back up the iPhone with Finder or iCloud before you use it.
That backup is the way back, and we are not responsible for lost data.

`--seed <udid>` runs the fast method without a window. It reads the current
cloud configuration and preserves its other policy keys, checks the live iOS
version before restoring, and writes the seed in its own temporary root. On
iOS 26 and earlier the seed holds the cloud configuration and the managed
`mobile/com.apple.purplebuddy.plist` setup-completion preferences, and the
bundled helper runs with `restore --system --skip-apps --no-reboot`. Only a
successful restore is followed by a diagnostics-relay restart. If
configuration was restored but restart fails, restart iPhone before repeating
a restore. On iOS 27 the seed and the restore are the ones of the live mode
above (`restore --skip-apps --remove --reboot`), and `--seed` stops there: it
does not wait for the iPhone and does not send the setting live, so the
iPhone is not supervised yet. It says so and exits non-zero; use the window
for a whole run. Ctrl+C asks the helper to stop and waits for it before
removing the temporary seed. `--seed` keeps both version guards: it refuses
iOS 28 and later and an unknown version. A Release build has no version
override.

`--ui-smoke` builds every step of the wizard offscreen and prints the size each
one asks for, so the window can be checked on a Mac whose display is asleep. Add
a folder, `--ui-smoke /tmp/shots`, and it writes a picture of each step there as
well. Add `--appearance light` or `--appearance dark` to draw them that way,
whatever this Mac is set to. It also unplugs the iPhone from each step past Connect and exits non-zero
when one of them lands on a step other than the one it should.

`--demo` opens the real window on a wizard that reaches no iPhone, no disk and
no site, with a bar under it for driving the states by hand. Every view is the
one that ships; only the other end of it changes. A job runs in about fifteen
seconds: the restore with its bar, the restart and the question at the end.
The demo bar jumps to any step and sets what the wizard finds when it looks:
how many iPhones are on the cable, the iOS version (26, 28 or one that does
not read; the last two show the guide screen on Connect), Find My on or off, a phone
that is already supervised, a profile already installed, how the reader's own
backups read in iCloud and in Finder, Full Disk Access granted, refused, or
still refused after a trip to System Settings, and whether the next restore or
install succeeds, fails or is cancelled. Setting the iPhones to None at any
step unplugs the one the run is about, and going from Two to One unplugs the
other one.

Nothing real is in reach of it. The demo is built on a watcher that reads no
bus and an engine that refuses to start the helper, and every method that
would ask the site for a signature or send anything to a phone is replaced by
one that waits a moment and says what the bar asked for. It writes nothing anywhere, and it is
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
  the reader archived count as well, and is values for the same reason;
  `WizardModel` holds one run of the wizard and owns the device watcher and the
  seed engine; the rest is one file per screen, plus `DevicePicker` for
  choosing between connected iPhones. Connect also draws the guide screen for
  an iPhone the app does not run on. Errors from the layers are shown in the
  step that caused them, never in a modal alert.
- `Sources/Seed/` is the fast method: `IOSSupport` is which iOS versions get a
  run, `CloudConfigurationEdit`, `SeedBackup` and `Mbdb` write the small seed,
  and `SeedEngine` reads the iPhone, restores the seed and restarts it, and
  on iOS 27 or later sends the configuration live after the restart.
  `Sources/Backup/` is `BackupEngine`, which runs the bundled `idevicebackup2`
  helper for that restore and reads what it prints.
- Finder's backup folder is the one thing in the app that wants Full Disk
  Access. The app makes no backup of its own. macOS also offers no way for an
  app to ask for the permission, so while the folder is refused and no recent
  iCloud backup covers the reader, the Ready screen's backup row asks for Full
  Disk Access in words, with a button that opens the list in System Settings. The app looks again the moment it is back in front. When the
  folder is still refused after that trip, the row asks for a reopen instead,
  because macOS can wait for an app to open again before the switch counts,
  and its Reopen button quits the app and opens it again, with Open System
  Settings beside it for a switch that is not on yet. A refusal costs the run
  nothing: the iCloud answer is there either way and every button works the
  same.
- `Sources/Demo/` is the `--demo` flag and nothing else, and every file of it
  is behind `#if DEBUG`: `DemoScript` is the timeline a demo restore runs to
  and `DemoConditions` the switches the bar writes, both plain values the tests
  run; `DemoWorld` makes the iPhones out of those switches;
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

A release is made by GitHub Actions (`.github/workflows/mac-release.yml`) on a
macOS runner, so it needs no Mac of the owner's:

1. In a pull request, run `bash scripts/bump.sh <version>` and write
   `release-notes/<version>.md`. Merge it.
2. Push the tag `mac-v<version>` on that commit of `main`:
   `git tag mac-v0.5.1 && git push origin mac-v0.5.1`. Only the owner can: a
   tag ruleset stops everyone else (see the setup below).
3. Look before you approve. The workflow waits for the reviewer of the
   environment `mac-release`, and the run's name says what it is, for example
   `mac-v0.5.1 (REAL RELEASE)` or `main (dry run)`. On the run's page, open
   the commit and confirm two things: it is on `main`, and it is the bump
   commit you merged. Reject the run when either is not so, or when you did
   not push the tag yourself.
4. Approve. The run then does the tests and `scripts/release.sh`, and the
   uploads are live at once.

The workflow also checks the ref itself: it stops before it reads a secret when the tag is not
`mac-v<MARKETING_VERSION>` of `project.yml`, or when the commit is not on
`main`. That check only stops an honest mistake. For a tag, GitHub runs the
workflow file of the tagged commit, not the one on `main`, so a tag on a commit
off `main` can carry a workflow with no check at all, one that sends the
secrets out. This is why step 3 is not optional. `release.sh` then holds the
build number and the dmg name as it does on a Mac (see below).

A dry run: Actions → Mac release → Run workflow, on `main`, with `dry_run`
ticked (the default). It needs the same approval and does everything but the
uploads, the notary service included. It is not handed the Cloudflare token,
and it reads the published appcast from the site. The dmg, `appcast.xml` and `latest.json`
are kept for 7 days as the artifact `mac-release-dry-run`, which anyone signed
in to GitHub can download, as with every artifact of a public repo. It only passes
between the merge of a bump and its tag, because `release.sh` refuses a build
number the site already has. A manual run with `dry_run` unticked is a real
release of `main` without a tag.

The risk, plainly: the Sparkle private key and the Developer ID certificate
are in GitHub, and the two together can ship an update to every installed copy
of the app. Two things are the guard, and both are needed: the tag ruleset,
which lets only the owner make a `mac-v*` tag, and the reviewer, who looks at
the commit before approving. Protecting `main` is not the guard, because a
tag's run takes its workflow file from the tagged commit. Whoever can approve
a run of `mac-release`, change that environment's settings or change the tag
ruleset can ship. Keep all three to the owner. The reasons and how to revoke
each key are in `docs/adr/0011-mac-release-keys-in-github.md` at the root of
the repo.

### One-time setup in GitHub

In the repo's Settings → Environments, create `mac-release` with:

- Required reviewers: the owner. Leave "Prevent self-review" off when the
  owner is the only reviewer, or no one can approve the owner's own tag.
- Deployment branches and tags: selected only, the branch `main` and the tag
  pattern `mac-v*`.
- "Allow administrators to bypass configured protection rules" off.

In Settings → Rules → Rulesets, add a tag ruleset. It is required: without it
anyone who can write to the repo, a leaked token with contents write included,
can push a `mac-v*` tag on a commit of their own, and the environment's tag
rule accepts it.

- Enforcement: active. Target tags: the pattern `mac-v*`.
- Rules: restrict creations, restrict updates, restrict deletions.
- Bypass list: the owner alone, set to always allow. Nobody else, no app and
  no deploy key.

Then the environment's secrets. They are environment secrets and not repo
secrets, so no other workflow can read them:

| Secret | What | How to make it |
| --- | --- | --- |
| `MAC_DEVELOPER_ID_P12_BASE64` | the Developer ID Application certificate with its private key | Keychain Access → login → My Certificates → open "Developer ID Application: Mert Duzgun (3HGP3W3TLD)", select the certificate and the key under it → Export 2 items → `.p12`, with a new password. Then `base64 -i developer-id.p12`. |
| `MAC_DEVELOPER_ID_P12_PASSWORD` | the password of that `.p12` | the one typed at the export |
| `MAC_NOTARY_API_KEY_P8_BASE64` | an App Store Connect API key, for the notary service | App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → +, with the Developer role. The `.p8` downloads once. Then `base64 -i AuthKey_<key id>.p8`. |
| `MAC_NOTARY_API_KEY_ID` | that key's Key ID | on the same page |
| `MAC_NOTARY_API_ISSUER_ID` | the Issuer ID | at the top of the same page |
| `MAC_SPARKLE_ED25519_PRIVATE_KEY` | the Sparkle EdDSA private key | the contents of `~/.config/attentionawareness/sparkle-ed25519.key` |
| `MAC_CLOUDFLARE_API_TOKEN` | a Cloudflare API token for the one bucket | Cloudflare dashboard → R2 → Manage API tokens → Create API token, permission Object Read & Write, applied to the `MAC_FILES` bucket only. The secret is the token value, not the S3 key pair. |
| `MAC_CLOUDFLARE_ACCOUNT_ID` | the Cloudflare account that holds the bucket | the account ID in the dashboard |

And one environment variable, `MAC_R2_BUCKET`: the bucket name, the one bound
as `MAC_FILES` in `apps/web/cloudflare.config.ts`.

A secret goes in without passing the clipboard or a file in the repo, for
example
`base64 -i developer-id.p12 | gh secret set MAC_DEVELOPER_ID_P12_BASE64 --env mac-release`
and
`gh secret set MAC_SPARKLE_ED25519_PRIVATE_KEY --env mac-release < ~/.config/attentionawareness/sparkle-ed25519.key`.
Delete the exported `.p12` and the `.p8` afterwards.

On the runner the certificate goes into a keychain made for the run, the
notary profile `attentionawareness-notary` is stored in that same keychain
from the API key, and the Sparkle key is a file in the runner's temp folder.
The last step deletes all three, also after a failure. `release.sh` is told
where they are through `NOTARY_KEYCHAIN`, `SPARKLE_ED_KEY_FILE`, `R2_BUCKET`,
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The release job reads no cache, because any workflow on `main` can write a
cache and what this job builds is signed and shipped. It builds
libimobiledevice and OpenSSL from source on every run, and
`scripts/build-libimobiledevice.sh` stops when a clone is not at the commit
written beside its tag. Sparkle is pinned to a commit in `project.yml`. `cf`
comes from the lockfile, dmgbuild from `scripts/dmgbuild-requirements.txt`
with `pip install --require-hashes`, and xcodegen is a release binary checked
against its sha256 in the workflow. To move dmgbuild, write the one line
`dmgbuild==<version>` to a file `dmgbuild.in` and run
`uv pip compile --generate-hashes --no-header --no-annotate dmgbuild.in -o scripts/dmgbuild-requirements.txt`,
then put the comment at the top back. To move xcodegen, change the version and
the sha256 of `xcodegen.zip` in both workflows.

Pull requests and pushes to `main` that touch `apps/mac` run the unit tests
on the same runner image (`.github/workflows/mac-ci.yml`), with no secret.
That job does keep the built libimobiledevice in a cache.

### On a Mac

The script still runs on the owner's Mac as before, with none of those
variables set:

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

The package is pinned to one commit (`revision:` in `project.yml`), the commit
of the tag 2.10.0, so no build takes a newer Sparkle by itself. To move the
pin: read the commit of the new tag with
`git ls-remote https://github.com/sparkle-project/Sparkle refs/tags/<version>`,
put it in `project.yml`, change the version in `THIRD_PARTY_NOTICES.md`, run
`xcodegen generate` and the tests.

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
