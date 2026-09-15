#!/usr/bin/env bash
# Fetch the licensed Suisse Intl woff2 files from the private R2 bucket.
# Never blocks: without FONT_BUCKET (or on any download failure) the app falls
# back to the bundled Inter Variable, so this exits 0 with a warning.
# Needs wrangler auth: an OAuth login locally, CLOUDFLARE_API_TOKEN in CI.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/packages/ui/fonts"
FILES=(SuisseIntl-Regular.woff2 SuisseIntl-Medium.woff2)

if [[ -z "${FONT_BUCKET:-}" ]]; then
  echo "warn: FONT_BUCKET not set, Suisse Intl not fetched, Inter fallback active."
  exit 0
fi

mkdir -p "$DEST"
failed=0
for file in "${FILES[@]}"; do
  if [[ -s "$DEST/$file" ]]; then
    echo "have $file"
    continue
  fi
  if (cd "$ROOT/apps/web" && pnpm exec wrangler r2 object get "$FONT_BUCKET/$file" --file "$DEST/$file" --remote >/dev/null 2>&1); then
    echo "fetched $file"
  else
    echo "warn: failed to fetch $file"
    failed=1
  fi
done

if [[ $failed -eq 1 ]]; then
  echo "warn: Suisse Intl not (fully) fetched, Inter fallback active."
fi
exit 0
