#!/usr/bin/env bash
# Pre-render a PDF into WebP/JPEG page images + manifest.json for faster loading.
# Requires poppler-utils (pdftoppm). Optional: cwebp for WebP output.
# Usage: scripts/pdf-to-images.sh assets/flipbook.pdf [width=1600]
set -euo pipefail

PDF="${1:?Usage: $0 path/to/file.pdf [width]}"
WIDTH="${2:-1600}"
OUT="$(dirname "$PDF")/pages"

command -v pdftoppm >/dev/null || { echo "pdftoppm not found (install poppler-utils)"; exit 1; }

rm -rf "$OUT" && mkdir -p "$OUT"
pdftoppm -jpeg -jpegopt quality=85 -scale-to-x "$WIDTH" -scale-to-y -1 "$PDF" "$OUT/page"

EXT=jpg
if command -v cwebp >/dev/null; then
  for f in "$OUT"/page-*.jpg; do cwebp -quiet -q 82 "$f" -o "${f%.jpg}.webp" && rm "$f"; done
  EXT=webp
fi

# pdftoppm zero-pads based on page count; sort naturally.
mapfile -t FILES < <(cd "$OUT" && ls page-*."$EXT" | sort -V)
FIRST="$OUT/${FILES[0]}"
if command -v identify >/dev/null; then
  read -r W H < <(identify -format '%w %h\n' "$FIRST")
else
  read -r W H < <(pdfinfo -f 1 -l 1 "$PDF" | awk '/Page.*size/ {print $4, $6; exit}')
fi

{
  printf '{\n  "width": %s,\n  "height": %s,\n  "pages": [\n' "$W" "$H"
  for i in "${!FILES[@]}"; do
    sep=","; [[ $i -eq $((${#FILES[@]} - 1)) ]] && sep=""
    printf '    "%s"%s\n' "${FILES[$i]}" "$sep"
  done
  printf '  ]\n}\n'
} > "$OUT/manifest.json"

echo "Wrote ${#FILES[@]} pages to $OUT"
echo "Set imagesManifest: \"${OUT}/manifest.json\" in js/config.js"
