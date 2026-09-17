#!/usr/bin/env bash
# Set the marketing version and add one to the build number.
#
#   bash scripts/bump.sh 0.2.0
#
# Both live in project.yml, which is the source of truth for the Xcode project,
# so this is the only place either of them is edited. Sparkle compares the build
# number, so it has to go up on every release even when the marketing version
# does not.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -ne 1 ]; then
  echo "usage: bash scripts/bump.sh <marketing-version>" >&2
  exit 2
fi

NEW_VERSION="$1"
if ! printf '%s' "$NEW_VERSION" | grep -qE '^[0-9]+(\.[0-9]+){0,2}$'; then
  echo "error: '$NEW_VERSION' is not a version like 1.2.3" >&2
  exit 1
fi

count_key() {
  grep -cE "^ *$1: " project.yml || true
}

for key in MARKETING_VERSION CURRENT_PROJECT_VERSION; do
  if [ "$(count_key "$key")" != "1" ]; then
    echo "error: project.yml does not hold exactly one $key" >&2
    exit 1
  fi
done

read_key() {
  grep -E "^ *$1: " project.yml | sed -E "s/^ *$1: *'?([^']*)'?.*$/\1/"
}

OLD_VERSION=$(read_key MARKETING_VERSION)
OLD_BUILD=$(read_key CURRENT_PROJECT_VERSION)

if ! printf '%s' "$OLD_BUILD" | grep -qE '^[0-9]+$'; then
  echo "error: CURRENT_PROJECT_VERSION '$OLD_BUILD' is not a whole number" >&2
  exit 1
fi
NEW_BUILD=$((OLD_BUILD + 1))

/usr/bin/sed -i '' -E \
  -e "s/^( *MARKETING_VERSION: ).*/\1'$NEW_VERSION'/" \
  -e "s/^( *CURRENT_PROJECT_VERSION: ).*/\1'$NEW_BUILD'/" \
  project.yml

echo "version: $OLD_VERSION -> $NEW_VERSION"
echo "build:   $OLD_BUILD -> $NEW_BUILD"
echo ""
echo "next: xcodegen generate && bash scripts/release.sh"
