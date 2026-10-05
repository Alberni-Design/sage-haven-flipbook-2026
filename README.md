# Sage Haven 2026 Flipbook

Static page-flip viewer built on [StPageFlip](https://nodlik.github.io/StPageFlip/) and [pdf.js](https://mozilla.github.io/pdf.js/).
No build step, no server-side code — deploys as plain files to GitHub Pages or any cPanel/Apache host.

## Add your publication

1. Export the publication as a PDF and replace `assets/flipbook.pdf` (the current file is an 8-page placeholder).
2. Optionally edit `js/config.js` (title, download button, hard covers).

### Faster loading (recommended for large or image-heavy PDFs)

Client-side PDF rendering costs CPU on phones. Pre-render pages to images instead:

```bash
# needs poppler-utils (pdftoppm); uses cwebp for WebP output if installed
scripts/pdf-to-images.sh assets/flipbook.pdf 1600
```

Then set `imagesManifest: "assets/pages/manifest.json"` in `js/config.js`. Keep the PDF if you want the download button.

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

## Layout

```
index.html            viewer shell
js/config.js          settings
js/flipbook.js        loader + StPageFlip wiring (lazy-renders ±3 pages around the current one)
css/flipbook.css      styles
assets/flipbook.pdf   your publication
vendor/               page-flip 2.0.7, pdf.js 6.4.299 (legacy build, for older Safari/Chrome)
scripts/              PDF → images converter
```
