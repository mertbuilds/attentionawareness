#!/usr/bin/env bash
# Release build → sign → notarize → staple → dmg → appcast → R2.
#
# The dmg, the appcast Sparkle reads and the latest.json the download page
# reads go to the private R2 bucket named by R2_BUCKET in
# ~/.config/attentionawareness/release.env, under mac/, and the site serves them
# at https://attentionawareness.com/mac/<file>. The dmg goes up first, so a feed
# never points at a file that is not there yet. An upload is live at once: there
# is no site deploy in between.
#
# Sparkle offers an update only when its build number is above every one in the
# published appcast, so the script stops before it builds when the build number
# in project.yml is not (run scripts/bump.sh). The dmg is named
# attention-awareness-<version>-<build>.dmg and the script stops when the site
# already serves that name, because the site serves a dmg as immutable for a
# year.
#
# Two flags for dry runs:
#   --dry-run      do everything but the uploads, and print each upload command
#                  instead.
#   --no-notarize  skip the notary service and stapling. The dmg is signed but
#                  Gatekeeper stops it on any other Mac, so it is only allowed
#                  with --dry-run.
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
#   4. `cf auth login` with the Cloudflare account that holds the bucket. cf is
#      Cloudflare's cf cli, and on a Mac it makes every R2 call here. On the
#      runner curl makes them over S3: see R2_S3_ENDPOINT below.
#   5. Put the bucket name in ~/.config/attentionawareness/release.env (mode
#      600), as R2_BUCKET=<bucket>.
#
# GitHub Actions runs this script too (.github/workflows/mac-release.yml), on a
# runner that has none of that setup, so these can come from the environment.
# With none of them set the script runs as it always has:
#   NOTARY_KEYCHAIN       the keychain that holds the notary profile, when it
#                         is not the login keychain.
#   SPARKLE_ED_KEY_FILE   the Sparkle private key file, when it is not the one
#                         in ~/.config/attentionawareness.
#   R2_BUCKET             the bucket, when release.env is not there.
#   R2_S3_ACCESS_KEY_ID, R2_S3_SECRET_ACCESS_KEY, R2_S3_ENDPOINT
#                         the S3 key pair of an R2 API token for the one bucket
#                         and https://<account id>.r2.cloudflarestorage.com.
#                         With all three set, curl makes every bucket call
#                         with --aws-sigv4 and cf is not needed. The option
#                         is in curl since 7.75; this is tested with 8.7.1,
#                         the curl of macOS. cf cannot use such a token: its
#                         calls go to the Cloudflare REST API, which refuses a
#                         token that is scoped to one bucket.

set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="AttentionAwareness"
APP_NAME="attention awareness"
CONFIG="Release"
TEAM_ID="3HGP3W3TLD"
NOTARY_PROFILE="attentionawareness-notary"
RELEASE_ENV="$HOME/.config/attentionawareness/release.env"
SITE_URL="https://attentionawareness.com/mac"
BUILD_DIR="build/release"
SITE_DIR="$BUILD_DIR/site"

# The notary profile is looked up in the login keychain unless NOTARY_KEYCHAIN
# names another one.
notary_tool() {
  if [ -n "${NOTARY_KEYCHAIN:-}" ]; then
    xcrun notarytool "$@" --keychain "$NOTARY_KEYCHAIN"
  else
    xcrun notarytool "$@"
  fi
}

NOTARIZE=1
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --no-notarize) NOTARIZE=0 ;;
    --dry-run) DRY_RUN=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ "$NOTARIZE" = 0 ] && [ "$DRY_RUN" = 0 ]; then
  echo "error: --no-notarize is only allowed with --dry-run, because an" >&2
  echo "       upload is live at once and Gatekeeper stops a dmg that is not" >&2
  echo "       notarized." >&2
  exit 2
fi

