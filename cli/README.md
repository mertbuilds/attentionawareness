# supervise

A Mac command line tool that turns on iOS supervised mode without erasing the iPhone.

It patches one flag inside a local Finder backup. You then restore that backup in Finder,
and the iPhone starts again as a supervised device with your data still on it.

## What supervised mode is

Supervision is the state Apple gives to a device that a school or a company owns. A
supervised iPhone accepts configuration profiles that a normal iPhone refuses. Those
profiles are the only way to lock a phone down properly:

- A Safari allowlist. The phone reaches the sites you name and no others.
- The App Store removed from the phone.
- App installation and app removal blocked.
- Single App Mode, and many other restriction keys.

Without supervision you only get Screen Time. Screen Time is a reminder, not a wall. You
can turn it off in a few taps, which is exactly what a distracted brain does.

## Why Apple's path erases the phone

Apple turns on supervision through Apple Configurator with the Prepare action. Prepare
enrolls the device and wipes it first. That is fine for a fleet of new phones from a box.
It is painful for the phone you already use.

## How this tool avoids the erase

Supervision is recorded on the phone in a single property list file:

```
Library/ConfigurationProfiles/CloudConfigurationDetails.plist
```

That file has a boolean key named `IsSupervised`. The file is part of a normal Finder
backup. The tool finds the file inside a backup on your Mac, sets the flag to true, and
keeps the backup index in step with the byte size of the patched file. A restore writes the
patched file back to the phone, and the phone reads itself as supervised.

Nothing on the phone is erased, because a backup restore is not an erase.

## What you need

- A Mac.
- A cable.
- An iPhone with enough free space on the Mac for a full backup.
- A Finder backup. In Finder, select the iPhone, then click `Back Up Now`. An encrypted
  backup works too. The tool asks for the backup password and reads the backup with it.
- Full Disk Access for your terminal application. Backups live in a folder that macOS
  protects. Open System Settings, then Privacy & Security, then Full Disk Access. Add your
  terminal application, turn the switch on, quit the terminal fully, and start it again.
- Find My iPhone off, and Stolen Device Protection off, during the restore. Finder refuses
  to restore while Find My is on.

## Install

```
curl -fsSL https://attentionawareness.com/install.sh | sh
```

The installer checks that this is a Mac with `python3`, downloads one file to
`~/.local/bin/supervise`, and makes it executable. If `~/.local/bin` is not on your PATH, it
prints the line to add. It edits none of your files.

With pipx instead:

```
pipx install supervise-iphone
```

## Usage

The tool has no dependencies. Python 3.9 or newer is enough.

```
supervise check
supervise patch
supervise unpatch
supervise verify
supervise run
```

- `check` lists every backup on the Mac with the folder name, the device name, the iOS
  version, the backup date, whether it is encrypted, and the current `IsSupervised` value.
  Add `--json` for machine readable output. An encrypted backup shows `IsSupervised` only
  when you add `--password`.
- `patch` sets the flag. It shows you what it will change and asks for confirmation.
  Add `--yes` to skip the question.
- `unpatch` puts back the untouched copies that `patch` saved.
- `verify` asks the connected iPhone whether it is supervised. It uses `cfgutil` from
  Apple Configurator.
- `run` does check, then patch, then verify, with a pause for the restore.
- `update` downloads the newest single file over the installed one. A pipx install prints
  the pipx command instead.
- `--version` prints the version.

If the Mac holds a backup of more than one device, add `--udid <UDID>`. Run `check` to read
the UDIDs.

Finder also keeps dated archive copies of a backup beside the live folder, for example
`00008140-001878AE0CF9401C-20260910-162122`. Both folders hold the same UDID, so `check`
prints the folder name and the kind of each one: `current` or `Finder archive copy`. The
commands use the current folder, and they say which folder they use. To work on an archive
copy, pass the folder name: `--udid <folder name>`.

Exit codes: `0` for success, `1` for a problem you must fix, `2` for an unexpected error.

## Encrypted backups

An encrypted backup works. Every file inside it is AES-256, and the keys sit in a keybag
inside `Manifest.plist` that the backup password opens. Give the password in one of three
ways:

```
supervise patch --password 'the password'
SUPERVISE_BACKUP_PASSWORD='the password' supervise patch
supervise patch            # it asks, and the typing stays hidden
```

- The password is the one you set in Finder for the backup. It is not the passcode of the
  iPhone.
- The password reaches no file. Neither do the keys it makes.
- Turning the password into keys runs ten million rounds of PBKDF2. This takes up to about
  ten seconds. The tool says so while it waits.
