#!/usr/bin/env bash
# Say whether this commit asks for a release: the build number in project.yml
# against the one the site has published.
#
#   bash scripts/release-request.sh
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
# A published file that cannot be read, or a build number that is not a whole
# number, stops the script: it never guesses.
#
# For a test, LATEST_JSON_URL and PROJECT_YML name another file each.

set -euo pipefail

cd "$(dirname "$0")/.."

LATEST_JSON_URL="${LATEST_JSON_URL:-https://attentionawareness.com/mac/latest.json}"
PROJECT_YML="${PROJECT_YML:-project.yml}"

read_key() {
  if [ "$(grep -cE "^ *$1: " "$PROJECT_YML" || true)" != "1" ]; then
    echo "error: $PROJECT_YML does not hold exactly one $1" >&2
    exit 1
  fi
  grep -E "^ *$1: " "$PROJECT_YML" | sed -E "s/^ *$1: *'?([^']*)'?.*$/\1/"
}

VERSION=$(read_key MARKETING_VERSION)
BUILD=$(read_key CURRENT_PROJECT_VERSION)

if ! printf '%s' "$VERSION" | grep -qE '^[0-9]+(\.[0-9]+){0,2}$'; then
  echo "error: MARKETING_VERSION '$VERSION' is not a version like 1.2.3" >&2
  exit 1
fi
if ! printf '%s' "$BUILD" | grep -qE '^[0-9]+$'; then
  echo "error: CURRENT_PROJECT_VERSION '$BUILD' is not a whole number" >&2
  exit 1
fi

if ! LATEST=$(curl -fsSL --retry 3 --max-time 30 "$LATEST_JSON_URL"); then
  echo "error: could not read $LATEST_JSON_URL, so nothing was decided" >&2
  exit 1
fi
if ! PUBLISHED_BUILD=$(printf '%s' "$LATEST" | jq -er '.build | tostring') \
  || ! printf '%s' "$PUBLISHED_BUILD" | grep -qE '^[0-9]+$'; then
  echo "error: $LATEST_JSON_URL holds no build that is a whole number, so nothing was decided" >&2
  exit 1
fi
PUBLISHED_VERSION=$(printf '%s' "$LATEST" | jq -r '.version | tostring')

# 10# keeps a number with a leading zero from being read as octal.
NEWER=false
if [ "$((10#$BUILD))" -gt "$((10#$PUBLISHED_BUILD))" ]; then
  NEWER=true
fi

SHOULD_RELEASE=false
if [ "$NEWER" = false ]; then
  DECISION="no release: $VERSION (build $BUILD) is not above the published $PUBLISHED_VERSION (build $PUBLISHED_BUILD)"
elif [ "${GITHUB_EVENT_NAME:-}" = "push" ] && [ "${GITHUB_REF:-}" = "refs/heads/main" ]; then
  SHOULD_RELEASE=true
  DECISION="release request: $VERSION (build $BUILD) is above the published $PUBLISHED_VERSION (build $PUBLISHED_BUILD), on a push to main"
else
  DECISION="no release request: $VERSION (build $BUILD) is above the published $PUBLISHED_VERSION (build $PUBLISHED_BUILD), but this is not a push to main (${GITHUB_EVENT_NAME:-no event} on ${GITHUB_REF:-no ref})"
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
