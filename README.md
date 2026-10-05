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
vendor/               page-flip 2.0.7, pdf.js 6.4.299 (legacy build, for older Safari/Chrome)
scripts/              PNG → WebP importer, PDF → images converter
```
