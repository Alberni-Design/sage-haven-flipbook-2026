// Flipbook settings. Edit this file only — no build step required.
window.FLIPBOOK_CONFIG = {
  title: "Sage Haven 2026 Annual Report",

  // Primary source: pre-rendered WebP pages + manifest.json, built by
  // `scripts/import-pages.sh <png-folder>` (or `scripts/pdf-to-images.sh <pdf>`).
  imagesManifest: "assets/pages/manifest.json",

  // The PDF behind the download button. Also used as the flipbook source
  // (rendered in-browser with pdf.js) when the manifest above is missing.
  pdf: "assets/flipbook.pdf",

  // Show the PDF download button in the toolbar.
  allowDownload: true,
  downloadName: "Sage Haven 2026 Annual Report.pdf",

  // Treat the first and last page as hard covers.
  hardCovers: true,

  // Rendering resolution multiplier for PDF pages (higher = sharper, heavier).
  renderScale: 2,
};