if [ "$NOTARIZE" = 1 ] && ! NOTARY_OUT=$(notary_tool history --keychain-profile "$NOTARY_PROFILE" 2>&1); then
  echo "error: notarytool could not use profile '$NOTARY_PROFILE':" >&2
  printf '%s\n' "$NOTARY_OUT" | sed 's/^/         /' >&2
  echo "       if the profile is missing, create it with:" >&2
  echo "         xcrun notarytool store-credentials $NOTARY_PROFILE \\" >&2
  echo "           --apple-id \"<your-apple-id-email>\" --team-id \"$TEAM_ID\" \\" >&2
  echo "           --password \"<app-specific-password>\"" >&2
  echo "       or run this script with --no-notarize to skip notarization." >&2
  exit 1
fi

# The bucket is reached through cf, or through its S3 endpoint when the key pair
# is in the environment. r2_get and r2_put below are the only two callers.
R2_TRANSPORT=cf
if [ -n "${R2_S3_ACCESS_KEY_ID:-}${R2_S3_SECRET_ACCESS_KEY:-}${R2_S3_ENDPOINT:-}" ]; then
  if [ -z "${R2_S3_ACCESS_KEY_ID:-}" ] || [ -z "${R2_S3_SECRET_ACCESS_KEY:-}" ] || [ -z "${R2_S3_ENDPOINT:-}" ]; then
    echo "error: set all three of R2_S3_ACCESS_KEY_ID, R2_S3_SECRET_ACCESS_KEY and" >&2
    echo "       R2_S3_ENDPOINT, or none of them." >&2
    exit 2
  fi
  # The key pair signs requests to this host, so it is R2's own or nothing.
  if ! [[ "$R2_S3_ENDPOINT" =~ ^https://[0-9a-f]{32}(\.(eu|fedramp))?\.r2\.cloudflarestorage\.com$ ]]; then
    echo "error: R2_S3_ENDPOINT is not https://<account id>.r2.cloudflarestorage.com" >&2
    echo "       (or its .eu or .fedramp form)." >&2
    exit 2
  fi
  R2_TRANSPORT=s3
  # What the bucket answered, kept to show the reason when a request fails.
  S3_BODY=$(mktemp)
  trap 'rm -f "$S3_BODY"' EXIT
fi

# One signed request to the S3 endpoint. It prints the http status and nothing
# else. The key pair goes to curl as a config on stdin, so it is in no argument
# list and no log. curl signs again on every retry. --retry-all-errors is there
# because without it a dropped connection is not tried again; a 4xx never is.
s3_curl() {
  printf 'user = "%s:%s"\n' "$R2_S3_ACCESS_KEY_ID" "$R2_S3_SECRET_ACCESS_KEY" \
    | curl -sS -K - --proto '=https' --aws-sigv4 "aws:amz:auto:s3" \
      --connect-timeout 20 --retry 3 --retry-all-errors -w '%{http_code}' "$@"
}

# The first 500 bytes of the bucket's answer, which name the reason.
s3_reason() {
  if [ -s "$1" ]; then
    head -c 500 "$1" >&2
    echo >&2
  fi
}

# Writes the object to a file. Returns 1 when it could not be read: through cf
# that is any failure, through S3 only a 404, and any other answer stops the
# script.
r2_get() {
  key="$1"
  file="$2"
  if [ "$R2_TRANSPORT" = cf ]; then
    cf r2 objects get "$key" --bucket-name "$R2_BUCKET" > "$file" 2> /dev/null
    return
  fi
  body="$file"
  if [ "$file" = /dev/null ]; then
    body="$S3_BODY"
  fi
  : > "$body"
  STATUS=$(s3_curl -o "$body" "$R2_S3_ENDPOINT/$R2_BUCKET/$key") || STATUS="no response"
  case "$STATUS" in
    200) return 0 ;;
    404) return 1 ;;
    *)
      echo "error: could not read $key from the bucket over S3 ($STATUS)." >&2
      s3_reason "$body"
      exit 1
      ;;
  esac
}

