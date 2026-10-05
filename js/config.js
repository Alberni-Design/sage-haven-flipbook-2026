// Flipbook settings. Edit this file only — no build step required.
window.FLIPBOOK_CONFIG = {
  title: "Sage Haven 2026",

  // Source A (default): a PDF rendered in the browser with pdf.js.
  pdf: "assets/flipbook.pdf",

  // Source B (faster on mobile): pre-rendered page images.
  // Run `scripts/pdf-to-images.sh assets/flipbook.pdf` and set this to
  // "assets/pages/manifest.json". When set, it takes precedence over `pdf`.
  imagesManifest: null,

  // Show the PDF download button in the toolbar.
  allowDownload: true,

  // Treat the first and last page as hard covers.
  hardCovers: true,

  // Rendering resolution multiplier for PDF pages (higher = sharper, heavier).
  renderScale: 2,
};
