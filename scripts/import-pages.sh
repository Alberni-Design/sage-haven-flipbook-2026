#!/usr/bin/env bash
# Convert exported page images (PNG/JPG) into WebP pages + manifest.json, in book order:
#   cover, inside cover, 1..N, inside back, back cover
# Order is inferred from filenames: "cover"/"front", "inside"+"front|cover", plain numbers,
# "inside"+"back", "back". Files that match none of these are reported and skipped.
# Requires ImageMagick (magick or convert) with WebP support.
# Usage: scripts/import-pages.sh path/to/png-folder [width=1600] [quality=82]
set -euo pipefail

SRC="${1:?Usage: $0 path/to/png-folder [width] [quality]}"
WIDTH="${2:-1600}"
QUALITY="${3:-82}"
OUT="assets/pages"

IM=$(command -v magick || command -v convert) || { echo "ImageMagick not found"; exit 1; }

# Emit "sortkey<TAB>label<TAB>path" for each image.
classify() {
  local f name lower num
  while IFS= read -r -d '' f; do
    name=$(basename "$f"); lower=${name,,}; lower=${lower%.*}
    if [[ $lower == *inside* && $lower == *back* ]]; then
      printf '9998\tInside back\t%s\n' "$f"
    elif [[ $lower == *back* ]]; then
      printf '9999\tBack cover\t%s\n' "$f"
    elif [[ $lower == *inside* ]]; then
      printf '0001\tInside cover\t%s\n' "$f"
    elif [[ $lower == *cover* || $lower == *front* ]]; then
      printf '0000\tCover\t%s\n' "$f"
    elif num=$(grep -oE '[0-9]+' <<<"$lower" | tail -1); [[ -n $num ]]; then
      printf '%04d\t%d\t%s\n' $((10#$num + 1)) $((10#$num)) "$f"
    else
      echo "SKIPPED (unrecognised name): $f" >&2
    fi
  done < <(find "$SRC" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -not -path '*/__MACOSX/*' -print0)
}

mapfile -t ROWS < <(classify | sort -t$'\t' -k1,1n)
(( ${#ROWS[@]} )) || { echo "No images found in $SRC"; exit 1; }

# Duplicate sort keys mean two files claim the same slot.
dups=$(printf '%s\n' "${ROWS[@]}" | cut -f1 | uniq -d)
[[ -z $dups ]] || { echo "Two files map to the same page slot — rename them:"; printf '%s\n' "${ROWS[@]}" | grep -E "^($(paste -sd'|' <<<"$dups"))"$'\t'; exit 1; }

rm -rf "$OUT" && mkdir -p "$OUT"
PAGES=(); LABELS=()
for i in "${!ROWS[@]}"; do
  IFS=$'\t' read -r _ label path <<<"${ROWS[$i]}"
  file=$(printf 'p%02d.webp' $((i + 1)))
  "$IM" "$path" -resize "${WIDTH}x>" -strip -quality "$QUALITY" "$OUT/$file"
  printf '%-14s <- %s\n' "$label" "$(basename "$path")"
  PAGES+=("$file"); LABELS+=("$label")
done

read -r W H < <("$IM" identify -format '%w %h\n' "$OUT/${PAGES[0]}" 2>/dev/null || identify -format '%w %h\n' "$OUT/${PAGES[0]}")

json_list() { local first=1; for v in "$@"; do (( first )) || printf ','; printf '\n    "%s"' "$v"; first=0; done; }
printf '{\n  "width": %s,\n  "height": %s,\n  "pages": [%s\n  ],\n  "labels": [%s\n  ]\n}\n' \
  "$W" "$H" "$(json_list "${PAGES[@]}")" "$(json_list "${LABELS[@]}")" > "$OUT/manifest.json"

echo "Wrote ${#PAGES[@]} pages ($(du -sh "$OUT" | cut -f1)) to $OUT"
(( ${#PAGES[@]} % 2 == 0 )) || echo "Warning: odd page count — the back cover will not land on its own page in spread view."
