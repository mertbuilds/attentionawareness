#!/usr/bin/env bash
# Release build → sign → notarize → staple → dmg → github release → appcast.
#
# The dmg is served from GitHub Releases, because the site deploys from git and
# a dmg does not belong in the repository. Only the two small files Sparkle and
# the download page read, appcast.xml and latest.json, land in
# apps/web/public/mac/ and are committed with the site.
#
# Two flags for dry runs:
#   --no-notarize  skip the notary service and stapling. The dmg is signed but
#                  Gatekeeper stops it on any other Mac, so never publish it.
#   --no-publish   skip `gh release create`, and print the command instead.
#
# One-time setup before first run:
#   1. In Xcode → Settings → Accounts → your account → Manage Certificates,
#      click + → "Developer ID Application". This installs the cert in your
#      login keychain so xcodebuild can find it.
#   2. Store notarization credentials once via:
#        xcrun notarytool store-credentials attentionawareness-notary \
#          --apple-id "<your-apple-id-email>" \
#          --team-id "3HGP3W3TLD" \
#          --password "<app-specific-password>"
#      Generate the app-specific password at appleid.apple.com → Sign-in
#      & Security → App-Specific Passwords.
#   3. The Sparkle EdDSA private key is in ~/.config/attentionawareness/
#      sparkle-ed25519.key, with a second copy in the login keychain. Its
#      public half is SUPublicEDKey in project.yml. Without the key
#      generate_appcast cannot sign an update and no shipped copy of the app
#      will accept one.

set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="AttentionAwareness"
APP_NAME="Attention Awareness"
CONFIG="Release"
TEAM_ID="3HGP3W3TLD"
NOTARY_PROFILE="attentionawareness-notary"
GH_REPO="mertbuilds/attentionawareness"
BUILD_DIR="build/release"
SITE_DIR="$BUILD_DIR/site"
WEB_DIR="../web/public/mac"

NOTARIZE=1
PUBLISH=1
for arg in "$@"; do
  case "$arg" in
    --no-notarize) NOTARIZE=0 ;;
    --no-publish) PUBLISH=0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ "$NOTARIZE" = 1 ] && ! xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" > /dev/null 2>&1; then
  echo "error: no notary keychain profile '$NOTARY_PROFILE'." >&2
  echo "       create it with:" >&2
  echo "         xcrun notarytool store-credentials $NOTARY_PROFILE \\" >&2
  echo "           --apple-id \"<your-apple-id-email>\" --team-id \"$TEAM_ID\" \\" >&2
  echo "           --password \"<app-specific-password>\"" >&2
  echo "       or run this script with --no-notarize to skip notarization." >&2
  exit 1
fi

if [ "$PUBLISH" = 1 ] && ! command -v gh > /dev/null 2>&1; then
  echo "error: gh is not installed, so the dmg cannot be uploaded." >&2
  echo "       brew install gh, or run this script with --no-publish." >&2
  exit 1
fi

echo "==> vendor libimobiledevice"
# A no-op once Vendor/prefix is there, and the only thing that keeps a release
# off the Homebrew fallback, which would ship dylibs built for the newest macOS.
bash scripts/build-libimobiledevice.sh
bash scripts/vendor.sh

# Regenerate project.pbxproj from project.yml so any config drift is reset.
xcodegen generate > /dev/null

echo "==> clean build"
rm -rf "$BUILD_DIR"

echo "==> xcodebuild ($CONFIG)"
xcodebuild \
  -project "${PROJECT}.xcodeproj" \
  -scheme "${PROJECT}" \
  -configuration "$CONFIG" \
  -destination "generic/platform=macOS" \
  -derivedDataPath "$BUILD_DIR" \
  -quiet \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Developer ID Application" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO \
  OTHER_CODE_SIGN_FLAGS="--timestamp --options runtime"

APP="$BUILD_DIR/Build/Products/$CONFIG/${APP_NAME}.app"

