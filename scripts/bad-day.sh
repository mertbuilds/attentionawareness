#!/usr/bin/env bash
# Nuke every cache and dependency dir, then reinstall. For when nothing makes sense.
# DRY_RUN=1 bash scripts/bad-day.sh  -> print what would be removed, touch nothing.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

dry() { [[ "${DRY_RUN:-0}" == "1" ]]; }

echo "» Stopping dev processes..."
if ! dry; then
  pkill -f "mprocs" 2>/dev/null || true
  pkill -f "$ROOT.*vite" 2>/dev/null || true
  pkill -f "$ROOT.*storybook" 2>/dev/null || true
  pkill -f "node --watch.*$ROOT" 2>/dev/null || true
  pkill -f "wrangler.*$ROOT" 2>/dev/null || true
else
  echo "  (dry run: would pkill mprocs/vite/storybook/node --watch/wrangler scoped to $ROOT)"
fi

echo "» Collecting removal targets..."
TARGETS=()
while IFS= read -r dir; do
  TARGETS+=("$dir")
done < <(find . -name node_modules -type d -prune -not -path './.git/*')

for extra in \
  .turbo \
  apps/web/.output \
  apps/web/.wrangler \
  apps/web/dist \
  apps/web/src/paraglide \
  e2e/playwright-report \
  e2e/test-results \
  packages/ui/storybook-static \
  packages/ui/dist; do
  [[ -e "$extra" ]] && TARGETS+=("$extra")
done

while IFS= read -r dir; do
  TARGETS+=("$dir")
done < <(find apps packages e2e -maxdepth 3 -type d \( -name .vite -o -name .turbo \) -prune 2>/dev/null)

for t in "${TARGETS[@]}"; do
  if dry; then
    echo "  would remove: $t"
  else
    echo "  removing: $t"
    rm -rf "$t"
  fi
done

echo "» Pruning pnpm store..."
if dry; then
  echo "  (dry run: would run pnpm store prune)"
else
  pnpm store prune
fi

echo "» Reinstalling..."
if dry; then
  echo "  (dry run: would run pnpm install)"
else
  pnpm install
fi

echo '✓ Bad day handled.'
