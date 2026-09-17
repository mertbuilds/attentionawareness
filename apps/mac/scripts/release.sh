#!/usr/bin/env bash
# Release build → sign → notarize → staple → dmg.
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

set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="AttentionAwareness"
APP_NAME="Attention Awareness"
CONFIG="Release"
TEAM_ID="3HGP3W3TLD"
NOTARY_PROFILE="attentionawareness-notary"
BUILD_DIR="build/release"

echo "==> vendor libimobiledevice"
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

echo "==> verify signature"
codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | tail -3

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

VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist")
BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Contents/Info.plist")
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

echo "==> notarize dmg"
xcrun notarytool submit "$RELEASE_DMG" \
  --keychain-profile "$NOTARY_PROFILE" \
  --wait

echo "==> staple dmg"
xcrun stapler staple "$RELEASE_DMG"
xcrun stapler validate "$RELEASE_DMG"

echo ""
echo "✓ release artifacts:"
echo "  zip: $RELEASE_ZIP"
echo "  dmg: $RELEASE_DMG"
echo ""
echo "  signed by: $(codesign -dvv "$APP" 2>&1 | grep 'Authority=' | head -1)"
echo "  notarized app: $(xcrun stapler validate "$APP" 2>&1 | tail -1)"
echo "  notarized dmg: $(xcrun stapler validate "$RELEASE_DMG" 2>&1 | tail -1)"
echo "  gatekeeper: $(spctl -a -t exec -vvv "$APP" 2>&1 | tail -1)"
