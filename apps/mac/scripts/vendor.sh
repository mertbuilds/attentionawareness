#!/usr/bin/env bash
# Fill apps/mac/Vendor with libimobiledevice, its dependencies and the
# idevicebackup2 helper, then rewrite every install name so nothing resolves
# outside the app bundle at run time.
#
# The source is Vendor/prefix, which `scripts/build-libimobiledevice.sh` builds
# from the upstream release tags for arm64 with a deployment target of macOS
# 14.0. Without that prefix this script falls back to Homebrew so a dev build
# still works, but Homebrew bottles are built for the newest macOS: the app
# then warns at link time and is not safe to ship.
#
# Vendor/ is gitignored (only the module map is tracked). Run this before
# `xcodegen generate`, and again after rebuilding Vendor/prefix.
#
#   Vendor/lib      dylibs, install name @rpath/<name>
#   Vendor/bin      idevicebackup2 helper, bundled into Contents/Helpers
#   Vendor/include  headers + module.modulemap for the CImobileDevice module

set -euo pipefail

cd "$(dirname "$0")/.."

BREW="${BREW_PREFIX:-/opt/homebrew}"
VENDOR="Vendor"
PREFIX="$VENDOR/prefix"
LIB_DIR="$VENDOR/lib"
BIN_DIR="$VENDOR/bin"
INCLUDE_DIR="$VENDOR/include"
DEPLOY="14.0"

# <formula>:<dylib file name>. The formula name is only used for the Homebrew
# fallback path and its "run: brew install" hint.
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

if [ -d "$PREFIX/lib" ]; then
  SRC="$PREFIX"
  FROM_SOURCE=1
  echo "==> source: $PREFIX (built from source, arm64, macOS $DEPLOY)"
else
  SRC="$BREW"
  FROM_SOURCE=0
  {
    echo "!! Vendor/prefix is missing, falling back to Homebrew."
    echo "!! Homebrew bottles are built for the newest macOS, so the app will"
    echo "!! warn at link time and will not run on macOS $DEPLOY. This is a dev"
    echo "!! build only — run scripts/build-libimobiledevice.sh before shipping."
  } >&2
fi

# Where one dylib comes from. The from-source prefix is a plain lib directory;
# Homebrew keeps each formula in its own opt prefix.
dylib_src() {
  if [ "$FROM_SOURCE" -eq 1 ]; then
    echo "$SRC/lib/$2"
  else
    echo "$BREW/opt/$1/lib/$2"
  fi
}

# A build can produce a different soname than project.yml links against, for
# example after an upstream version bump. Find the one file that fills the same
# slot so the copy below can rename it, rather than failing outright.
find_alias() {
  local dir="$1" name="$2" base match found="" count=0
  base="${name%.dylib}"
  base="$(printf '%s' "$base" | sed -E 's/[-.][0-9][0-9.]*$//')"
  for match in "$dir/$base"[-.][0-9]*.dylib; do
    if [ ! -f "$match" ] || [ -L "$match" ]; then
      continue
    fi
    found="$match"
    count=$((count + 1))
  done
  if [ "$count" -eq 1 ]; then
    printf '%s' "$found"
  fi
  return 0
}

echo "==> clean $VENDOR (module map and prefix are kept)"
rm -rf "$LIB_DIR" "$BIN_DIR"
find "$INCLUDE_DIR" -mindepth 1 -not -name module.modulemap -delete 2>/dev/null || true
mkdir -p "$LIB_DIR" "$BIN_DIR" "$INCLUDE_DIR"

echo "==> copy dylibs"
for entry in "${DYLIBS[@]}"; do
  formula="${entry%%:*}"
  name="${entry##*:}"
  src="$(dylib_src "$formula" "$name")"
  if [ ! -f "$src" ]; then
    alias_src="$(find_alias "$(dirname "$src")" "$name")"
    if [ -n "$alias_src" ]; then
      echo "NOTE $name is gone; copying $(basename "$alias_src") under that name."
      echo "NOTE point project.yml at the new name when you get the chance."
      src="$alias_src"
    elif [ "$FROM_SOURCE" -eq 1 ]; then
      echo "missing $src — run: bash scripts/build-libimobiledevice.sh" >&2
      exit 1
    else
      echo "missing $src — run: brew install $formula" >&2
      exit 1
    fi
  fi
  # -L resolves a symlink (the Homebrew symlink farm, or the soname link in
  # the from-source prefix) down to the real file.
  cp -L "$src" "$LIB_DIR/$name"
  chmod u+w "$LIB_DIR/$name"
