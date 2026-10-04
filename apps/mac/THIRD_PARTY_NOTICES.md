# Third-party notices

attention awareness for Mac is under the GNU Affero General Public License,
version 3 (SPDX `AGPL-3.0-only`), Copyright (C) 2026 Mert Duzgun: see `LICENSE`
beside this file. The source code is at
<https://github.com/mertbuilds/attentionawareness>, in `apps/mac`. The app
also holds code adapted from other projects and carries the components below,
each under its own license. The full license texts are in `Resources/Licenses/`
beside this file, and in `Contents/Resources/Licenses/` inside the app, next to
a copy of this file.

## Code adapted from other projects

The fast method (`Sources/Seed/`) writes the same small backup that Nugget
restores. Parts of it are ported or copied from Nugget, and Nugget took some
of those parts from TrollRestore.

| Project      | Author                   | License  | Source                                                                                                          |
| ------------ | ------------------------ | -------- | --------------------------------------------------------------------------------------------------------------- |
| Nugget       | leminlimez               | AGPL-3.0 | <https://github.com/leminlimez/Nugget> (read at commit `26e0c50ec114ca3a4ff6ab2fb4ae309abfd39fa1`)              |
| TrollRestore | James Gill (JJTech0130)  | MIT      | <https://github.com/JJTech0130/TrollRestore> (read at commit `082f2520556b9aa8e2b8d6661b81a954ee35966b`)        |

What was taken, and where it is:

- `Sources/Seed/Mbdb.swift`: the `Manifest.mbdb` writer is a Swift port of
  `to_bytes` in Nugget's `src/restore/mbdb.py`, with the default permissions
  and flags Nugget gives a record. That file is the same in TrollRestore
  (`sparserestore/mbdb.py`), where it comes from.
- `Sources/Seed/SeedBackup.swift`: the backup keybag is copied byte for byte
  from `generate_manifest` in Nugget's `src/restore/backup.py`, and the
  `Status.plist` and `Manifest.plist` values follow the same file. Both are the
  same in TrollRestore (`sparserestore/backup.py`), where they come from. The
  `com.apple.purplebuddy.plist` payload follows `add_skip_setup` in Nugget's
  `src/devicemanagement/device_manager.py`.
- `Sources/Seed/CloudConfigurationEdit.swift`: the cloud configuration flags
  and the list of setup panes to skip are taken from `add_skip_setup` in
  Nugget.
- `Tests/SeedBackupTests.swift`: the `Manifest.mbdb` reader is a Swift port of
  `MbdbRecord.from_stream` in Nugget's `src/restore/mbdb.py` (the same in
  TrollRestore), and the reference bytes follow Nugget's writer.
- `Tests/MbdbTests.swift`: the expected bytes are worked out from `to_bytes`
  in the same file.

Each of those files names Nugget at the type or function it applies to.
Nugget's repository carries the AGPL version 3 text and no "or later" wording.
Nugget's README credits JJTech for Sparserestore and TrollRestore.

License texts, by file name in `Resources/Licenses/`:

- `AGPL-3.0.txt`: GNU Affero General Public License, version 3. It is the
  license of Nugget and of this app.
- `TrollRestore.txt`: the MIT license of TrollRestore, with its copyright
  line.

## Components

| Component             | Version               | License           | In the app as                                                                 | Source                                                                                   |
| --------------------- | --------------------- | ----------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| libimobiledevice      | 1.4.0                 | LGPL-2.1-or-later | `Contents/Frameworks/libimobiledevice-1.0.6.dylib`                            | <https://github.com/libimobiledevice/libimobiledevice/tree/1.4.0>                        |
| idevicebackup2        | 1.4.0                 | LGPL-2.1-or-later | `Contents/Helpers/idevicebackup2`                                             | <https://github.com/libimobiledevice/libimobiledevice/blob/1.4.0/tools/idevicebackup2.c> |
| libplist              | 2.7.0                 | LGPL-2.1-or-later | `Contents/Frameworks/libplist-2.0.4.dylib`                                    | <https://github.com/libimobiledevice/libplist/tree/2.7.0>                                |
| libimobiledevice-glue | 1.3.2                 | LGPL-2.1-or-later | `Contents/Frameworks/libimobiledevice-glue-1.0.0.dylib`                       | <https://github.com/libimobiledevice/libimobiledevice-glue/tree/1.3.2>                   |
| libusbmuxd            | 2.1.1                 | LGPL-2.1-or-later | `Contents/Frameworks/libusbmuxd-2.0.7.dylib`                                  | <https://github.com/libimobiledevice/libusbmuxd/tree/2.1.1>                              |
| libtatsu              | 1.0.5                 | LGPL-2.1-or-later | `Contents/Frameworks/libtatsu.0.dylib`                                        | <https://github.com/libimobiledevice/libtatsu/tree/1.0.5>                                |
| OpenSSL               | 3.6.3                 | Apache-2.0        | `Contents/Frameworks/libssl.3.dylib`, `Contents/Frameworks/libcrypto.3.dylib` | <https://github.com/openssl/openssl/tree/openssl-3.6.3>                                  |
| Sparkle               | 2.10.0 or a later 2.x | MIT               | `Contents/Frameworks/Sparkle.framework`                                       | <https://github.com/sparkle-project/Sparkle/tree/2.10.0>                                 |