if [ "$DRY_RUN" = 0 ] && [ "$R2_TRANSPORT" = cf ]; then
  if ! command -v cf > /dev/null 2>&1; then
    echo "error: Cloudflare's cf cli is not installed, so the release cannot be" >&2
    echo "       uploaded. install it, or run this script with --dry-run." >&2
    exit 1
  fi
  # whoami exits 0 when nobody is logged in, so its answer is what is checked.
  echo "==> cloudflare login"
  WHOAMI=$(cf auth whoami 2>&1) || true
  if ! grep -q '"authenticated": true' <<< "$WHOAMI" || grep -q '"tokenValid": false' <<< "$WHOAMI"; then
    printf '%s\n' "$WHOAMI" >&2
    echo "error: cf is not logged in, so the release cannot reach the bucket." >&2
    echo "       run cf auth login, or run this script with --dry-run." >&2
    exit 1
  fi
  grep -E '"(authSource|email)":' <<< "$WHOAMI" || true
fi

# The dmg is written by dmgbuild, long after the build and the notary service.
DMGBUILD="${DMGBUILD:-$(command -v dmgbuild || ls "$HOME"/Library/Python/*/bin/dmgbuild 2>/dev/null | sort -V | tail -1)}"
if [ -z "$DMGBUILD" ] || [ ! -x "$DMGBUILD" ]; then
  echo "error: dmgbuild is not installed, so the dmg cannot be written." >&2
  echo "       install it with: pip3 install --user dmgbuild" >&2
  echo "       or point DMGBUILD at it." >&2
  exit 1
fi

if [ -f "$RELEASE_ENV" ]; then
  . "$RELEASE_ENV"
fi
if [ -z "${R2_BUCKET:-}" ]; then
  echo "error: R2_BUCKET is not set. Put the bucket the site serves /mac/ from" >&2
  echo "       in $RELEASE_ENV (mode 600):" >&2
  echo "         R2_BUCKET=<bucket>" >&2
  exit 1
fi

# The key pair has to read the bucket before anything is built or notarized.
if [ "$DRY_RUN" = 0 ] && [ "$R2_TRANSPORT" = s3 ]; then
  echo "==> check that the S3 key pair reaches the bucket"
  if ! r2_get mac/latest.json /dev/null; then
    echo "error: the bucket has no mac/latest.json (404 over S3), so the release" >&2
    echo "       was not started. check R2_S3_ENDPOINT and R2_BUCKET." >&2
    exit 1
  fi
fi

echo "==> clean build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# The published appcast is the input, so older versions keep their entry in the
# feed instead of being dropped on every release. The bucket is read first,
# since it is what the site serves; the public URL is the fallback for a bucket
# this login cannot read or that holds no feed yet. Only a 404 there starts a
# new feed: any other failure stops the release rather than lose the history.
echo "==> fetch the published appcast"
PUBLISHED_APPCAST="$BUILD_DIR/appcast.published.xml"
if r2_get mac/appcast.xml "$PUBLISHED_APPCAST" \
  && [ -s "$PUBLISHED_APPCAST" ]; then
  echo "    from r2: $R2_BUCKET/mac/appcast.xml"
else
  STATUS=$(curl -sS -o "$PUBLISHED_APPCAST" -w '%{http_code}' "$SITE_URL/appcast.xml") || STATUS="no response"
  case "$STATUS" in
    200) echo "    from $SITE_URL/appcast.xml" ;;
    404)
      rm -f "$PUBLISHED_APPCAST"
      echo "    none published yet, the feed starts with this release"
      ;;
    *)
      echo "error: could not read $SITE_URL/appcast.xml ($STATUS)." >&2
      echo "       without it every older version would drop out of the feed." >&2
      exit 1
      ;;
  esac
