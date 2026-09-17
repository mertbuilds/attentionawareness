#!/usr/bin/env bash
# Build libimobiledevice, its dependencies and OpenSSL from source into
# apps/mac/Vendor/prefix, for arm64 with a deployment target of macOS 14.0.
#
# Homebrew bottles are built against the newest macOS, so linking them into an
# app that targets 14.0 makes ld warn ("built for newer version 26.0") and the
# result is not guaranteed to run on 14. Building the same release tags from
# source with MACOSX_DEPLOYMENT_TARGET=14.0 removes both problems.
#
#   Vendor/src     shallow clones, one per component, pinned to a release tag
#   Vendor/prefix  install prefix: lib, bin, include, lib/pkgconfig
#
# Both are gitignored. Run this once, then `scripts/vendor.sh`, which copies
# out of Vendor/prefix into Vendor/lib, Vendor/bin and Vendor/include.
#
# A component whose .pc file is already in the prefix is skipped; --force
# rebuilds everything. Apple Silicon only: the app ships arm64.

set -euo pipefail

cd "$(dirname "$0")/.."

MAC_DIR="$PWD"
VENDOR="$MAC_DIR/Vendor"
SRC_DIR="$VENDOR/src"
PREFIX="$VENDOR/prefix"
DEPLOY="14.0"
ARCH="arm64"
BREW="${BREW_PREFIX:-/opt/homebrew}"
JOBS="$(sysctl -n hw.ncpu)"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    *)
      echo "usage: $(basename "$0") [--force]" >&2
      exit 2
      ;;
  esac
done

if [ "$(uname -m)" != "$ARCH" ]; then
  echo "this builds $ARCH only, on $(uname -m) there is nothing to link against" >&2
  exit 1
fi

# <name>:<repo>:<tag>. Release tags matching the Homebrew versions, built in
# dependency order: openssl and libplist stand alone, glue and libusbmuxd need
# libplist, libtatsu needs libplist and the system libcurl, libimobiledevice
# needs all of them plus openssl.
GIT_BASE="https://github.com/libimobiledevice"
COMPONENTS=(
  "openssl:https://github.com/openssl/openssl.git:openssl-3.6.3"
  "libplist:$GIT_BASE/libplist.git:2.7.0"
  "libimobiledevice-glue:$GIT_BASE/libimobiledevice-glue.git:1.3.2"
  "libusbmuxd:$GIT_BASE/libusbmuxd.git:2.1.1"
  "libtatsu:$GIT_BASE/libtatsu.git:1.0.5"
  "libimobiledevice:$GIT_BASE/libimobiledevice.git:1.4.0"
)

# What vendor.sh and project.yml expect to find afterwards.
OUTPUTS=(
  "lib/libimobiledevice-1.0.6.dylib"
  "lib/libimobiledevice-glue-1.0.0.dylib"
  "lib/libusbmuxd-2.0.7.dylib"
  "lib/libplist-2.0.4.dylib"
  "lib/libtatsu.0.dylib"
  "lib/libssl.3.dylib"
  "lib/libcrypto.3.dylib"
  "bin/idevicebackup2"
)

echo "==> check build tools"
needed=()
for formula in autoconf automake libtool pkgconf; do
  [ -d "$BREW/opt/$formula" ] || needed+=("$formula")
done
if [ "${#needed[@]}" -gt 0 ]; then
  echo "    installing ${needed[*]}"
  brew install "${needed[@]}"
fi
# Homebrew's libtool prefixes its commands with g; autoreconf wants the plain
# names, which live in the formula's gnubin.
export PATH="$BREW/opt/libtool/libexec/gnubin:$BREW/opt/pkgconf/bin:$BREW/bin:$PATH"
for tool in autoconf automake libtoolize pkg-config; do
  if ! command -v "$tool" >/dev/null; then
    echo "missing $tool after brew install — check the Homebrew prefix $BREW" >&2
    exit 1
  fi
done

export MACOSX_DEPLOYMENT_TARGET="$DEPLOY"
MIN_FLAGS="-arch $ARCH -mmacosx-version-min=$DEPLOY"
export CFLAGS="$MIN_FLAGS"
export CXXFLAGS="$MIN_FLAGS"
export LDFLAGS="$MIN_FLAGS -L$PREFIX/lib"
export CPPFLAGS="-I$PREFIX/include"
# Only the prefix, so nothing picks up a Homebrew dylib by accident.
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig"
export PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig"

mkdir -p "$SRC_DIR" "$PREFIX/lib/pkgconfig"

