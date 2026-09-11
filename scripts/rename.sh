#!/usr/bin/env bash
# Rename the template to your product. Rewrites every tracked file (plus .env) in one diff.
# Usage: scripts/rename.sh <new-name>   (kebab-case, lowercase, e.g. acme-app)
# Touches: package scope, wrangler worker name, portless hosts, titles, lockfile.
# Leaves docs/adr as history and keeps the mertbuilds/web-starter template pointer in README.
set -euo pipefail

cd "$(dirname "$0")/.."

NAME="${1:-}"
if [[ ! "$NAME" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]]; then
  echo "Usage: scripts/rename.sh <new-name>   (lowercase kebab-case, e.g. acme-app)" >&2
  exit 1
fi
SQUASHED="${NAME//-/}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash first so the rename is one reviewable diff." >&2
  exit 1
fi

echo "» Renaming webstarter → $SQUASHED, web-starter → $NAME..."
FILES=()
while IFS= read -r -d '' f; do FILES+=("$f"); done < <(
  git grep -Ilz -e web-starter -e webstarter -- . ':!docs/adr' ':!scripts/rename.sh'
)
if [[ -f .env ]] && grep -Iq -e web-starter -e webstarter .env; then FILES+=(.env); fi

# webstarter first: if NAME contains "webstarter" (e.g. acme-webstarter) the reverse order rewrites its suffix again; SQUASHED has no hyphen so it cannot match web-starter.
perl -pi -e "s/webstarter/$SQUASHED/g; s/(?<!mertbuilds\/)web-starter/$NAME/g" "${FILES[@]}"
echo "  ${#FILES[@]} files rewritten"

echo "» Regenerating lockfile..."
pnpm install --lockfile-only

echo "» Remaining occurrences (should be empty):"
git grep -n -i "web-starter\|webstarter" -- . ':!docs/adr' ':!scripts/rename.sh' | grep -v -e 'mertbuilds/web-starter' -e "$NAME" -e "$SQUASHED" || true

echo "✓ Renamed to $NAME. Review the diff, then commit."