fi
PUBLISHED_BUILD=0
if [ -f "$PUBLISHED_APPCAST" ]; then
  if ! grep -q '<rss' "$PUBLISHED_APPCAST"; then
    echo "error: the published appcast is not an rss feed: $PUBLISHED_APPCAST" >&2
    exit 1
  fi
  PUBLISHED_BUILD=$(grep -oE '<sparkle:version>[0-9]+</sparkle:version>' "$PUBLISHED_APPCAST" \
    | grep -oE '[0-9]+' | sort -n | tail -1 || true)
  PUBLISHED_BUILD="${PUBLISHED_BUILD:-0}"
fi
echo "    highest published build: $PUBLISHED_BUILD"

dmg_name() {
  echo "attention-awareness-$1-$2.dmg"
}

# The name a person should get on disk: the version alone. The build number in
# the stored name is only there to keep every url new, and next to the version
# it reads like a second version. `cf r2 objects put` cannot store a
# Content-Disposition and the S3 upload sends none, so the name travels in latest.json as `filename` and the
# download link on the site hands it to the browser.
download_name() {
  echo "attention-awareness-$1.dmg"
}

# Sparkle compares CFBundleVersion, so an item whose build number is not above
# every published one is never offered. The site serves a dmg as immutable for
# a year, so a name it has served once is never uploaded again.
check_new_release() {
  version="$1"
  build="$2"
  if ! printf '%s' "$build" | grep -qE '^[0-9]+$'; then
    echo "error: build number '$build' is not a whole number" >&2
    exit 1
  fi
  if [ "$build" -le "$PUBLISHED_BUILD" ]; then
    echo "error: build $build is not above build $PUBLISHED_BUILD in the published" >&2
    echo "       appcast, so Sparkle would never offer it. run" >&2
    echo "         bash scripts/bump.sh <marketing-version>" >&2
    exit 1
  fi
  url="$SITE_URL/$(dmg_name "$version" "$build")"
  if curl -sfI "$url" > /dev/null; then
    echo "error: the site already serves $url" >&2
    echo "       and caches a dmg for a year. run" >&2
    echo "         bash scripts/bump.sh <marketing-version>" >&2
    exit 1
  fi
}

read_key() {
  grep -E "^ *$1: " project.yml | sed -E "s/^ *$1: *'?([^']*)'?.*$/\1/"
}

echo "==> check the build number"
check_new_release "$(read_key MARKETING_VERSION)" "$(read_key CURRENT_PROJECT_VERSION)"

echo "==> vendor libimobiledevice"
# A no-op once Vendor/prefix is there, and the only thing that keeps a release
# off the Homebrew fallback, which would ship dylibs built for the newest macOS.
bash scripts/build-libimobiledevice.sh
bash scripts/vendor.sh

# Regenerate project.pbxproj from project.yml so any config drift is reset.
xcodegen generate > /dev/null

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

VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist")
BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Contents/Info.plist")
echo "==> check the built app's build number"
check_new_release "$VERSION" "$BUILD"
DMG_NAME=$(dmg_name "$VERSION" "$BUILD")
DMG_URL="$SITE_URL/$DMG_NAME"
RELEASE_ZIP="$BUILD_DIR/attention-awareness-$VERSION-$BUILD.zip"

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
ED_KEY_FILE="${SPARKLE_ED_KEY_FILE:-$HOME/.config/attentionawareness/sparkle-ed25519.key}"
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
  notary_tool submit "$SUBMIT_ZIP" \
    --keychain-profile "$NOTARY_PROFILE" \
    --wait

  echo "==> staple notarization ticket"
  xcrun stapler staple "$APP"
  xcrun stapler validate "$APP"
else
  echo "==> skip notarization (--no-notarize)"
fi

echo "==> create release zip"
/usr/bin/ditto -c -k --keepParent "$APP" "$RELEASE_ZIP"

