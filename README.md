# Sage Haven 2026 Flipbook

Static page-flip viewer built on [StPageFlip](https://nodlik.github.io/StPageFlip/) and [pdf.js](https://mozilla.github.io/pdf.js/).
No build step, no server-side code — deploys as plain files to GitHub Pages or any cPanel/Apache host.

## Add your publication

The flipbook shows pre-rendered WebP page images; the PDF is only the download.

1. Put the exported page PNGs (or JPGs) in a folder, then run:

   ```bash
   scripts/import-pages.sh path/to/png-folder   # optional: [width=1600] [quality=82]
   ```

   It writes `assets/pages/p01.webp…` plus `manifest.json` in book order. The order comes from the filenames:

   | Filename contains | Position |
   |---|---|
   | `cover` / `front` | Cover |
   | `inside` (not `back`) | Inside cover |
   | a number, e.g. `Page 7` | Page 7 |
   | `inside` + `back` | Inside back |
   | `back` | Back cover |

   It prints the mapping so the order can be checked. It stops if two files claim the same slot, and skips (with a warning) files it can't place.
   Requires ImageMagick with WebP support.

2. Replace `assets/flipbook.pdf` with the downloadable PDF (the current file is a placeholder), or set `allowDownload: false` in `js/config.js`.

If `assets/pages/manifest.json` is missing, the viewer falls back to rendering `assets/flipbook.pdf` with pdf.js
(`scripts/pdf-to-images.sh` converts a PDF to pages instead).

## Run locally

Must be served over HTTP (ES modules and `fetch` don't work from `file://`):

```bash
python3 -m http.server 8000   # → http://localhost:8000
```

## Deploy

**GitHub Pages** — Settings → Pages → Source: *GitHub Actions*. Pushes to `main` deploy via `.github/workflows/pages.yml`.
Note: free GitHub plans only publish Pages from **public** repos.

**cPanel** — upload the repo contents (including `.htaccess`) to `public_html/` or a subfolder, via File Manager or cPanel's Git Version Control.
`.htaccess` serves `.mjs` with a JavaScript MIME type; without it, some Apache configs break pdf.js.

## Embed in another website

Inside an `<iframe>` (or with `?embed` in the URL) the page drops its header, title and footer and shows only
the book, controls and download button on a transparent background:

```html
<iframe src="https://YOUR-FLIPBOOK-URL/?embed"
        title="Sage Haven 2026 Annual Report"
        style="width:100%; height:80vh; min-height:520px; border:0"
        allow="fullscreen" loading="lazy"></iframe>
```

`allow="fullscreen"` is needed for the fullscreen button to work inside the frame.

## Branding

Follows the Sage Haven Brand Guidelines (2023-10-31): primary blue `#1D458A`, cyan `#1CC0DD` for hovers/accents,
Noto Sans (self-hosted in `assets/fonts/`, SIL OFL).

- `assets/brand/sage-haven-logo-original.svg` is the official logo file, unmodified.
- `scripts/build-logos.py` derives the variants in `assets/brand/` from it (full, word mark + byline, icon mark,
  and reverse/white versions). Paths are untouched; only the viewBox is cropped. The byline is live text in
  Swiss 721 (a Helvetica design), so it falls back to Helvetica/Arial and is pinned to the word mark's width.
- The header uses the word mark with byline at ≥50px tall so the byline stays readable; the icon mark sits in the
  footer, away from the word mark, as the guidelines require.

## Usage

- Click/drag page corners, arrow keys, PageUp/PageDown, Home/End
- Deep links: `…/#page=5`
- Single-page mode on portrait/mobile screens
- The counter shows printed labels (Cover, Inside cover, 1…28, Inside back, Back cover) from the manifest

## Layout

```
index.html            viewer shell
js/config.js          settings
js/flipbook.js        loader + StPageFlip wiring (lazy-renders ±3 pages around the current one)
css/flipbook.css      styles
assets/flipbook.pdf   your publication
assets/brand/         logo variants (see Branding)
assets/fonts/         Noto Sans woff2
vendor/               page-flip 2.0.7 (patched, see below), pdf.js 6.4.299 (legacy build, for older Safari/Chrome)
scripts/              PNG → WebP importer, PDF → images converter
```

## Vendored library patch

`vendor/page-flip/page-flip.browser.js` carries one fix over upstream 2.0.7. In `drawHard()`, left-side hard pages
(the inside covers) were positioned at `translate3d(0, 0, 0)` instead of `translate3d(rect.left, …)`. When the book
is narrower than its container, that made the inside cover pivot left of the spine during the cover flip and snap
right when the animation ended. Re-apply this change if the library is upgraded.