# Sparkle's command line tools come down with the Swift package, so they always
# match the framework inside the app.
SPARKLE_BIN="$BUILD_DIR/SourcePackages/artifacts/sparkle/Sparkle/bin"
if [ ! -x "$SPARKLE_BIN/sign_update" ] || [ ! -x "$SPARKLE_BIN/generate_appcast" ]; then
  echo "error: Sparkle tools are missing from $SPARKLE_BIN" >&2
  exit 1
fi

# Sign from the exported key rather than the login keychain: reading the key out
# of the keychain opens a dialog and waits for a person, and a release script
# has to be able to finish on its own. The keychain still holds the same key.
ED_KEY_FILE="$HOME/.config/attentionawareness/sparkle-ed25519.key"
sparkle_tool() {
  tool="$1"
  shift
  if [ -f "$ED_KEY_FILE" ]; then
    "$SPARKLE_BIN/$tool" --ed-key-file "$ED_KEY_FILE" "$@"
  else
    "$SPARKLE_BIN/$tool" "$@"
  fi
}

echo "==> verify signature"
codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | tail -3

if [ "$NOTARIZE" = 1 ]; then
  echo "==> zip for notarization"
  SUBMIT_ZIP="$BUILD_DIR/attention-awareness-submit.zip"
  /usr/bin/ditto -c -k --keepParent "$APP" "$SUBMIT_ZIP"

  echo "==> submit to apple notary service (waits up to 30 min)"
  xcrun notarytool submit "$SUBMIT_ZIP" \
    --keychain-profile "$NOTARY_PROFILE" \
    --wait

  echo "==> staple notarization ticket"
  xcrun stapler staple "$APP"
  xcrun stapler validate "$APP"
else
  echo "==> skip notarization (--no-notarize)"
fi

VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist")
BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Contents/Info.plist")
TAG="mac-v$VERSION"
DOWNLOAD_PREFIX="https://github.com/$GH_REPO/releases/download/$TAG/"
RELEASE_ZIP="$BUILD_DIR/Attention-Awareness-$VERSION-$BUILD.zip"

echo "==> create release zip"
/usr/bin/ditto -c -k --keepParent "$APP" "$RELEASE_ZIP"

# Plain drag-to-Applications dmg via hdiutil. caffeinagent uses dmgbuild for a
# custom background; swap this out once there is background art to place.
echo "==> build dmg (drag-to-applications)"
RELEASE_DMG="$BUILD_DIR/Attention-Awareness-$VERSION.dmg"
DMG_STAGE="$BUILD_DIR/dmg"
rm -rf "$DMG_STAGE" "$RELEASE_DMG"
mkdir -p "$DMG_STAGE"
cp -R "$APP" "$DMG_STAGE/"
ln -s /Applications "$DMG_STAGE/Applications"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$DMG_STAGE" \
  -ov \
  -format UDZO \
  "$RELEASE_DMG" > /dev/null

echo "==> sign dmg"
codesign --sign "Developer ID Application: Mert Duzgun (${TEAM_ID})" --timestamp "$RELEASE_DMG"

if [ "$NOTARIZE" = 1 ]; then
  echo "==> notarize dmg"
  xcrun notarytool submit "$RELEASE_DMG" \
    --keychain-profile "$NOTARY_PROFILE" \
    --wait

  echo "==> staple dmg"
  xcrun stapler staple "$RELEASE_DMG"
  xcrun stapler validate "$RELEASE_DMG"
fi

# Everything a release is made of is staged here: the dmg GitHub serves, the
# notes that go on the release and into the update window, the appcast Sparkle
# reads and the small json the download page reads.
echo "==> stage release folder"
rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR"
cp "$RELEASE_DMG" "$SITE_DIR/"
SITE_DMG="$SITE_DIR/Attention-Awareness-$VERSION.dmg"

# The published appcast is the input, so older versions keep their entry in the
# feed instead of being dropped on every release.
if [ -f "$WEB_DIR/appcast.xml" ]; then
  cp "$WEB_DIR/appcast.xml" "$SITE_DIR/appcast.xml"
fi