# Custom drag-to-Applications dmg via dmgbuild, using the background art in
# scripts/. dmgbuild writes the icon layout and background straight into the
# volume's .DS_Store (no Finder/AppleScript dance), so the install window looks
# right even on a build host that has not granted Automation permissions.
echo "==> build dmg (drag-to-applications)"
RELEASE_DMG="$BUILD_DIR/$DMG_NAME"

# Stage the notarized app into a dist copy so dmgbuild reads a clean bundle
# named exactly the volume name. cp -R keeps the signature and stapled ticket.
DIST_APP="$BUILD_DIR/dmg/${APP_NAME}.app"
rm -rf "$DIST_APP"
mkdir -p "$(dirname "$DIST_APP")"
cp -R "$APP" "$DIST_APP"

rm -f "$RELEASE_DMG"
DMG_APP_PATH="$(pwd)/$DIST_APP" \
DMG_BACKGROUND="$(pwd)/scripts/dmg-background.png" \
  "$DMGBUILD" \
  -s scripts/dmg-settings.py \
  "$APP_NAME" \
  "$RELEASE_DMG"

echo "==> sign dmg"
codesign --sign "Developer ID Application: Mert Duzgun (${TEAM_ID})" --timestamp "$RELEASE_DMG"

if [ "$NOTARIZE" = 1 ]; then
  echo "==> notarize dmg"
  notary_tool submit "$RELEASE_DMG" \
    --keychain-profile "$NOTARY_PROFILE" \
    --wait

  echo "==> staple dmg"
  xcrun stapler staple "$RELEASE_DMG"
  xcrun stapler validate "$RELEASE_DMG"
fi

# Everything a release is made of is staged here: the dmg the site serves, the
# notes that go into the update window, the appcast Sparkle reads and the small
# json the download page reads.
echo "==> stage release folder"
rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR"
cp "$RELEASE_DMG" "$SITE_DIR/"
SITE_DMG="$SITE_DIR/$DMG_NAME"

DMG_SIZE=$(/usr/bin/stat -f%z "$SITE_DMG")
DMG_SHA=$(/usr/bin/shasum -a 256 "$SITE_DMG" | cut -d' ' -f1)
RELEASE_DATE=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

if [ -f "$PUBLISHED_APPCAST" ]; then
  cp "$PUBLISHED_APPCAST" "$SITE_DIR/appcast.xml"
fi

# Named after the dmg, which is how generate_appcast finds the notes for this
# item and embeds them in the feed. Write release-notes/<version>.md to say
# something better than the default.
NOTES="$SITE_DIR/${DMG_NAME%.dmg}.md"
if [ -f "release-notes/$VERSION.md" ]; then
  cp "release-notes/$VERSION.md" "$NOTES"
else
  cat > "$NOTES" <<NOTESFILE
attention awareness $VERSION for Mac, build $BUILD.

Download the dmg, drag the app to Applications and open it.
NOTESFILE
fi

echo "==> sign dmg for sparkle"
ED_SIGNATURE=$(sparkle_tool sign_update -p "$SITE_DMG")

# The notes are embedded in the feed rather than linked, so the site has one
# file less to serve and Sparkle's update window never waits on a second fetch.
# --maximum-versions 0 keeps every older item instead of the newest three.
echo "==> generate appcast"
sparkle_tool generate_appcast \
  --download-url-prefix "$SITE_URL/" \
  --embed-release-notes \
  --maximum-versions 0 \
  "$SITE_DIR"

# generate_appcast only warns when the key does not match SUPublicEDKey, and
# then writes the item unsigned, which every shipped copy of the app refuses.
# The item for this dmg has to carry the signature of this dmg.
if ! grep -F "sparkle:edSignature=\"$ED_SIGNATURE\"" "$SITE_DIR/appcast.xml" | grep -qF "url=\"$DMG_URL\""; then
  echo "error: the appcast item for $DMG_URL does not carry this dmg's EdDSA" >&2
  echo "       signature." >&2
  exit 1
