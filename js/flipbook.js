const cfg = window.FLIPBOOK_CONFIG || {};
const $ = (id) => document.getElementById(id);

const statusEl = $("status");
const bookEl = $("book");

// Pages rendered ahead of/behind the current spread.
const PRELOAD_RADIUS = 3;

function showStatus(html) {
  statusEl.innerHTML = html;
  statusEl.hidden = false;
}

/**
 * A source exposes: count, aspect (height / width), and render(index, pageEl).
 */
async function loadImageSource(manifestUrl) {
  const res = await fetch(manifestUrl, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Cannot load ${manifestUrl} (HTTP ${res.status})`);
  const manifest = await res.json();
  const base = new URL(manifestUrl, location.href);
  const urls = manifest.pages.map((p) => new URL(p, base).href);

  return {
    count: urls.length,
    aspect: manifest.height / manifest.width,
    render(index, pageEl) {
      const img = new Image();
      img.decoding = "async";
      img.alt = `Page ${index + 1}`;
      img.src = urls[index];
      return img.decode().catch(() => {}).then(() => pageEl.replaceChildren(img));
    },
  };
}

async function loadPdfSource(pdfUrl) {
  const pdfjs = await import("../vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;

  const doc = await pdfjs.getDocument({ url: new URL(pdfUrl, location.href).href }).promise;
  const first = await doc.getPage(1);
  const vp = first.getViewport({ scale: 1 });
  const scale = cfg.renderScale || 2;

  return {
    count: doc.numPages,
    aspect: vp.height / vp.width,
    async render(index, pageEl) {
      const page = await doc.getPage(index + 1);
      const viewport = page.getViewport({ scale: Math.min(scale, 2400 / page.getViewport({ scale: 1 }).width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport }).promise;
      pageEl.replaceChildren(canvas);
    },
  };
}

function buildPages(count) {
  const pages = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "page page--loading";
    if (cfg.hardCovers && (i === 0 || i === count - 1)) el.dataset.density = "hard";
    bookEl.appendChild(el);
    pages.push(el);
  }
  return pages;
}

function pageFromHash(count) {
  const m = location.hash.match(/page=(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return Math.min(Math.max(n, 1), count) - 1;
}

function setupToolbar(flip, count) {
  const cur = $("page-current");
  $("page-total").textContent = count;

  const update = (index) => {
    const portrait = flip.getOrientation() === "portrait";
    // In landscape the cover is shown alone, then spreads of two.
    const label = !portrait && index > 0 && index < count - 1
      ? `${index + 1}–${Math.min(index + 2, count)}`
      : `${index + 1}`;
    cur.textContent = label;
    $("btn-first").disabled = $("btn-prev").disabled = index === 0;
    $("btn-last").disabled = $("btn-next").disabled = index >= count - (portrait ? 1 : 2);
    history.replaceState(null, "", `#page=${index + 1}`);
  };

  $("btn-first").onclick = () => flip.flip(0);
  $("btn-prev").onclick = () => flip.flipPrev();
  $("btn-next").onclick = () => flip.flipNext();
  $("btn-last").onclick = () => flip.flip(count - 1);

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowLeft" || e.key === "PageUp") flip.flipPrev();
    else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); flip.flipNext(); }
    else if (e.key === "Home") flip.flip(0);
    else if (e.key === "End") flip.flip(count - 1);
  });

  const fsBtn = $("btn-fullscreen");
  if (document.fullscreenEnabled) {
    fsBtn.onclick = () => document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
  } else {
    fsBtn.hidden = true;
  }

  const dl = $("btn-download");
  if (cfg.allowDownload && cfg.pdf) {
    dl.href = cfg.pdf;
    dl.hidden = false;
  }

  return update;
}

async function init() {
  if (cfg.title) {
    document.title = cfg.title;
    $("book-title").textContent = cfg.title;
  }

  let source;
  try {
    source = cfg.imagesManifest ? await loadImageSource(cfg.imagesManifest) : await loadPdfSource(cfg.pdf);
  } catch (err) {
    console.error(err);
    showStatus(`Could not load the flipbook.<br><small>${err.message}</small><br><br>
      Check that <code>${cfg.imagesManifest || cfg.pdf}</code> exists and that the page is served over HTTP
      (opening <code>index.html</code> directly from disk will not work).`);
    return;
  }

  const pages = buildPages(source.count);
  const rendered = new Map();
  const ensure = (i) => {
    if (i < 0 || i >= source.count || rendered.has(i)) return;
    const p = source.render(i, pages[i])
      .then(() => pages[i].classList.remove("page--loading"))
      .catch((err) => { console.error(`Page ${i + 1}:`, err); rendered.delete(i); });
    rendered.set(i, p);
  };
  const preload = (center) => {
    for (let d = 0; d <= PRELOAD_RADIUS; d++) { ensure(center + d); ensure(center - d); }
  };

  const baseWidth = 600;
  const startPage = pageFromHash(source.count);
  preload(startPage);

  statusEl.hidden = true;
  bookEl.hidden = false;

  const flip = new St.PageFlip(bookEl, {
    width: baseWidth,
    height: Math.round(baseWidth * source.aspect),
    size: "stretch",
    minWidth: 200,
    maxWidth: 2000,
    minHeight: Math.round(200 * source.aspect),
    maxHeight: Math.round(2000 * source.aspect),
    showCover: true,
    usePortrait: true,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: false,
    startPage,
  });
  flip.loadFromHTML(pages);

  const update = setupToolbar(flip, source.count);
  update(flip.getCurrentPageIndex());
  flip.on("flip", (e) => { update(e.data); preload(e.data); });
  flip.on("changeOrientation", () => update(flip.getCurrentPageIndex()));
}

init();
