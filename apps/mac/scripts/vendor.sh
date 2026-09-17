#!/usr/bin/env bash
# Copy libimobiledevice + its dependencies out of Homebrew into apps/mac/Vendor,
# then rewrite every install name so nothing points at /opt/homebrew at run time.
#
# Vendor/ is gitignored (only the module map is tracked). Run this before
# `xcodegen generate`, and again after a `brew upgrade libimobiledevice`.
#
#   Vendor/lib      dylibs, install name @rpath/<name>
#   Vendor/bin      idevicebackup2 helper, bundled into Contents/Helpers
#   Vendor/include  headers + module.modulemap for the CImobileDevice module

set -euo pipefail

cd "$(dirname "$0")/.."

BREW="${BREW_PREFIX:-/opt/homebrew}"
VENDOR="Vendor"
LIB_DIR="$VENDOR/lib"
BIN_DIR="$VENDOR/bin"
INCLUDE_DIR="$VENDOR/include"

# <formula>:<dylib file name>
DYLIBS=(
  "libimobiledevice:libimobiledevice-1.0.6.dylib"
  "libimobiledevice-glue:libimobiledevice-glue-1.0.0.dylib"
  "libusbmuxd:libusbmuxd-2.0.7.dylib"
  "libplist:libplist-2.0.4.dylib"
  "libtatsu:libtatsu.0.dylib"
  "openssl@3:libssl.3.dylib"
  "openssl@3:libcrypto.3.dylib"
)

HELPERS=(idevicebackup2)

echo "==> clean $VENDOR (module map is kept)"
rm -rf "$LIB_DIR" "$BIN_DIR"
find "$INCLUDE_DIR" -mindepth 1 -not -name module.modulemap -delete 2>/dev/null || true
mkdir -p "$LIB_DIR" "$BIN_DIR" "$INCLUDE_DIR"

echo "==> copy dylibs"
for entry in "${DYLIBS[@]}"; do
  formula="${entry%%:*}"
  name="${entry##*:}"
  src="$BREW/opt/$formula/lib/$name"
  if [ ! -f "$src" ]; then
    echo "missing $src — run: brew install $formula" >&2
    exit 1
  fi
  # -L resolves the Homebrew symlink farm down to the real Cellar file.
  cp -L "$src" "$LIB_DIR/$name"
  chmod u+w "$LIB_DIR/$name"
done

echo "==> copy helpers"
for helper in "${HELPERS[@]}"; do
  src="$BREW/bin/$helper"
  if [ ! -f "$src" ]; then
    echo "missing $src — run: brew install libimobiledevice" >&2
    exit 1
  fi
  cp -L "$src" "$BIN_DIR/$helper"
  chmod u+w "$BIN_DIR/$helper"
done

echo "==> copy headers"
for dir in libimobiledevice plist libimobiledevice-glue libtatsu; do
  if [ -d "$BREW/include/$dir" ]; then
    mkdir -p "$INCLUDE_DIR/$dir"
    cp -L "$BREW/include/$dir/"*.h "$INCLUDE_DIR/$dir/"
  fi
done
for header in usbmuxd.h usbmuxd-proto.h; do
  cp -L "$BREW/include/$header" "$INCLUDE_DIR/$header"
done
chmod -R u+w "$INCLUDE_DIR"

# install_name_tool always warns that it invalidated the code signature. That
# is expected here (everything is re-signed below), so drop only that line and
# keep any real error.
retool() {
  local err
  if ! err="$(install_name_tool "$@" 2>&1)"; then
    echo "$err" >&2
    return 1
  fi
  echo "$err" | grep -v "will invalidate the code signature" | grep -v "^$" >&2 || true
}

# Every copied Mach-O gets the same treatment: its own id becomes
# @rpath/<name>, and each dependency that still resolves inside the Homebrew
# prefix is rewritten to @rpath/<name>. The loader finds them through
# LD_RUNPATH_SEARCH_PATHS = @executable_path/../Frameworks.
rewrite() {
  local file="$1"
  local name
  name="$(basename "$file")"

  if [ "${file#"$LIB_DIR"}" != "$file" ]; then
    retool -id "@rpath/$name" "$file"
  fi

  otool -L "$file" | tail -n +2 | awk '{print $1}' | while read -r dep; do
    case "$dep" in
      "$BREW"/*)
        retool -change "$dep" "@rpath/$(basename "$dep")" "$file"
        ;;
    esac
  done
}

echo "==> rewrite install names"
for entry in "${DYLIBS[@]}"; do
  rewrite "$LIB_DIR/${entry##*:}"
done
for helper in "${HELPERS[@]}"; do
  rewrite "$BIN_DIR/$helper"
  # The helper runs as its own process out of Contents/Helpers, so it carries
  # its own rpath instead of inheriting the app binary's.
  retool -add_rpath "@executable_path/../Frameworks" "$BIN_DIR/$helper"
done

# The signatures are invalidated by install_name_tool; re-sign ad hoc so the
# files load during a Debug build. The Release build re-signs them on copy.
echo "==> re-sign ad hoc"
for entry in "${DYLIBS[@]}"; do
  codesign --force --sign - "$LIB_DIR/${entry##*:}" 2>/dev/null
done
for helper in "${HELPERS[@]}"; do
  codesign --force --sign - "$BIN_DIR/$helper" 2>/dev/null
done

echo "==> verify no $BREW paths remain"
leaked=0
for file in "$LIB_DIR"/*.dylib "$BIN_DIR"/*; do
  if otool -L "$file" | grep -q "$BREW"; then
    echo "FAIL $file still references $BREW:" >&2
    otool -L "$file" | grep "$BREW" >&2
    leaked=1
  fi
done
if [ "$leaked" -ne 0 ]; then
  exit 1
fi

echo "✓ vendored $(ls "$LIB_DIR" | wc -l | tr -d ' ') dylibs, ${#HELPERS[@]} helper, headers in $INCLUDE_DIR"