fi

echo "==> write latest.json"
cat > "$SITE_DIR/latest.json" <<JSON
{
  "version": "$VERSION",
  "build": "$BUILD",
  "url": "$DMG_URL",
  "filename": "$(download_name "$VERSION")",
  "size": $DMG_SIZE,
  "sha256": "$DMG_SHA",
  "date": "$RELEASE_DATE"
}
JSON

r2_put() {
  key="$1"
  file="$2"
  type="$3"
  if [ "$R2_TRANSPORT" = cf ]; then
    if [ "$DRY_RUN" = 1 ]; then
      echo "    would run: cf r2 objects put $key --bucket-name $R2_BUCKET --file \"$file\" --content-type $type"
    else
      echo "    $R2_BUCKET/$key"
      cf r2 objects put "$key" --bucket-name "$R2_BUCKET" --file "$file" --content-type "$type"
    fi
    return
  fi
  url="$R2_S3_ENDPOINT/$R2_BUCKET/$key"
  if [ "$DRY_RUN" = 1 ]; then
    echo "    would run: curl --aws-sigv4 aws:amz:auto:s3 --upload-file \"$file\" -H \"Content-Type: $type\" $url"
    return
  fi
  echo "    $R2_BUCKET/$key"
  # The Content-Type is all that is stored beside the object, as with cf. The
  # hash goes into the signature, so the bucket refuses any other bytes.
  sha=$(/usr/bin/shasum -a 256 "$file" | cut -d' ' -f1)
  : > "$S3_BODY"
  STATUS=$(s3_curl -o "$S3_BODY" --upload-file "$file" -H "Content-Type: $type" \
    -H "x-amz-content-sha256: $sha" "$url") || STATUS="no response"
  case "$STATUS" in
    2??) ;;
    *)
      echo "error: could not upload $key to the bucket over S3 ($STATUS)." >&2
      s3_reason "$S3_BODY"
      exit 1
      ;;
  esac
}

# The dmg goes up first and the feed last, so neither small file ever points at
# a download that is not there yet. Each upload is live at once.
if [ "$DRY_RUN" = 1 ]; then
  echo "==> skip upload to r2 (--dry-run)"
else
  echo "==> upload to r2"
fi
r2_put "mac/$DMG_NAME" "$SITE_DMG" "application/x-apple-diskimage"
r2_put "mac/latest.json" "$SITE_DIR/latest.json" "application/json"
r2_put "mac/appcast.xml" "$SITE_DIR/appcast.xml" "application/xml"

echo ""
echo "✓ release artifacts:"
echo "  zip: $RELEASE_ZIP"
echo "  dmg: $SITE_DMG"
echo "  notes: $NOTES"
echo "  appcast: $SITE_DIR/appcast.xml"
echo "  latest: $SITE_DIR/latest.json"
echo ""
echo "  version: $VERSION (build $BUILD)"
echo "  dmg size: $DMG_SIZE bytes"
echo "  dmg sha256: $DMG_SHA"
echo "  sparkle signature: $ED_SIGNATURE"
echo "  download url: $DMG_URL"
echo "  signed by: $(codesign -dvv "$APP" 2>&1 | grep 'Authority=' | head -1)"
if [ "$NOTARIZE" = 1 ]; then
  echo "  notarized app: $(xcrun stapler validate "$APP" 2>&1 | tail -1)"
  echo "  notarized dmg: $(xcrun stapler validate "$SITE_DMG" 2>&1 | tail -1)"
else
  echo "  notarized: no (--no-notarize)"
fi
echo "  gatekeeper: $(spctl -a -t exec -vvv "$APP" 2>&1 | tail -1)"
if [ "$DRY_RUN" = 1 ]; then
  echo ""
  echo "  nothing was uploaded (--dry-run), so the site still serves the release"
  echo "  before this one."
fi