done

echo "==> copy helpers"
for helper in "${HELPERS[@]}"; do
  src="$SRC/bin/$helper"
  if [ ! -f "$src" ]; then
    if [ "$FROM_SOURCE" -eq 1 ]; then
      echo "missing $src — run: bash scripts/build-libimobiledevice.sh" >&2
    else
      echo "missing $src — run: brew install libimobiledevice" >&2
    fi
    exit 1
  fi
  cp -L "$src" "$BIN_DIR/$helper"
  chmod u+w "$BIN_DIR/$helper"
done

echo "==> copy headers"
for dir in libimobiledevice plist libimobiledevice-glue libtatsu; do
  if [ -d "$SRC/include/$dir" ]; then
    mkdir -p "$INCLUDE_DIR/$dir"
    cp -L "$SRC/include/$dir/"*.h "$INCLUDE_DIR/$dir/"
  fi
done
for header in usbmuxd.h usbmuxd-proto.h; do
  cp -L "$SRC/include/$header" "$INCLUDE_DIR/$header"
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
# @rpath/<name>, and each dependency that still resolves through an absolute
# path outside the OS (the Homebrew prefix, or Vendor/prefix) is rewritten to
# @rpath/<name>. The loader finds them through LD_RUNPATH_SEARCH_PATHS =
# @executable_path/../Frameworks.
rewrite() {
  local file="$1"
  local name
  name="$(basename "$file")"

  if [ "${file#"$LIB_DIR"}" != "$file" ]; then
    retool -id "@rpath/$name" "$file"
  fi

  otool -L "$file" | tail -n +2 | awk '{print $1}' | while read -r dep; do
    case "$dep" in
      /usr/lib/* | /System/*) ;;
      /*)
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

echo "==> verify no paths outside the bundle remain"
leaked=0
for file in "$LIB_DIR"/*.dylib "$BIN_DIR"/*; do
  stray="$(otool -L "$file" | tail -n +2 | awk '{print $1}' | grep -E '^/' | grep -vE '^(/usr/lib/|/System/)' || true)"
  if [ -n "$stray" ]; then
    echo "FAIL $file still references:" >&2
    echo "$stray" >&2
    leaked=1
  fi
done
if [ "$leaked" -ne 0 ]; then
  exit 1
fi

# The minimum OS version a Mach-O was built for, from either load command.
minos() {
  otool -l "$1" | awk '
    $1 == "cmd" && $2 == "LC_BUILD_VERSION" { build = 1; next }
    $1 == "cmd" && $2 == "LC_VERSION_MIN_MACOSX" { vmin = 1; next }
    build && $1 == "minos" { print $2; exit }
    vmin && $1 == "version" { print $2; exit }
  '
}

# $1 <= $2, both dotted versions.
version_le() {
  awk -v a="$1" -v b="$2" 'BEGIN {
    na = split(a, A, "."); nb = split(b, B, ".")
    for (i = 1; i <= 3; i++) {
      x = (i <= na ? A[i] + 0 : 0); y = (i <= nb ? B[i] + 0 : 0)
      if (x < y) exit 0
      if (x > y) exit 1
    }
    exit 0
  }'
}

echo "==> verify minimum OS version <= $DEPLOY"
bad=0
for file in "$LIB_DIR"/*.dylib "$BIN_DIR"/*; do
  version="$(minos "$file")"
  printf '    %-40s %s\n' "$(basename "$file")" "${version:-unknown}"
  if [ -z "$version" ] || ! version_le "$version" "$DEPLOY"; then
    bad=1
  fi
done
if [ "$bad" -ne 0 ]; then
  if [ "$FROM_SOURCE" -eq 1 ]; then
    echo "FAIL something is built for a newer macOS than $DEPLOY" >&2
    echo "rebuild with: bash scripts/build-libimobiledevice.sh --force" >&2
    exit 1
  fi
  {
    echo "!! Homebrew bottles are newer than macOS $DEPLOY, as expected."
    echo "!! ld will warn and the app will not run on $DEPLOY. Dev build only."
  } >&2
fi

echo "✓ vendored $(ls "$LIB_DIR" | wc -l | tr -d ' ') dylibs, ${#HELPERS[@]} helper, headers in $INCLUDE_DIR"