- `Manifest.db` can be tens of megabytes, so the tool hands that one file to the `openssl`
  binary that ships with macOS. The plain copy lands beside the untouched copies, readable
  by you alone, and the tool deletes it after it reads the one row it needs.
- The patched file goes back encrypted with the same key. When the patch changes the byte
  size, `Manifest.db` is re-encrypted with the same key as well, so the index and the file
  agree. A pristine copy of both files is kept in
  `.../MobileSync/Backup/attentionawareness-pristine/<UDID>-<timestamp>/`.
- A `Manifest.db` over 64 MB that has to be written again needs `openssl`, because the
  Python fallback would take hours. macOS ships `openssl`, so this refusal is theoretical.

## Step by step

1. Connect the iPhone. Open Finder and select the device.
2. Click `Back Up Now`. Wait for the end. If the backup is encrypted, keep the backup
   password at hand.
3. Run `supervise check`. Read the backup date. It must be the backup you just made.
   `IsSupervised` must be `false`.
4. Run `supervise patch`. An encrypted backup asks for the backup password here. Read the
   plan and confirm. The tool prints the folder that holds the untouched copies. Keep that
   path.
5. On the iPhone, turn off Stolen Device Protection.
6. On the iPhone, turn off Find My iPhone.
7. In Finder, click `Restore Backup` and pick the backup you patched. The phone restarts
   and then restores its apps and data. This takes a while.
8. Open Settings on the iPhone. The banner at the top says that this iPhone is supervised.
9. Turn Find My iPhone on again.
10. Run `supervise verify`.

## What you keep and what you lose

You keep your photos, messages, notes, health data, app data, settings, and your home
screen layout. A backup restore is a full restore.

You lose some convenience:

- Apps download again from the App Store. This needs time and network.
- Some apps ask you to log in again. Apps that store a token in the keychain usually
  survive, but banking apps and some two factor apps do not.
- Face ID needs a new enrollment.
- Apple Pay cards need to be added again.
- The Apple Watch may need to be paired again.

Set aside an evening. Do not do this an hour before you need the phone.

## Verified on

| Date       | Device     | iOS    | Backup              | Result                                                    |
| ---------- | ---------- | ------ | ------------------- | --------------------------------------------------------- |
| 2026-09-10 | iPhone17,3 | 26.6.1 | Finder, unencrypted | Settings showed the phone as supervised after the restore |

If you run this on another version, please open an issue with the device and the iOS
version, and say whether it worked.

## Caveats

- Apple does not support this procedure. It is a patch of a private file inside a backup.
- iOS 27 may change how a restore handles this file. Test on a phone you can rebuild.
- The encrypted path has met no real encrypted backup yet. The tests build one and
  patch it, but no phone has restored from one. Keep the untouched copies that `patch`
  saves.
- An XML plist keeps its length, because the tool pads it with newlines, and `Manifest.db`
  stays untouched. A binary plist grows or shrinks instead, so the tool writes the new size
  into `Manifest.db` and, in an encrypted backup, encrypts that file again with the same
  key.
- The organization name stays empty, so the supervision banner shows no company name.
  The tool does not write `OrganizationName` in this version.
- The tool never touches the phone. It only writes inside the backup folder on the Mac.
- Before any write, the tool copies the original file and `Manifest.db` to
  `.../MobileSync/Backup/attentionawareness-pristine/<UDID>-<timestamp>/` and prints the path.

## How to undo

Two ways:

- Undo the patch in the backup: run `supervise unpatch`. This puts back the
  untouched copies. It only helps before a restore.
- Remove supervision from the phone: erase the phone. Settings, then General, then Transfer
  or Reset iPhone, then Erase All Content and Settings. Then restore a backup that was made
  before the patch. Supervision does not survive an erase.

## Development

The code lives in `cli/src/supervise_iphone/`. `cli/supervise.py` is a shim that runs the
package straight from a checkout: `python3 cli/supervise.py check`.

```
cd cli && python3 -m unittest discover -s tests
```

Release step: build the single file that the installer downloads, then commit it.

```
python3 cli/build_single.py
```

That writes `cli/dist/supervise`, a copy of the package module with a shebang on top.
`install.sh` downloads that file from `main`, so a change to the package reaches users only
after the rebuilt file is committed.

## Credits

The mechanism comes from this Ask Different thread:
https://apple.stackexchange.com/questions/285128

And from Stepan Parunashvili's write up:
https://stopa.io/post/297