# Named after the dmg, which is how generate_appcast finds the notes for this
# item and embeds them in the feed. Write release-notes/<version>.md to say
# something better than the default.
NOTES="$SITE_DIR/Attention-Awareness-$VERSION.md"
if [ -f "release-notes/$VERSION.md" ]; then
  cp "release-notes/$VERSION.md" "$NOTES"
else
  cat > "$NOTES" <<NOTESFILE
Attention Awareness $VERSION for Mac, build $BUILD.

Download the dmg, drag the app to Applications and open it.
NOTESFILE
fi

if [ "$PUBLISH" = 1 ]; then
  echo "==> create github release $TAG"
  gh release create "$TAG" "$SITE_DMG" \
    --repo "$GH_REPO" \
    --title "$APP_NAME for Mac $VERSION" \
    --notes-file "$NOTES"
else
  echo "==> skip github release (--no-publish)"
fi

echo "==> sign dmg for sparkle"
ED_SIGNATURE=$(sparkle_tool sign_update -p "$SITE_DMG")

# The notes are embedded in the feed rather than linked, so the site has one
# file less to serve and Sparkle's update window never waits on a second fetch.
echo "==> generate appcast"
sparkle_tool generate_appcast \
  --download-url-prefix "$DOWNLOAD_PREFIX" \
  --embed-release-notes \
  "$SITE_DIR"

DMG_SIZE=$(/usr/bin/stat -f%z "$SITE_DMG")
DMG_SHA=$(/usr/bin/shasum -a 256 "$SITE_DMG" | cut -d' ' -f1)
RELEASE_DATE=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

echo "==> write latest.json"
cat > "$SITE_DIR/latest.json" <<JSON
{
  "version": "$VERSION",
  "build": "$BUILD",
  "url": "${DOWNLOAD_PREFIX}Attention-Awareness-$VERSION.dmg",
  "size": $DMG_SIZE,
  "sha256": "$DMG_SHA",
  "date": "$RELEASE_DATE"
}
JSON

# These two are committed with the site, so the next deploy points Sparkle and
# the download page at the release that was just made.
echo "==> copy into apps/web/public/mac"
mkdir -p "$WEB_DIR"
cp "$SITE_DIR/appcast.xml" "$SITE_DIR/latest.json" "$WEB_DIR/"

echo ""
echo "✓ release artifacts:"
echo "  zip: $RELEASE_ZIP"
echo "  dmg: $SITE_DMG"
echo "  notes: $NOTES"
echo "  appcast: $SITE_DIR/appcast.xml"
echo "  latest: $SITE_DIR/latest.json"
echo "  site copies: $(cd "$WEB_DIR" && pwd)/appcast.xml"
echo "               $(cd "$WEB_DIR" && pwd)/latest.json"
echo ""
echo "  version: $VERSION (build $BUILD), tag $TAG"
echo "  dmg size: $DMG_SIZE bytes"
echo "  dmg sha256: $DMG_SHA"
echo "  sparkle signature: $ED_SIGNATURE"
echo "  download url: ${DOWNLOAD_PREFIX}Attention-Awareness-$VERSION.dmg"
echo "  signed by: $(codesign -dvv "$APP" 2>&1 | grep 'Authority=' | head -1)"
if [ "$NOTARIZE" = 1 ]; then
  echo "  notarized app: $(xcrun stapler validate "$APP" 2>&1 | tail -1)"
  echo "  notarized dmg: $(xcrun stapler validate "$SITE_DMG" 2>&1 | tail -1)"
else
  echo "  notarized: no (--no-notarize)"
fi
echo "  gatekeeper: $(spctl -a -t exec -vvv "$APP" 2>&1 | tail -1)"
if [ "$PUBLISH" = 0 ]; then
  echo ""
  echo "  the dmg is not published, so the appcast and latest.json point at a"
  echo "  download that does not exist yet. Do not deploy the site until:"
  echo "    gh release create $TAG \"$SITE_DMG\" \\"
  echo "      --repo $GH_REPO \\"
  echo "      --title \"$APP_NAME for Mac $VERSION\" \\"
  echo "      --notes-file \"$NOTES\""
fi