# macOS ships libcurl in /usr/lib and its headers in the SDK, but no .pc file,
# and libtatsu's configure asks pkg-config for one. Describe the system copy.
write_libcurl_pc() {
  local pc="$PREFIX/lib/pkgconfig/libcurl.pc"
  local version sdk
  version="$(/usr/bin/curl-config --version 2>/dev/null | awk '{print $2}')"
  sdk="$(xcrun --sdk macosx --show-sdk-path)"
  cat > "$pc" <<EOF
prefix=$sdk/usr
exec_prefix=/usr
libdir=\${exec_prefix}/lib
includedir=\${prefix}/include
Name: libcurl
Description: Library to transfer files with ftp, http, etc.
Version: ${version:-8.0.0}
Libs: -L\${libdir} -lcurl
Cflags:
EOF
}

clone() {
  local name="$1" url="$2" tag="$3" dir="$SRC_DIR/$name"
  if [ -d "$dir/.git" ]; then
    if [ "$(git -C "$dir" describe --tags --exact-match 2>/dev/null || true)" = "$tag" ]; then
      return 0
    fi
    rm -rf "$dir"
  fi
  echo "    clone $name $tag"
  git clone --quiet --depth 1 --branch "$tag" "$url" "$dir"
}

# A component counts as built when its pkg-config file is in the prefix.
built() {
  [ "$FORCE" -eq 0 ] && [ -f "$PREFIX/lib/pkgconfig/$1" ]
}

build_autotools() {
  local name="$1" pc="$2"
  shift 2
  if built "$pc"; then
    echo "==> $name already in Vendor/prefix, skipping (--force rebuilds)"
    return 0
  fi
  echo "==> build $name"
  (
    cd "$SRC_DIR/$name"
    make distclean >/dev/null 2>&1 || true
    ./autogen.sh --prefix="$PREFIX" --disable-static "$@"
    make -j"$JOBS"
    make install
  )
}

build_openssl() {
  if built "openssl.pc"; then
    echo "==> openssl already in Vendor/prefix, skipping (--force rebuilds)"
    return 0
  fi
  echo "==> build openssl (the slow one, a few minutes)"
  (
    cd "$SRC_DIR/openssl"
    # Configure takes the target and the flags itself; the autotools variables
    # would only confuse it.
    unset CFLAGS CXXFLAGS CPPFLAGS LDFLAGS
    make clean >/dev/null 2>&1 || true
    ./Configure "darwin64-$ARCH-cc" shared no-tests no-docs \
      --prefix="$PREFIX" --openssldir="$PREFIX/ssl" \
      "-mmacosx-version-min=$DEPLOY"
    make -j"$JOBS" build_sw
    make install_sw
  )
}

# The minimum OS version a Mach-O was built for, from either load command.
minos() {
  otool -l "$1" | awk '
    $1 == "cmd" && $2 == "LC_BUILD_VERSION" { build = 1; next }
    $1 == "cmd" && $2 == "LC_VERSION_MIN_MACOSX" { vmin = 1; next }
    build && $1 == "minos" { print $2; exit }
    vmin && $1 == "version" { print $2; exit }
  '
}

echo "==> clone sources into Vendor/src"
for entry in "${COMPONENTS[@]}"; do
  name="${entry%%:*}"
  rest="${entry#*:}"
  clone "$name" "${rest%:*}" "${rest##*:}"
done

write_libcurl_pc

build_openssl
build_autotools libplist libplist-2.0.pc --without-cython
build_autotools libimobiledevice-glue libimobiledevice-glue-1.0.pc
build_autotools libusbmuxd libusbmuxd-2.0.pc
build_autotools libtatsu libtatsu-1.0.pc
build_autotools libimobiledevice libimobiledevice-1.0.pc --without-cython

echo
echo "==> minimum OS version of every output"
missing=0
printf '    %-40s %s\n' "file" "minos"
for out in "${OUTPUTS[@]}"; do
  if [ ! -f "$PREFIX/$out" ]; then
    printf '    %-40s %s\n' "$out" "MISSING"
    missing=1
    continue
  fi
  printf '    %-40s %s\n' "$out" "$(minos "$PREFIX/$out")"
done

if [ "$missing" -ne 0 ]; then
  echo
  echo "a file vendor.sh expects is missing — what the build produced:" >&2
  ls "$PREFIX/lib" >&2
  exit 1
fi

echo
echo "✓ built into $PREFIX — run scripts/vendor.sh next"
