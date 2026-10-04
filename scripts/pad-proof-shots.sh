#!/usr/bin/env bash
# Makes the two Screen Time pictures of the home page's proof section from the
# iPhone's own screenshots (1179 x 2556 PNG, dark appearance): what is on each
# card, with room around it in the card's own colour, both at one size and one
# scale. The screenshots show a name and an app list, so they stay out of git:
# pass them in.
#
#   bash scripts/pad-proof-shots.sh <screen time screenshot> <pickups screenshot>
#
# Needs ffmpeg, cwebp (`brew install webp`; ffmpeg has no WebP encoder of its
# own here) and sips, which macOS has.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/apps/web/public/media/screentime-mert"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# What is on each card, in the screenshot's pixels: width:height:x:y. Both are
# as wide as a card's own content, 987 pixels, so both keep one scale.
TIME_CROP=987:804:96:726
PICKUPS_CROP=987:586:96:711
# A flat spot of the card, where its colour is read from.
SAMPLE=600:700
# The canvas both are set on: 81 pixels of room at each side, 7 percent of the
# width, and the same above and below the taller one. The shorter one stands in
# the middle of the same canvas.
CANVAS=1150:966
# What the page gets: twice the 381 pixels a picture is shown at, at most.
SIZE=800:672

shot() {
  local source="$1" crop="$2" name="$3"
  # The screenshot is Display P3. The page gets sRGB.
  sips -m "/System/Library/ColorSync/Profiles/sRGB Profile.icc" "$source" --out "$TMP/srgb.png" >/dev/null
  local colour
  colour="$(ffmpeg -v error -i "$TMP/srgb.png" -vf "crop=1:1:$SAMPLE" -frames:v 1 -f rawvideo -pix_fmt rgb24 - | xxd -p)"
  ffmpeg -v error -y -i "$TMP/srgb.png" \
    -vf "crop=$crop,pad=$CANVAS:(ow-iw)/2:(oh-ih)/2:color=0x$colour,scale=$SIZE:flags=lanczos" \
    -frames:v 1 -pix_fmt rgb24 "$TMP/$name.png"
  cwebp -quiet -q 92 -m 6 -sharp_yuv "$TMP/$name.png" -o "$OUT/$name.webp"
  echo "$name.webp: card colour #$colour, ${SIZE/:/ x }"
}

shot "$1" "$TIME_CROP" mert-after-screen-time
shot "$2" "$PICKUPS_CROP" mert-after-pickups
