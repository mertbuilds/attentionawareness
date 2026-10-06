#!/usr/bin/env bash
# Say whether this commit asks for a release: the build number in project.yml
# against the one the site has published.
#
#   bash scripts/release-request.sh [--require-newer]
#
# The workflow mac-release.yml runs it, in a job that holds no secret, before
# the job that waits for the owner's approval. It needs curl and jq, signs
# nothing and uploads nothing.
#
# It prints what it decided and, on a runner, writes to $GITHUB_OUTPUT:
#   version, build   from project.yml
#   newer            true when build is above the published build
#   should_release   true when newer and the event is a push to main
#   decision         the printed line
# With --require-newer it also ends with status 1 when build is not above the
# published build.
#
# A published file that cannot be read or is not one JSON object, a version
# that is not like 1.2.3 or a build number that is not a whole number of at
# most 9 digits stops the script: it never guesses. Every value is tested as a
# whole string before it is compared or written anywhere, because
# $GITHUB_OUTPUT is read line by line and the published file comes from the
# network.
#
# For a test, PROJECT_YML names another project.yml and LATEST_JSON_FILE a
# file that is read in place of the published one.

set -euo pipefail

cd "$(dirname "$0")/.."

LATEST_JSON_URL="https://attentionawareness.com/mac/latest.json"
PROJECT_YML="${PROJECT_YML:-project.yml}"

REQUIRE_NEWER=0
for arg in "$@"; do
  case "$arg" in
    --require-newer) REQUIRE_NEWER=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

is_version() {
  [[ "$1" =~ ^[0-9]{1,9}(\.[0-9]{1,9}){0,2}$ ]]
}

# 9 digits at most: a longer number can pass the limit of shell arithmetic,
# which then wraps without an error.
is_build() {
  [[ "$1" =~ ^[0-9]{1,9}$ ]]
}

read_key() {
  if [ "$(grep -cE "^ *$1: " "$PROJECT_YML" || true)" != "1" ]; then
    echo "error: $PROJECT_YML does not hold exactly one $1" >&2
    exit 1
  fi
  grep -E "^ *$1: " "$PROJECT_YML" | sed -E "s/^ *$1: *'?([^']*)'?.*$/\1/"
}

VERSION=$(read_key MARKETING_VERSION)
BUILD=$(read_key CURRENT_PROJECT_VERSION)

if ! is_version "$VERSION"; then
  echo "error: MARKETING_VERSION in $PROJECT_YML is not a version like 1.2.3" >&2
  exit 1
fi
if ! is_build "$BUILD"; then
  echo "error: CURRENT_PROJECT_VERSION in $PROJECT_YML is not a whole number of at most 9 digits" >&2
  exit 1
fi

if [ -n "${LATEST_JSON_FILE:-}" ]; then
  SOURCE="$LATEST_JSON_FILE"
  if ! LATEST=$(cat "$LATEST_JSON_FILE"); then
    echo "error: could not read $SOURCE, so nothing was decided" >&2
    exit 1
  fi
else
  SOURCE="$LATEST_JSON_URL"
  # https only, and no redirect is followed.
  if ! LATEST=$(curl -fsS --proto '=https' --proto-redir '=https' --retry 3 --max-time 30 "$LATEST_JSON_URL"); then
    echo "error: could not read $SOURCE, so nothing was decided" >&2
    exit 1
  fi
fi

# Exactly one JSON object, and its build a string or a number.
if ! PUBLISHED=$(printf '%s' "$LATEST" | jq -es '
    if length == 1 and (.[0] | type) == "object" then .[0] else error("not one object") end
    | if (.build | type) == "string" or (.build | type) == "number" then . else error("no build") end
  ' 2> /dev/null); then
  echo "error: $SOURCE is not one JSON object with a build, so nothing was decided" >&2
  exit 1
fi
PUBLISHED_BUILD=$(printf '%s' "$PUBLISHED" | jq -r '.build | tostring')
if ! is_build "$PUBLISHED_BUILD"; then
  echo "error: the build in $SOURCE is not a whole number of at most 9 digits, so nothing was decided" >&2
  exit 1
fi
# Only shown, never compared.
PUBLISHED_VERSION=$(printf '%s' "$PUBLISHED" | jq -r '.version | tostring')
if ! is_version "$PUBLISHED_VERSION"; then
  PUBLISHED_VERSION=unknown
fi

# 10# keeps a number with a leading zero from being read as octal. Both are
# plain assignments, so an error in the arithmetic ends the script.
BUILD_NUMBER=$((10#$BUILD))
PUBLISHED_NUMBER=$((10#$PUBLISHED_BUILD))

NEWER=false
if [ "$BUILD_NUMBER" -gt "$PUBLISHED_NUMBER" ]; then
  NEWER=true
fi

SHOULD_RELEASE=false
if [ "$NEWER" = false ]; then
  DECISION="no release: $VERSION (build $BUILD) is not above the published $PUBLISHED_VERSION (build $PUBLISHED_BUILD)"
elif [ "${GITHUB_EVENT_NAME:-}" = "push" ] && [ "${GITHUB_REF:-}" = "refs/heads/main" ]; then
  SHOULD_RELEASE=true
  DECISION="release request: $VERSION (build $BUILD) is above the published $PUBLISHED_VERSION (build $PUBLISHED_BUILD), on a push to main"
else
  DECISION="no release request: $VERSION (build $BUILD) is above the published $PUBLISHED_VERSION (build $PUBLISHED_BUILD), but this is not a push to main"
fi

echo "$DECISION"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "version=$VERSION"
    echo "build=$BUILD"
    echo "newer=$NEWER"
    echo "should_release=$SHOULD_RELEASE"
    echo "decision=$DECISION"
  } >> "$GITHUB_OUTPUT"
fi

if [ "$REQUIRE_NEWER" = 1 ] && [ "$NEWER" = false ]; then
  echo "error: the build number in $PROJECT_YML is not above the published one, so there is nothing to release" >&2
  exit 1
fi