The versions of the C libraries are the release tags in
`scripts/build-libimobiledevice.sh`. Sparkle comes in as a Swift package:
`project.yml` asks for 2.10.0 up to the next major, and the version a build
resolved is in its `Package.resolved`.

License texts, by file name in `Resources/Licenses/`:

- `LGPL-2.1.txt`: GNU Lesser General Public License, version 2.1. It covers
  libimobiledevice, libplist, libimobiledevice-glue, libusbmuxd, libtatsu and
  idevicebackup2, each "version 2.1 of the License, or (at your option) any
  later version".
- `GPL-2.0.txt`: GNU General Public License, version 2. See "The backup
  helper" below for why it is here.
- `Apache-2.0.txt`: the OpenSSL license.
- `Sparkle.txt`: the Sparkle license, with the external licenses it lists.
- `ed25519.txt`, `libsrp6a-sha512.txt`, `truerand.txt`, `jsmn.txt`,
  `time64.txt`: code inside the libraries, listed below.

## Code inside those libraries

Some of the libraries carry code from other projects, which is compiled into
the same dylib or framework.

| Code                                                         | Inside                                  | License                                                                                           | Text                  |
| ------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------- |
| ed25519, by Orson Peters                                     | libimobiledevice                        | zlib                                                                                              | `ed25519.txt`         |
| libsrp6a-sha512, from the Stanford SRP library               | libimobiledevice                        | The SRP license (BSD style)                                                                       | `libsrp6a-sha512.txt` |
| truerand, by Don Mitchell and Matt Blaze, in libsrp6a-sha512 | libimobiledevice                        | The AT&T notice in its source header                                                              | `truerand.txt`        |
| jsmn, by Serge A. Zaitsev                                    | libplist                                | MIT                                                                                               | `jsmn.txt`            |
| time64, by Michael G Schwern                                 | libplist                                | MIT                                                                                               | `time64.txt`          |
| SHA-1, SHA-256 and SHA-512 from LibTomCrypt, by Tom St Denis | libimobiledevice-glue, libimobiledevice | "free for all purposes without any express guarantee it works", in the words of its source header | none                  |
| bsdiff, sais-lite, ed25519, SUSignatureVerifier              | Sparkle                                 | BSD 2-clause, MIT, zlib, BSD 2-clause                                                             | `Sparkle.txt`         |

## The backup helper

`idevicebackup2` is the command line tool of the same name from
libimobiledevice, built from `tools/idevicebackup2.c` at the 1.4.0 tag with no
changes. Its source header puts it under LGPL-2.1-or-later, like the library,
and the upstream README names the LGPL version 2.1 for the library and its
utilities. The upstream repository also ships the GPL version 2 text as its
`COPYING` file, so that text is included here as `GPL-2.0.txt`.

The app does not link the helper. It starts it as a separate process out of
`Contents/Helpers` and reads what it prints.

## LGPL libraries: source and replacing them

- **Unmodified.** The five libraries and the helper are built from the
  upstream release tags above with no source changes.
  `scripts/build-libimobiledevice.sh` clones each tag and builds it for arm64
  with a deployment target of macOS 14.0. `scripts/vendor.sh` then rewrites
  the install names to `@rpath/` with `install_name_tool`, adds the rpath
  `@executable_path/../Frameworks` to the helper and signs the files. Nothing
  else is changed.
- **Source.** The complete source of each one is at its tag. The commits the
  tags point to:
  - libimobiledevice 1.4.0: `149f7623c672c1fa73122c7119a12bfc0012f2ac`
  - libplist 2.7.0: `cf5897a71ea412ea2aeb1e2f6b5ea74d4fabfd8c`
  - libimobiledevice-glue 1.3.2: `aef2bf0f5bfe961ad83d224166462d87b1df2b00`
  - libusbmuxd 2.1.1: `adf9c22b9010490e4b55eaeb14731991db1c172c`
  - libtatsu 1.0.5: `42329cb756682535c7c0f087987b78d1dd5b16c8`
- **Source offer.** If one of those links stops working, open an issue at
  <https://github.com/mertbuilds/attentionawareness/issues> and we will give
  you the source of the libraries in the version of the app you have. The
  offer holds for three years from the day that version was released.
- **Replacing a library.** The app links the libraries dynamically, and each
  one is a separate dylib in `Contents/Frameworks`. To run the app with a
  build of your own, build the library under the same file name with the
  install name `@rpath/<file name>`, put it in place of ours, and sign the app
  again, for example
  `codesign --force --deep --sign - "attention awareness.app"`. The source of
  the app itself is in this repository, under the AGPL version 3, so the whole
  app can be rebuilt too: see `README.md`.

## OpenSSL and Sparkle

OpenSSL is built from the `openssl-3.6.3` tag
(`aae016bfd52fcad2bc9657c2c782cfdf73b1ed5f`) with no source changes, by the
same script. Sparkle is the framework its Swift package ships, not built
here; Xcode signs it again when it embeds it.
